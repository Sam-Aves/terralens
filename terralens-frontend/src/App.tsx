import React, { useEffect, useRef, useState } from 'react';
import { jamunaMission } from './data/mission01';
import { assamMission } from './data/mission02';
import { amazonMission } from './data/mission03';
import type { MissionData } from './types/mission';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { CosmicBackground } from './components/CosmicBackground';
import { EvidenceBadge } from './components/evidence/EvidenceBadge';
import { RadarMap } from './components/RadarMap';
import { WorldMap } from './components/WorldMap';
import { Memories } from './components/Memories';
import { PilotAvatar, AvatarEditor, loadAvatar, saveAvatar } from './components/Avatar';
import type { AvatarConfig } from './components/Avatar';
import type { WorldMarker } from './components/WorldMap';
import { sound, ambience, playRankUp } from './utils/audio';
import { Confetti, CountUp, FactCard, SpotTheFlood, MYSTERY_QUIZ, MYSTERY_COST, MYSTERY_XP, EXPLORER_BONUS_XP, downloadShareCard, emptyFun, loadFun, saveFun, touchStreak } from './components/Fun';
import type { FunState } from './components/Fun';
import { JAMUNA_S1, WATER_VH_DB, getS1Mission, s1DisplayTileUrl, scoreMark } from './data/sentinel1';
import * as api from './api/terralensApi';
import type { JournalEntry } from './types/api';
import type { MissionContext, ImpactLayers } from './data/missionContext';
import { Award, Compass, CheckCircle, AlertCircle, Layers, Trophy, RotateCcw, ArrowRight, BookOpen, Map as MapIcon, Globe, ShieldCheck, Lock, LayoutDashboard, Coins, Clock, Calendar, Users, Volume2, VolumeX, Printer, X, Radio, ShieldAlert, Zap, Flame } from 'lucide-react';

const allMissions: MissionData[] = [jamunaMission, assamMission, amazonMission];

export const App: React.FC = () => {
  type Tab = 'welcome' | 'dashboard' | 'explorer' | 'lab' | 'journal' | 'arcade';
  const TABS: Tab[] = ['welcome', 'dashboard', 'explorer', 'lab', 'journal', 'arcade'];
  const hashTab = (): Tab => { const h = window.location.hash.replace('#/', '').replace('#', ''); return (TABS as string[]).includes(h) ? (h as Tab) : 'welcome'; };
  const [activeTab, setActiveTab] = useState<Tab>(hashTab);
  const [callsign, setCallsign] = useState<string>('Investigator-Mufliha');
  const [avatar, setAvatar] = useState<AvatarConfig>(() => loadAvatar());
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [currentMission, setCurrentMission] = useState<MissionData>(jamunaMission);
  const [timelineIndex, setTimelineIndex] = useState<number>(2);
  const [exploreQuery, setExploreQuery] = useState<string>('');
  const [exploreSel, setExploreSel] = useState<string | null>(null);
  const [exploreFocus, setExploreFocus] = useState<{ lng: number; lat: number; zoom?: number; nonce: number } | null>(null);
  // Cosmetics bought with coins, written conclusions and impact answers (kept in this browser)
  const THEMES = [
    { id: 'aurora', name: 'Aurora', cost: 0,  bg: 'linear-gradient(135deg, #00F0FF, #9D4EDD)' },
    { id: 'solar',  name: 'Solar',  cost: 50, bg: 'linear-gradient(135deg, #fbbf24, #ef4444)' },
    { id: 'ocean',  name: 'Ocean',  cost: 60, bg: 'linear-gradient(135deg, #38bdf8, #1d4ed8)' },
    { id: 'forest', name: 'Forest', cost: 80, bg: 'linear-gradient(135deg, #34d399, #065f46)' },
  ];
  const loadJson = <T,>(key: string, fallback: T): T => { try { const r = window.localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; } };
  const saveJson = (key: string, v: unknown) => { try { window.localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } };
  const [cosmetics, setCosmetics] = useState<{ owned: string[]; active: string }>(() => loadJson('terralens.cosmetics.v1', { owned: ['aurora'], active: 'aurora' }));
  type Notes = Record<string, { text?: string; impactDone?: boolean; conclusionXp?: boolean }>;
  const [notes, setNotes] = useState<Notes>(() => loadJson('terralens.notes.v1', {}));
  const [draft, setDraft] = useState<string>('');
  const [impactResult, setImpactResult] = useState<{ pick: string; right: boolean; rows: { name: string; pct: number }[] } | null>(null);
  const [impactBusy, setImpactBusy] = useState<boolean>(false);
  const [ctx, setCtx] = useState<MissionContext>({});
  const [layers, setLayers] = useState<ImpactLayers>({});
  const [exposure, setExposure] = useState<string[] | null>(null);
  const [exposureBusy, setExposureBusy] = useState<boolean>(false);
  useEffect(() => {
    let off = false;
    setCtx({}); setLayers({}); setExposure(null);
    api.getMissionContext(currentMission.id).then(c => { if (!off) setCtx(c ?? {}); }).catch(() => {});
    api.getImpactLayers(currentMission.id).then(l => { if (!off) setLayers(l ?? {}); }).catch(() => {});
    return () => { off = true; };
  }, [currentMission.id]);
  // Real Sentinel-1 picture of each mission's peak date (one map tile), used on the mission cards
  const thumbUrl = (missionId: number): string => {
    const sm = getS1Mission(missionId);
    if (!sm) return '';
    const z = 9, n = 2 ** z;
    const tx = Math.floor(((sm.center[0] + 180) / 360) * n);
    const latR = (sm.center[1] * Math.PI) / 180;
    const ty = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
    return s1DisplayTileUrl(sm.stages[2].itemId).replace('{z}', String(z)).replace('{x}', String(tx)).replace('{y}', String(ty));
  };
  // 3D tilt: mission cards lean toward the mouse (skipped when the visitor prefers reduced motion)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last: HTMLElement | null = null;
    const clear = (el: HTMLElement | null) => { el?.style.removeProperty('--rx'); el?.style.removeProperty('--ry'); };
    const onMove = (e: MouseEvent) => {
      const card = (e.target as HTMLElement | null)?.closest?.('.tl-mcard') as HTMLElement | null;
      if (card !== last) { clear(last); last = card; }
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 10}deg`);
      card.style.setProperty('--rx', `${(0.5 - ((e.clientY - r.top) / r.height)) * 8}deg`);
    };
    document.addEventListener('mousemove', onMove);
    return () => { document.removeEventListener('mousemove', onMove); clear(last); };
  }, []);
  // ── Fun extras: streak, bests, speed round, area guess, mystery bonuses ──
  const [fun, setFunState] = useState<FunState>(() => { const f = touchStreak(loadFun()); saveFun(f); return f; });
  const setFun = (fn: (f: FunState) => FunState) => setFunState(prev => { const next = fn(prev); saveFun(next); return next; });
  const [speed, setSpeed] = useState<{ active: boolean; endsAt: number; points: number; combo: number; taps: number; hits: number } | null>(null);
  const speedHits = useRef<[number, number][]>([]);
  const [, setTick] = useState(0);
  const [guess, setGuess] = useState<number>(0);
  const [guessResult, setGuessResult] = useState<{ actual: number; xp: number; offPct: number } | null>(null);
  const [mysteryPick, setMysteryPick] = useState<number | null>(null);
  const [exploreWin, setExploreWin] = useState<boolean>(false);   // confetti when all 3 signals are decoded
  const [shareMsg, setShareMsg] = useState<string>('');
  const distM = (a: [number, number], b: [number, number]) => {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  useEffect(() => {
    if (!speed?.active) return;
    const t = window.setInterval(() => {
      if (Date.now() >= speed.endsAt) setSpeed(sp => sp ? { ...sp, active: false } : sp);
      else setTick(x => x + 1);
    }, 250);
    return () => window.clearInterval(t);
  }, [speed?.active, speed?.endsAt]);
  useEffect(() => {
    if (!speed || speed.active) return;
    const key = String(currentMission.id);
    setFun(f => (speed.points > (f.bestSpeed[key] ?? 0) ? { ...f, bestSpeed: { ...f.bestSpeed, [key]: speed.points } } : f));
    setShowFloodLayer(true);
    sound.playTrophyFanfare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed?.active]);
  useEffect(() => { setSpeed(null); setGuess(0); setGuessResult(null); }, [currentMission.id]);
  useEffect(() => { if (activeTab !== 'lab') setSpeed(sp => (sp?.active ? null : sp)); }, [activeTab]);
  useEffect(() => { setMysteryPick(null); }, [exploreSel]);
  const [briefingOpen, setBriefingOpen] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);
  const [hintsByQ, setHintsByQ] = useState<Record<number, number>>({});   // hints opened per question (0-2)
  const [startXp, setStartXp] = useState<number>(0);                      // XP when the mission was opened (for rank-up)
  const [submitted, setSubmitted] = useState<api.SubmitResponse | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [coins, setCoins] = useState<number>(50);
  const [missionComplete, setMissionComplete] = useState<boolean>(false);
  const [showFloodLayer, setShowFloodLayer] = useState<boolean>(true);
  const [showImpactLayer, setShowImpactLayer] = useState<boolean>(true);
  const [savedToJournal, setSavedToJournal] = useState<boolean>(false);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  // ── NEW ADVANCED RADAR LAB FEATURES ──
  const [labPanelCollapsed, setLabPanelCollapsed] = useState<boolean>(() => window.innerWidth < 1300);   // small laptops start with the board tucked away
  const [radarBand, setRadarBand] = useState<'optical' | 'c-band' | 'l-band'>('c-band');
  const [simulatedReliefPledged, setSimulatedReliefPledged] = useState<number>(0);
  const [showEvacuationModal, setShowEvacuationModal] = useState<boolean>(false);

  // ── FUN FEATURE 1: Radar Pulse Sweep ──
  const [activeRadarSweep, setActiveRadarSweep] = useState<boolean>(false);
  // ── FUN FEATURE 2: Field Radio ──
  const [radioDispatchOpen, setRadioDispatchOpen] = useState<boolean>(false);
  const [radioMessageIdx, setRadioMessageIdx] = useState<number>(0);

  // ── FEATURE A: Mission Unlock Toast ──
  const [unlockToast, setUnlockToast] = useState<string | null>(null);

  // ── Real Sentinel-1 change detection (Mission 01 only for now) ──
  // Each mission has its own Sentinel-1 scenes, study area and timeline (data/sentinel1.ts)
  const s1 = getS1Mission(currentMission.id);
  const s1Active = s1 !== null;
  const timeline = s1?.stages ?? JAMUNA_S1.stages;
  const isJamuna = currentMission.id === 1;   // settlements, relief and radio content exist for Mission 01 only
  const analysis = api.useAnalysis(currentMission.id, activeTab === 'lab' && s1Active);   // GET /analysis/{id}
  useEffect(() => {
    const target = activeTab === 'welcome' ? '' : `#/${activeTab}`;
    if (window.location.hash !== target) window.history.pushState(null, '', target || window.location.pathname);
  }, [activeTab]);
  useEffect(() => {
    const onNav = () => setActiveTab(hashTab());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);
  useEffect(() => { setDraft(notes[String(currentMission.id)]?.text ?? ''); setImpactResult(null); }, [currentMission.id]);
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setTimelineIndex(i => (i + 1) % timeline.length), 2600);
    return () => window.clearInterval(t);
  }, [playing, timeline.length]);
  useEffect(() => { if (activeTab !== 'lab') setPlaying(false); }, [activeTab]);
  const stageStats = s1Active ? analysis.data?.stages[timelineIndex] ?? null : null;

  // ── Player progress + journal, loaded from and saved through the API layer ──
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    api.getPlayerProgress().then(p => {                                    // GET /players/{id}/progress
      if (cancelled) return;
      setScore(p.xp);
      setCoins(p.coins);
      if (p.callsign) setCallsign(p.callsign);
      setJournal(p.journal);
    }).catch(() => { /* first visit or storage blocked: start fresh */ });
    return () => { cancelled = true; };
  }, []);

  // ── Change Detective: the player marks where new water appeared ──
  type Mark = { id: number; lng: number; lat: number; correct: boolean | null; verdict?: api.MarkVerdict; newWaterPercent?: number; alreadyWaterPercent?: number };
  const [markPhase, setMarkPhase] = useState<'idle' | 'placing' | 'checking' | 'checked'>('idle');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [markSummary, setMarkSummary] = useState<{ correct: number; passed: boolean; xp: number } | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [markXpBanked, setMarkXpBanked] = useState<number | null>(null);   // XP for marks is given once per mission run
  const maskHiddenForTask = markPhase === 'placing' || markPhase === 'checking' || !!speed?.active;

  useEffect(() => { if (markPhase === 'checked') setLabPanelCollapsed(false); }, [markPhase]);   // open the board when the marks are checked
  const resetMarks = () => { setMarkPhase('idle'); setMarks([]); setMarkSummary(null); setMarkError(null); setMarkXpBanked(null); };

  const handleStartMarking = () => {
    if (speed?.active) return;   // finish the speed round first
    setMarks([]);
    setMarkSummary(null);
    setMarkError(null);
    if (timelineIndex === 0) setTimelineIndex(2);   // the baseline date has no change to find
    setMarkPhase('placing');
    sound.playRadarPing();
  };

  const handleMapClick = (lng: number, lat: number) => {
    if (speed?.active) {
      // Speed round: every tap is scored at once against the reference change map
      const id = Date.now();
      scoreMark(currentMission.id, timelineIndex, lng, lat, api.MARK_RADIUS_M).then(sc => {
        const far = speedHits.current.every(h => distM(h, [lng, lat]) >= api.MARK_MIN_SPACING_M);
        const ok = sc.inside && sc.newWaterFraction >= api.MARK_PASS_FRACTION && far;
        if (ok) { speedHits.current.push([lng, lat]); sound.playSuccessChime(); } else sound.playKeyClick();
        setMarks(prev => [...prev, { id, lng, lat, correct: ok }]);
        setSpeed(sp => {
          if (!sp || !sp.active) return sp;
          const combo = ok ? Math.min(5, sp.combo + 1) : 0;
          return { ...sp, combo, taps: sp.taps + 1, hits: sp.hits + (ok ? 1 : 0), points: sp.points + (ok ? 10 * combo : 0) };
        });
      }).catch(() => {});
      return;
    }
    if (markPhase !== 'placing') return;
    setMarks(prev => prev.length >= api.MARKS_ALLOWED ? prev : [...prev, { id: Date.now(), lng, lat, correct: null }]);
    sound.playRadarPing();
  };

  const handleCheckMarks = () => {
    if (!marks.length) return;
    setMarkPhase('checking');
    setMarkError(null);
    // POST /investigations/{id}/marks — the marks are compared with the reference change map
    api.checkMarks(currentMission.id, { stageIndex: timelineIndex, marks: marks.map(({ id, lng, lat }) => ({ id, lng, lat })) })
      .then(res => {
        setMarks(res.results.map(r => ({ id: r.id, lng: r.lng, lat: r.lat, correct: r.correct, verdict: r.verdict, newWaterPercent: r.newWaterPercent, alreadyWaterPercent: r.alreadyWaterPercent })));
        const firstCheck = markXpBanked === null;
        setMarkSummary({ correct: res.correctCount, passed: res.passed, xp: firstCheck ? res.xpAwarded : 0 });
        if (firstCheck) {
          setMarkXpBanked(res.xpAwarded);
          if (res.xpAwarded > 0) setScore(prev => prev + res.xpAwarded);
        }
        setShowFloodLayer(true);   // reveal the reference mask so the player can compare
        setMarkPhase('checked');
        if (res.passed) sound.playSuccessChime(); else sound.playRadarPing();
      })
      .catch(() => {
        setMarkError('Could not check the marks: the reference radar data did not load. Check the connection and try again.');
        setMarkPhase('placing');
      });
  };

  // ── Mission list ──
  const [missions, setMissions] = useState<MissionData[]>(allMissions);
  useEffect(() => {
    let cancelled = false;
    api.getMissions().then(m => { if (!cancelled && m.length) setMissions(m); }).catch(() => { /* keep the bundled list */ });   // GET /missions
    return () => { cancelled = true; };
  }, []);

  const handleResetProgress = () => {
    api.resetPlayer().then(p => {
      setScore(p.xp);
      setCoins(p.coins);
      setJournal(p.journal);
      setSavedToJournal(false);
      setMissionComplete(false);
      resetMarks();
      setNotes({}); saveJson('terralens.notes.v1', {});
      setCosmetics({ owned: ['aurora'], active: 'aurora' }); saveJson('terralens.cosmetics.v1', { owned: ['aurora'], active: 'aurora' });
      setDraft(''); setImpactResult(null);
      setFun(() => touchStreak(emptyFun())); setSpeed(null); setGuessResult(null);
    }).catch(() => {});
  };

  const radioDispatches = [
    { sender: 'NASA EO DIRECTOR', text: '“Investigator, Sentinel-1 radar downlink acquired over Sirajganj! Riverbanks shifting 300 meters westward.”' },
    { sender: 'DHAKA DISASTER OPS', text: '“Local emergency boats dispatched to Belkuchi embankment. Dual-pol radar water mask matches real ground reports.”' },
    { sender: 'ISRO NISAR TEAM', text: '“L-band antenna calibration nominal. Ground penetration shows submerged char crop fields under dense canopy.”' },
    { sender: 'FIELD PILOT RECON', text: '“Clearance granted! Flood extent mapped from the Sentinel-1 passes. Good job, Detective.”' }
  ];

  const triggerRadarSweep = () => {
    setActiveRadarSweep(true);
    sound.playRadarPing();
    setTimeout(() => {
      sound.playRadarPing();
    }, 400);
    setTimeout(() => {
      setActiveRadarSweep(false);
    }, 2400);
  };

  const isAssamUnlocked = score >= 100;
  const isAmazonUnlocked = score >= 250;

  const currentChallenge = currentMission.challenges[currentQuestionIndex];
  const isCorrect = selectedAnswers[currentQuestionIndex] === currentChallenge?.correctIndex;
  const activeTimeline = timeline[timelineIndex];

  const getRank = () => api.rankForXp(score);

  useEffect(() => {
    if (activeTab === 'lab' && !audioMuted) ambience.start(); else ambience.stop();
    return () => ambience.stop();
  }, [activeTab, audioMuted]);

  const handleStartSpeed = () => {
    resetMarks();
    speedHits.current = [];
    setPlaying(false);
    if (timelineIndex === 0) setTimelineIndex(2);
    setSpeed({ active: true, endsAt: Date.now() + 60000, points: 0, combo: 0, taps: 0, hits: 0 });
    sound.playRadarPing();
  };

  const toggleAudio = () => {
    sound.enabled = !sound.enabled;
    setAudioMuted(!sound.enabled);
  };

  const handleLaunchMission = (mission: MissionData) => {
    setCurrentMission(mission);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowExplanation(false);
    setMissionComplete(false);
    setHintsByQ({});
    setSubmitted(null);
    setStartXp(score);
    setPlaying(false);
    setBriefingOpen(true);
    resetMarks();
    setActiveTab('lab');
    sound.playRadarPing();
  };

  const handleSelectOption = (optionIndex: number) => {
    if (showExplanation) return;
    setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: optionIndex }));
    setShowExplanation(true);

    if (optionIndex === currentChallenge.correctIndex) {
      const newScore = score + 50;
      setScore(newScore);
      setCoins(prev => prev + 25);
      sound.playSuccessChime();
      // ── FEATURE A: Show mission unlock toast at XP threshold ──
      if (score < 100 && newScore >= 100) {
        setUnlockToast('🔓 MISSION 02 UNLOCKED — BRAHMAPUTRA FLOOD SURGE!');
        setTimeout(() => setUnlockToast(null), 4500);
      } else if (score < 250 && newScore >= 250) {
        setUnlockToast('🔓 MISSION 03 UNLOCKED — AMAZON WETLAND DYNAMICS!');
        setTimeout(() => setUnlockToast(null), 4500);
      }
    } else {
      sound.playRadarPing();
    }
  };

  const handleNextQuestion = () => {
    setShowExplanation(false);
    if (currentQuestionIndex < currentMission.challenges.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      sound.playRadarPing();
    } else {
      setMissionComplete(true);
      setSavedToJournal(true);
      sound.playTrophyFanfare();
      // POST /investigations/{id}/submit — answers are checked there; saved XP, coins and journal come back
      api.submitInvestigation(currentMission.id, {
        missionId: String(currentMission.id),
        playerCallsign: callsign,
        answers: selectedAnswers,
        hintsUsed: Object.values(hintsByQ).reduce((a, b) => a + b, 0),
        marks: marks.map(({ id, lng, lat }) => ({ id, lng, lat })),
        correctMarks: (markXpBanked ?? 0) / api.XP_PER_CORRECT_MARK,
      }).then((res) => {
        const { progress } = res;
        setSubmitted(res);
        setFun(f => ({ ...f, bestScore: { ...f.bestScore, [String(currentMission.id)]: Math.max(f.bestScore[String(currentMission.id)] ?? 0, res.result.score) } }));
        if (api.rankForXp(startXp) !== api.rankForXp(res.progress.xp)) window.setTimeout(() => playRankUp(), 900);
        setScore(progress.xp);
        setCoins(progress.coins);
        setJournal(progress.journal);
      }).catch(() => { /* keep the on-screen totals if saving failed */ });
    }
  };

  const handleRestartMission = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowExplanation(false);
    setMissionComplete(false);
    setHintsByQ({});
    setSubmitted(null);
    setStartXp(score);
    resetMarks();
    setActiveTab('lab');
  };

  // SCREEN 1: NEW CINEMATIC WELCOME SCREEN
  if (activeTab === 'welcome') {
    return (
      <WelcomeScreen
        callsign={callsign}
        onCallsignChange={setCallsign}
        onEnter={() => {
          sound.playRadarPing();
          api.savePlayerProfile({ callsign }).catch(() => {});             // PUT /players/{id}
          setActiveTab('dashboard');
        }}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#040611',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* ── Real Cosmic WebGL Shader Background ── */}
      <CosmicBackground />

      {/* Top Header */}
      <header className="tl-header">
        <div className="tl-header-left">
          <div
            className="tl-brand"
            onClick={() => setActiveTab('welcome')}
            title="Return to Welcome Screen"
          >
            <span className="tl-brand-mark" aria-hidden="true">
              <span className="tl-brand-ring" />
              <span className="tl-brand-core" />
            </span>
            <span className="tl-brand-name">TERRALENS</span>
          </div>

          <nav className="tl-nav">
            {([
              { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
              { id: 'explorer', label: 'Explorer', Icon: Globe },
              { id: 'lab', label: 'Radar Lab', Icon: MapIcon },
              { id: 'journal', label: 'Journal', Icon: BookOpen },
              { id: 'arcade', label: 'Arcade', Icon: Zap }
            ] as const).map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`tl-nav-btn${activeTab === id ? ' is-active' : ''}`}
                onClick={() => { sound.playRadarPing(); setActiveTab(id); }}
                title={label}
              >
                <Icon size={15} />
                <span className="tl-nav-label">{label}</span>
                {id === 'journal' && savedToJournal && activeTab !== 'journal' && <span className="tl-nav-dot" title="New entry saved" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="tl-header-right">
          {/* Player card: avatar, callsign, rank and progress to the next rank */}
          {(() => {
            const tiers = api.RANKS.map(r => r.minXp);
            const next = tiers.find(t => t > score);
            const prev = [...tiers].reverse().find(t => t <= score) ?? 0;
            const pct = next ? Math.round(((score - prev) / (next - prev)) * 100) : 100;
            return (
              <div className="tl-player" title={next ? `${next - score} XP to next rank` : 'Top rank reached'}>
                <span className="tl-avatar" style={{ background: (THEMES.find(t => t.id === cosmetics.active) ?? THEMES[0]).bg, padding: 0, overflow: 'hidden' }}><PilotAvatar cfg={avatar} size={38} /></span>
                <span className="tl-player-text">
                  <span className="tl-player-name">{callsign}</span>
                  <span className="tl-player-rank">{getRank()}</span>
                  <span className="tl-xpbar"><span style={{ width: `${Math.max(pct, 4)}%` }} /></span>
                </span>
              </div>
            );
          })()}

          <div className="tl-stat tl-stat--xp" title="Experience points">
            <Award size={15} />
            <span>{score} XP</span>
          </div>

          <div className="tl-stat tl-stat--coin" title="Coins">
            <Coins size={15} />
            <span>{coins}</span>
          </div>

          <button
            className={`tl-icon-btn${audioMuted ? ' is-muted' : ''}`}
            onClick={toggleAudio}
            title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>

      {/* DASHBOARD - ACTIVE ORBITAL RECONNAISSANCE DIRECTIVES */}
      {activeTab === 'dashboard' && (
        <div style={{
          flex: 1,
          padding: '16px 36px 28px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
          gap: '18px'
        }}>
          {/* 2. MAIN WORKSPACE: LEFT PILOT DOSSIER + RIGHT TACTICAL MISSION DOSSIER */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: '24px',
            alignItems: 'stretch'
          }}>
            {/* LEFT COLUMN: ENRICHED PILOT DOSSIER HUD CARD */}
            <div className="tl-acard" data-tag="GUEST" style={{
              ['--ac' as string]: '#9D4EDD',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              gap: '16px'
            } as React.CSSProperties}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: '#e2e8f0',
                  letterSpacing: '1.2px'
                }}>
                  <span className="tl-gsub">PILOT PROFILE</span>
                </span>
              </div>

              {/* Center Radar Scanner with Avatar */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '4px 0 10px 0' }}>
                <div style={{
                  position: 'relative',
                  width: '136px',
                  height: '136px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: '1.5px solid rgba(0, 240, 255, 0.45)',
                    boxShadow: '0 0 20px rgba(0, 240, 255, 0.25)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: '12px',
                    borderRadius: '50%',
                    border: '1px dashed rgba(0, 240, 255, 0.35)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: '24px',
                    borderRadius: '50%',
                    border: '1px solid rgba(0, 240, 255, 0.25)'
                  }} />
                  <div style={{ position: 'absolute', width: '100%', height: '1px', backgroundColor: 'rgba(0, 240, 255, 0.45)' }} />
                  <div style={{ position: 'absolute', height: '100%', width: '1px', backgroundColor: 'rgba(0, 240, 255, 0.45)' }} />

                  <div className="tl-sweep" />
                  {/* Character Avatar */}
                  <div style={{ position: 'relative', borderRadius: '50%', boxShadow: '0 0 18px rgba(157, 78, 221, 0.6)' }}>
                    <PilotAvatar cfg={avatar} size={90} ring />
                  </div>
                </div>
              </div>

              {/* Callsign & Rank */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#00F0FF', letterSpacing: '1px' }}>
                  CALLSIGN
                </div>
                <div style={{
                  fontWeight: 400,

                  letterSpacing: '0.6px',
                  marginTop: '1px',
                  textShadow: '0 3px 0 #1d4ed8',
                  fontFamily: "'Bagel Fat One', cursive, sans-serif",
                  fontSize: '22px',
                  color: '#FDF5CC'
                }}>
                  {callsign}
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginTop: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.4)',
                  color: '#fbbf24',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  fontFamily: 'monospace'
                }}>
                  <span>★</span>
                  <span>{getRank()}</span>
                </div>
                <div className="tl-flame" style={{ marginTop: '6px', fontSize: '11.5px', fontWeight: 700, color: '#fb923c' }}>
                  🔥 {fun.streak.count}-day streak
                </div>
                <button className="tl-btn3d" onClick={() => setEditorOpen(true)} style={{ marginTop: '12px', padding: '6px 18px', cursor: 'pointer', fontSize: '14px' }}>✎ CUSTOMISE LOOK</button>
              </div>

              {/* Mission Clearance Matrix */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '10px',
                borderRadius: '10px',
                backgroundColor: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(51, 65, 85, 0.45)'
              }}>
                {([
                  ['MISSIONS DONE', `${journal.length} / 3`, '#38bdf8'],
                  ['COINS', `${coins} 🪙`, '#fbbf24'],
                  ['BEST SCORE', journal.length ? `${Math.max(...journal.map(j => j.score))}%` : '—', '#34d399'],
                  ['CONCLUSIONS', String(Object.values(notes).filter(n => n.text).length), '#f8fafc'],
                ] as [string, string, string][]).map(([k, v, c]) => (
                  <div key={k}>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontFamily: 'monospace' }}>{k}</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: c, fontFamily: 'monospace' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* XP bar toward the next rank */}
              {(() => {
                const next = api.RANKS.find(r => r.minXp > score);
                const prev = [...api.RANKS].reverse().find(r => r.minXp <= score) ?? api.RANKS[0];
                const pct = next ? ((score - prev.minXp) / (next.minXp - prev.minXp)) * 100 : 100;
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'monospace', marginBottom: '5px' }}>
                      <span style={{ color: '#00F0FF', fontWeight: 700 }}>{next ? `NEXT RANK: ${next.title.toUpperCase()}` : 'TOP RANK'}</span>
                      <span style={{ color: '#cbd5e1' }}>{score}{next ? ` / ${next.minXp}` : ''} XP</span>
                    </div>
                    <div style={{ width: '100%', height: '9px', borderRadius: '5px', backgroundColor: 'rgba(30, 41, 59, 0.8)', overflow: 'hidden' }}>
                      <div className="tl-xpfill" style={{ width: `${Math.max(4, Math.min(100, pct))}%`, height: '100%', background: 'linear-gradient(90deg, #00F0FF, #9D4EDD)', boxShadow: '0 0 10px rgba(0,240,255,0.6)', borderRadius: '5px', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'right', marginTop: '4px' }}>
                      {score < 100 ? `${100 - score} XP to unlock Mission 02` : score < 250 ? `${250 - score} XP to unlock Mission 03` : 'All missions unlocked'}
                    </div>
                  </div>
                );
              })()}

              {/* Medals: earned from real progress */}
              {(() => {
                const done = (id: number) => journal.some(j => j.missionId === String(id));
                const list = [
                  { t: 'Mission 1', ok: done(1), c: '#38bdf8' },
                  { t: 'Mission 2', ok: done(2), c: '#fbbf24' },
                  { t: 'Mission 3', ok: done(3), c: '#c084fc' },
                  { t: 'Perfect score', ok: journal.some(j => j.score === 100), c: '#34d399' },
                  { t: 'Conclusion', ok: Object.values(notes).some(n => n.text), c: '#f472b6' },
                ];
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 8px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(51, 65, 85, 0.4)', marginTop: 'auto' }}>
                    {list.map(m => (
                      <div key={m.t} title={m.ok ? `${m.t}: earned` : `${m.t}: not earned yet`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: m.ok ? 1 : 0.35, width: '20%' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: m.ok ? m.c : '#475569', border: '1.5px solid rgba(255,255,255,0.5)', boxShadow: m.ok ? `0 0 10px ${m.c}` : 'none', display: 'grid', placeItems: 'center', fontSize: '10px', color: '#060913' }}>★</div>
                        <div style={{ fontSize: '8.5px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.15 }}>{m.t}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* RIGHT COLUMN: TACTICAL MISSION DOSSIER (EXACT MATCH TO MOCKUP) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 800,
                fontFamily: 'monospace',
                color: '#e2e8f0',
                letterSpacing: '1.2px'
              }}>
                <span className="tl-gtitle"><span className="tl-spark">✦</span> CHOOSE YOUR MISSION <span className="tl-spark" style={{ animationDelay: '0.8s' }}>✦</span></span>
              </div>

              {/* 3 Mission Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                alignItems: 'stretch'
              }}>
                {/* ── CARD 01: THE CHANGING JAMUNA RIVER (ACTIVE CYAN GLOW) ── */}
                <div className="tl-mcard" style={{
                  position: 'relative',
                  borderRadius: '20px',
                  padding: '20px',
                  backgroundColor: 'rgba(10, 20, 42, 0.82)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '2px solid #00F0FF',
                  boxShadow: '0 0 28px rgba(0, 240, 255, 0.4), inset 0 0 20px rgba(0, 240, 255, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  {/* Top Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#00F0FF', boxShadow: '0 0 6px #00F0FF' }} />
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, color: '#00F0FF', letterSpacing: '0.8px' }}>
                        MISSION 01
                      </span>
                    </div>
                    <span style={{ color: '#00F0FF', cursor: 'pointer', fontSize: '13px' }}>⚙</span>
                  </div>

                  {/* Satellite Radar Braided River Thumbnail with Banner */}
                  <div className="tl-scan" style={{
                    position: 'relative',
                    width: '100%',
                    height: '190px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid rgba(0, 240, 255, 0.35)',
                    backgroundColor: '#040914'
                  }}>
                    <img
                      src={thumbUrl(1)}
                      alt="SAR Radar Braided River Waters"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: 'contrast(1.15) brightness(0.95)'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '5px 8px',
                      backgroundColor: 'rgba(5, 12, 28, 0.88)',
                      backdropFilter: 'blur(4px)',
                      borderTop: '1px solid rgba(0, 240, 255, 0.25)',
                      fontSize: '9.5px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#cbd5e1',
                      letterSpacing: '0.5px',
                      textAlign: 'center'
                    }}>
                      SENTINEL-1 RADAR · 16 JUL 2024 · JAMUNA
                    </div>
                  </div>

                  {/* Mission Info */}
                  <div style={{ marginTop: '2px' }}>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00F0FF', fontWeight: 700, letterSpacing: '0.8px' }}>
                      MISSION 01:
                    </div>
                    <h3 className="tl-mtitle" style={{
                      fontSize: '18px',
                      fontWeight: 900,
                      color: '#ffffff',
                      margin: '2px 0 0 0',
                      letterSpacing: '0.5px',
                      lineHeight: '1.25'
                    }}>
                      THE CHANGING<br />JAMUNA RIVER
                    </h3>
                  </div>

                  {/* Launch Button */}
                  <button
                    className="tl-btn3d tl-launch"
                    onClick={() => handleLaunchMission(jamunaMission)}
                    style={{
                      marginTop: 'auto',
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: '#00F0FF',
                      color: '#060913',
                      fontWeight: 900,
                      fontSize: '13px',
                      letterSpacing: '1px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 20px rgba(0, 240, 255, 0.55)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 28px rgba(0, 240, 255, 0.8)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.55)'; }}
                  >
                    LAUNCH MISSION
                  </button>
                </div>

                {/* ── CARD 02: BRAHMAPUTRA FLOOD SURGE (AMBER ACCENTS) ── */}
                <div className="tl-mcard" style={{
                  position: 'relative',
                  borderRadius: '20px',
                  padding: '20px',
                  backgroundColor: 'rgba(10, 20, 42, 0.65)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: isAssamUnlocked ? '2px solid #fbbf24' : '1px solid rgba(56, 189, 248, 0.25)',
                  boxShadow: isAssamUnlocked ? '0 0 24px rgba(251, 191, 36, 0.3)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  {/* Top Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#64748b' }} />
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.8px' }}>
                        MISSION 02
                      </span>
                    </div>
                    <span style={{ color: '#fbbf24', fontSize: '13px' }}>🔒</span>
                  </div>

                  {/* Dark Locked Preview Box with Centered Amber Lock */}
                  <div className={isAssamUnlocked ? 'tl-scan' : undefined} style={{
                    width: '100%',
                    height: '190px',
                    borderRadius: '12px',
                    border: '1px solid rgba(51, 65, 85, 0.4)',
                    backgroundColor: 'rgba(4, 9, 22, 0.85)',
                    backgroundImage: isAssamUnlocked ? `url("${thumbUrl(2)}")` : `linear-gradient(rgba(4,9,22,0.72), rgba(4,9,22,0.82)), url("${thumbUrl(2)}")`,
                    filter: isAssamUnlocked ? 'none' : 'grayscale(1)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      visibility: isAssamUnlocked ? 'hidden' : 'visible',
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(251, 191, 36, 0.12)',
                      border: '1.5px solid rgba(251, 191, 36, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fbbf24',
                      boxShadow: '0 0 16px rgba(251, 191, 36, 0.2)'
                    }}>
                      <Lock size={22} color="#fbbf24" strokeWidth={2.2} />
                    </div>
                    <span style={{
                      fontSize: '11.5px',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: '#fbbf24',
                      letterSpacing: '0.6px'
                    }}>
                      {isAssamUnlocked ? '' : '100 XP REQUIRED'}
                    </span>
                  </div>

                  {/* Mission Info */}
                  <div style={{ marginTop: '2px' }}>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: isAssamUnlocked ? '#fbbf24' : '#64748b', fontWeight: 700, letterSpacing: '0.8px' }}>
                      MISSION 02:
                    </div>
                    <h3 className="tl-mtitle" style={{
                      fontSize: '18px',
                      fontWeight: 900,
                      color: isAssamUnlocked ? '#ffffff' : '#94a3b8',
                      margin: '2px 0 0 0',
                      letterSpacing: '0.5px',
                      lineHeight: '1.25'
                    }}>
                      BRAHMAPUTRA<br />FLOOD SURGE
                    </h3>
                  </div>

                  {/* Button */}
                  <button
                    disabled={!isAssamUnlocked}
                    className={isAssamUnlocked ? 'tl-btn3d tl-launch' : 'tl-btn3d tl-btn3d--locked'}
                    onClick={() => handleLaunchMission(assamMission)}
                    style={{
                      marginTop: 'auto',
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: isAssamUnlocked ? '#fbbf24' : 'rgba(15, 23, 42, 0.75)',
                      color: isAssamUnlocked ? '#060913' : '#64748b',
                      fontWeight: 800,
                      fontSize: '12px',
                      letterSpacing: '0.8px',
                      border: isAssamUnlocked ? 'none' : '1px solid rgba(51, 65, 85, 0.6)',
                      cursor: isAssamUnlocked ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'monospace'
                    }}
                  >
                    {isAssamUnlocked ? 'LAUNCH MISSION' : '100 XP REQUIRED'}
                  </button>
                </div>

                {/* ── CARD 03: AMAZON WETLAND DYNAMICS (PURPLE ACCENTS) ── */}
                <div className="tl-mcard" style={{
                  position: 'relative',
                  borderRadius: '20px',
                  padding: '20px',
                  backgroundColor: 'rgba(10, 20, 42, 0.65)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: isAmazonUnlocked ? '2px solid #c084fc' : '1px solid rgba(192, 132, 252, 0.35)',
                  boxShadow: isAmazonUnlocked ? '0 0 24px rgba(192, 132, 252, 0.3)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  {/* Top Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#c084fc' }} />
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, color: '#c084fc', letterSpacing: '0.8px' }}>
                        MISSION 03
                      </span>
                    </div>
                    <span style={{ color: '#c084fc', fontSize: '13px' }}>🔒</span>
                  </div>

                  {/* Dark Locked Preview Box with Centered Amber Lock */}
                  <div className={isAmazonUnlocked ? 'tl-scan' : undefined} style={{
                    width: '100%',
                    height: '190px',
                    borderRadius: '12px',
                    border: '1px solid rgba(192, 132, 252, 0.2)',
                    backgroundColor: 'rgba(4, 9, 22, 0.85)',
                    backgroundImage: isAmazonUnlocked ? `url("${thumbUrl(3)}")` : `linear-gradient(rgba(4,9,22,0.72), rgba(4,9,22,0.82)), url("${thumbUrl(3)}")`,
                    filter: isAmazonUnlocked ? 'none' : 'grayscale(1)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      visibility: isAmazonUnlocked ? 'hidden' : 'visible',
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(251, 191, 36, 0.12)',
                      border: '1.5px solid rgba(251, 191, 36, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fbbf24',
                      boxShadow: '0 0 16px rgba(251, 191, 36, 0.2)'
                    }}>
                      <Lock size={22} color="#fbbf24" strokeWidth={2.2} />
                    </div>
                  </div>

                  {/* Mission Info */}
                  <div style={{ marginTop: '2px' }}>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#c084fc', fontWeight: 700, letterSpacing: '0.8px' }}>
                      MISSION 03:
                    </div>
                    <h3 className="tl-mtitle" style={{
                      fontSize: '18px',
                      fontWeight: 900,
                      color: isAmazonUnlocked ? '#ffffff' : '#94a3b8',
                      margin: '2px 0 0 0',
                      letterSpacing: '0.5px',
                      lineHeight: '1.25'
                    }}>
                      AMAZON WETLAND<br />DYNAMICS
                    </h3>
                  </div>

                  {/* Button */}
                  <button
                    disabled={!isAmazonUnlocked}
                    className={isAmazonUnlocked ? 'tl-btn3d tl-launch' : 'tl-btn3d tl-btn3d--locked'}
                    onClick={() => handleLaunchMission(amazonMission)}
                    style={{
                      marginTop: 'auto',
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: isAmazonUnlocked ? '#c084fc' : 'rgba(15, 23, 42, 0.75)',
                      color: isAmazonUnlocked ? '#060913' : '#64748b',
                      fontWeight: 800,
                      fontSize: '12px',
                      letterSpacing: '0.8px',
                      border: isAmazonUnlocked ? 'none' : '1px solid rgba(192, 132, 252, 0.25)',
                      cursor: isAmazonUnlocked ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Lock size={15} color="#64748b" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARCADE: mini-games, streak and personal bests */}
      {activeTab === 'arcade' && (
        <div style={{ flex: 1, position: 'relative', zIndex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{ maxWidth: '980px', margin: '0 auto 18px', display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
            <span className="tl-gtitle" style={{ fontSize: '34px' }}><span className="tl-spark">✦</span> ARCADE <span className="tl-spark" style={{ animationDelay: '0.8s' }}>✦</span></span>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>Quick games with real radar. Beat your own bests.</span>
          </div>
          <div style={{ maxWidth: '980px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SpotTheFlood
                best={fun.bestSpot}
                onPick={right => (right ? sound.playSuccessChime() : sound.playRadarPing())}
                onFinish={sc => setFun(f => (sc > f.bestSpot ? { ...f, bestSpot: sc } : f))}
              />
              <div className="tl-acard" data-tag="60 SECONDS" style={{ ['--ac' as string]: '#FF9E25' } as React.CSSProperties}>
                <div className="tl-gsub" style={{ fontSize: '21px', marginBottom: '6px' }}>⚡ SPEED ROUND</div>
                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '10px' }}>60 seconds on the live radar map. Tap new water, build a combo. It runs inside the Radar Lab of the mission you have open ({currentMission.name}).</div>
                <button onClick={() => { setBriefingOpen(false); setActiveTab('lab'); sound.playRadarPing(); }} className="tl-btn3d" style={{ padding: '10px 22px', cursor: 'pointer' }}>GO TO THE RADAR LAB →</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="tl-acard" style={{ ['--ac' as string]: '#FF4365', textAlign: 'center' } as React.CSSProperties}>
                <div className="tl-flame" style={{ fontSize: '48px', lineHeight: 1 }}>🔥</div>
                <div style={{ fontFamily: "'Bagel Fat One', cursive, sans-serif", fontSize: '32px', color: '#FDF5CC', textShadow: '0 3px 0 #c2410c' }}>{fun.streak.count}-DAY STREAK</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', margin: '8px 0' }}>
                  {Array.from({ length: 7 }, (_, d) => (
                    <span key={d} title={`Day ${d + 1}`} style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', background: d < Math.min(7, fun.streak.count) ? '#FF9E25' : '#1e293b', border: '2px solid rgba(255,255,255,0.15)', color: '#060913', fontWeight: 800 }}>{d < Math.min(7, fun.streak.count) ? '✓' : ''}</span>
                  ))}
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Come back tomorrow to keep it going.</div>
              </div>
              <div className="tl-acard" style={{ ['--ac' as string]: '#FFD166' } as React.CSSProperties}>
                <div className="tl-gsub" style={{ fontSize: '21px' }}>🏆 HIGH SCORES</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>Saved on this device only.</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#e2e8f0' }}>
                  <thead><tr style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '10px', textAlign: 'left' }}><th style={{ padding: '4px 0' }}>MISSION</th><th>QUIZ</th><th>SPEED</th></tr></thead>
                  <tbody>
                    {missions.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid #1e293b' }}>
                        <td style={{ padding: '7px 0' }}>{m.missionNumber} · {m.name}</td>
                        <td style={{ color: '#34d399', fontFamily: 'monospace' }}>{fun.bestScore[String(m.id)] !== undefined ? `${fun.bestScore[String(m.id)]}%` : '—'}</td>
                        <td style={{ color: '#fb923c', fontFamily: 'monospace' }}>{fun.bestSpeed[String(m.id)] !== undefined ? `${fun.bestSpeed[String(m.id)]} pts` : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid #1e293b' }}><td style={{ padding: '7px 0' }}>Spot the Flood</td><td colSpan={2} style={{ color: '#00F0FF', fontFamily: 'monospace' }}>{fun.bestSpot} / 6</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EARTH EXPLORER */}
      {activeTab === 'explorer' && (
        <div style={{ flex: 1, display: 'flex', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
          <div style={{
            width: '360px',
            backgroundColor: 'rgba(11, 17, 32, 0.9)',
            borderRight: '1px solid rgba(51, 65, 85, 0.5)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 10,
            overflowY: 'auto'
          }}>
            <div>
              <h3 className="tl-gtitle" style={{ fontSize: '24px', margin: '0 0 6px 0' }}>✦ GLOBAL DISPATCHES ✦</h3>
              <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: 0 }}>
                Pick a hotspot to launch a radar mission, or hunt the glowing ? signals.
              </p>
            </div>

            {(() => {
              const total = Object.keys(MYSTERY_QUIZ).length;
              const got = Object.keys(MYSTERY_QUIZ).filter(k => fun.mystery[k]?.done).length;
              return (
                <div className="tl-acard" data-tag={fun.explorerBonus ? '★ WORLD EXPLORER ★' : 'SIGNAL HUNT'} style={{ ['--ac' as string]: '#fbbf24', padding: '14px 16px' } as React.CSSProperties}>
                  <div className="tl-gsub" style={{ fontSize: '15px', marginBottom: '8px' }}>SIGNALS DECODED {got}/{total}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {Array.from({ length: total }, (_, i) => (
                      <div key={i} style={{ flex: 1, height: '12px', borderRadius: '8px', border: '2px solid #FDF5CC', background: i < got ? 'linear-gradient(90deg,#fbbf24,#fb923c)' : 'rgba(15,23,42,0.8)', boxShadow: i < got ? '0 0 10px rgba(251,191,36,0.7)' : 'none', transition: 'background .4s' }} />
                    ))}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '8px', lineHeight: 1.45 }}>
                    {fun.explorerBonus ? 'You found every signal. Bonus +100 XP collected.' : `Decode all ${total} to earn the World Explorer badge and +${EXPLORER_BONUS_XP} XP.`}
                  </div>
                </div>
              );
            })()}

            <input
              value={exploreQuery}
              onChange={e => setExploreQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                const hit = missions.find(m => `${m.name} ${m.locationName}`.toLowerCase().includes(exploreQuery.trim().toLowerCase()));
                if (hit && exploreQuery.trim()) { setExploreSel(String(hit.id)); setExploreFocus({ lng: hit.coordinates[0], lat: hit.coordinates[1], zoom: 7, nonce: Date.now() }); }
              }}
              placeholder="Search a river, region or mission…"
              aria-label="Search missions"
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: 'rgba(15,23,42,0.8)', color: '#f8fafc', fontSize: '12.5px', outline: 'none' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {missions.filter(m => `${m.name} ${m.locationName}`.toLowerCase().includes(exploreQuery.trim().toLowerCase())).map(m => {
                const isUnlocked = m.id === 1 || (m.id === 2 && isAssamUnlocked) || (m.id === 3 && isAmazonUnlocked);
                return (
                  <div
                    key={m.id}
                    className="tl-acard"
                    data-tag={isUnlocked ? 'READY' : `🔒 ${m.id === 2 ? '100' : '250'} XP`}
                    onClick={() => {
                      setExploreSel(String(m.id));
                      setExploreFocus({ lng: m.coordinates[0], lat: m.coordinates[1], zoom: 7, nonce: Date.now() });
                    }}
                    style={{
                      ['--ac' as string]: isUnlocked ? (m.id === 1 ? '#FF4365' : m.id === 2 ? '#FF9E25' : '#9D4EDD') : '#475569',
                      padding: '16px',
                      cursor: isUnlocked ? 'pointer' : 'not-allowed',
                      opacity: isUnlocked ? 1 : 0.6,
                      filter: isUnlocked ? 'none' : 'grayscale(0.8)',
                      transform: exploreSel === String(m.id) ? 'translateY(-3px) scale(1.02)' : undefined,
                    } as React.CSSProperties}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: isUnlocked ? '#38bdf8' : '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
                        MISSION 0{m.id}
                      </span>
                      {isUnlocked ? (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                          READY
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#94a3b8' }}>
                          <Lock size={11} /> {m.id === 2 ? '100 XP' : '250 XP'}
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', margin: '0 0 4px 0' }}>{m.name}</h4>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{m.locationName}</div>
                    {isUnlocked && exploreSel === String(m.id) && (
                      <button
                        onClick={e => { e.stopPropagation(); handleLaunchMission(m); }}
                        className="tl-btn3d" style={{ marginTop: '12px', width: '100%', padding: '8px', cursor: 'pointer' }}
                      >LAUNCH MISSION →</button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5, borderTop: '1px solid #334155', paddingTop: '12px' }}>
              <span style={{ color: '#fbbf24', fontWeight: 800 }}>? Mystery signals</span> hide bonus radar challenges. Tap one on the map. Full missions for these regions are not built yet.
            </div>
            {exploreWin && <Confetti />}
            {exploreSel && MYSTERY_QUIZ[exploreSel] && (() => {
              const qz = MYSTERY_QUIZ[exploreSel];
              const st = fun.mystery[exploreSel] ?? {};
              const patch = (v: { unlocked?: boolean; done?: boolean }) => setFun(f => ({ ...f, mystery: { ...f.mystery, [exploreSel]: { ...f.mystery[exploreSel], ...v } } }));
              return (
                <div className="tl-acard" data-tag={st.done ? '✓ DECODED' : '? MYSTERY'} style={{ ['--ac' as string]: st.done ? '#34d399' : '#fbbf24', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' } as React.CSSProperties}>
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#fbbf24' }}>? MYSTERY SIGNAL · BONUS CHALLENGE</div>
                  {!st.unlocked ? (
                    <>
                      <div style={{ fontSize: '12.5px', color: '#e2e8f0' }}>Decode this signal for {MYSTERY_COST} coins. A correct answer gives +{MYSTERY_XP} XP.</div>
                      <button
                        disabled={coins < MYSTERY_COST}
                        onClick={() => api.spendCoins(MYSTERY_COST).then(p => { setCoins(p.coins); patch({ unlocked: true }); sound.playSuccessChime(); }).catch(() => {})}
                        className={coins < MYSTERY_COST ? 'tl-btn3d tl-btn3d--locked' : 'tl-btn3d'} style={{ padding: '8px', cursor: coins < MYSTERY_COST ? 'not-allowed' : 'pointer' }}
                      >{coins < MYSTERY_COST ? `Need ${MYSTERY_COST - coins} more coins` : `Decode (${MYSTERY_COST} coins)`}</button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{qz.q}</div>
                      {qz.options.map((o, i) => {
                        const shown = st.done || mysteryPick !== null;
                        return (
                          <button key={o} disabled={shown}
                            onClick={() => {
                              setMysteryPick(i);
                              if (i === qz.correct) {
                                patch({ done: true });
                                const allDone = Object.keys(MYSTERY_QUIZ).every(k => k === exploreSel || fun.mystery[k]?.done);
                                const bonus = allDone && !fun.explorerBonus ? EXPLORER_BONUS_XP : 0;
                                api.awardXp(MYSTERY_XP + bonus).then(() => setScore(sc => sc + MYSTERY_XP + bonus)).catch(() => {});
                                if (bonus) { setFun(f => ({ ...f, explorerBonus: true })); setExploreWin(true); window.setTimeout(() => setExploreWin(false), 4500); playRankUp(); }
                                else sound.playSuccessChime();
                              }
                              else sound.playRadarPing();
                            }}
                            style={{ textAlign: 'left', padding: '8px 10px', borderRadius: '8px', fontSize: '12.5px', cursor: shown ? 'default' : 'pointer', background: 'rgba(15,23,42,0.7)', color: shown && i === qz.correct && st.done ? '#34d399' : mysteryPick === i ? '#f87171' : '#cbd5e1', border: `1px solid ${shown && i === qz.correct && st.done ? '#34d399' : mysteryPick === i ? '#f87171' : '#334155'}` }}>
                            {o}
                          </button>
                        );
                      })}
                      {st.done && <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5 }}><strong style={{ color: '#34d399' }}>Decoded.</strong> {qz.why}{mysteryPick !== null && <span style={{ color: '#fbbf24' }}> +{MYSTERY_XP} XP</span>}</div>}
                      {!st.done && mysteryPick !== null && <button onClick={() => setMysteryPick(null)} style={{ padding: '6px', borderRadius: '6px', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', fontSize: '11.5px', cursor: 'pointer' }}>Not quite. Try again</button>}
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <WorldMap
              selectedId={exploreSel}
              focus={exploreFocus}
              markers={[
                ...missions.map((m): WorldMarker => ({
                  id: String(m.id), lng: m.coordinates[0], lat: m.coordinates[1],
                  label: `Mission 0${m.id}: ${m.name}`,
                  kind: (m.id === 1 || (m.id === 2 && isAssamUnlocked) || (m.id === 3 && isAmazonUnlocked)) ? 'mission' : 'locked',
                })),
                { id: 'm-mekong', lng: 105.8, lat: 10.0, label: 'Mystery signal: bonus challenge', kind: fun.mystery['m-mekong']?.done ? 'decoded' : 'mystery' },
                { id: 'm-indus', lng: 68.3, lat: 27.0, label: 'Mystery signal: bonus challenge', kind: fun.mystery['m-indus']?.done ? 'decoded' : 'mystery' },
                { id: 'm-niger', lng: -4.2, lat: 14.5, label: 'Mystery signal: bonus challenge', kind: fun.mystery['m-niger']?.done ? 'decoded' : 'mystery' },
              ]}
              onMarkerClick={id => {
                setExploreSel(id);
                const m = missions.find(x => String(x.id) === id);
                if (m) setExploreFocus({ lng: m.coordinates[0], lat: m.coordinates[1], zoom: 7, nonce: Date.now() });
              }}
            />
          </div>
        </div>
      )}

      {/* RADAR LAB - IMMERSIVE FULL-SCREEN HUD */}
      {activeTab === 'lab' && (
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', gap: '12px', padding: '12px', overflow: 'hidden' }}>

          {/* LEFT COLUMN: controls → live stats → map → timeline, stacked so nothing can overlap */}
          <div className="tl-lab-col" style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>

          {/* 1. MAP CARD (fills the space left between the control bars) */}
          <div className="tl-labmap" style={{
            position: 'relative',
            order: 3,
            flex: 1,
            minHeight: '260px',
            borderRadius: '14px',
            overflow: 'hidden',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55)'
          }}>
            <RadarMap
              coordinates={s1?.center ?? currentMission.coordinates}
              zoom={s1?.zoom ?? currentMission.zoom}
              showFloodLayer={showFloodLayer && !maskHiddenForTask}
              showImpactLayer={showImpactLayer}
              timelineIndex={timelineIndex}
              radarBand={radarBand}
              marks={marks}
              markRadiusM={api.MARK_RADIUS_M}
              markMode={markPhase === 'placing' || !!speed?.active}
              onMapClick={handleMapClick}
              s1={s1}
              stageStats={stageStats}
              overlay={s1Active ? analysis.data?.overlays[timelineIndex] ?? null : null}
              analysisStatus={analysis.status}
            />

            {/* FUN FEATURE 1: ANIMATED RADAR PULSE SWEEP OVERLAY */}
            {activeRadarSweep && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '600px',
                height: '600px',
                borderRadius: '50%',
                border: '3px solid #00F0FF',
                boxShadow: '0 0 60px rgba(0, 240, 255, 0.8), inset 0 0 60px rgba(0, 240, 255, 0.4)',
                pointerEvents: 'none',
                zIndex: 15,
                animation: 'pulse 1.8s infinite ease-out',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '300px',
                  height: '300px',
                  borderRadius: '50%',
                  border: '2px dashed rgba(0, 240, 255, 0.6)',
                  animation: 'spin 4s linear infinite'
                }} />
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  backgroundColor: 'rgba(5, 15, 36, 0.9)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #00F0FF',
                  color: '#00F0FF',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  fontWeight: 800
                }}>
                  SCANNING SECTOR: 100% SPECULAR RETURN
                </div>
              </div>
            )}

            {/* FUN FEATURE 2: TACTICAL FIELD RADIO TRANSCEIVER CARD */}
            {radioDispatchOpen && (
              <div style={{
                position: 'absolute',
                top: '48px',
                left: '12px',
                width: '380px',
                maxWidth: 'calc(100% - 24px)',
                backgroundColor: 'rgba(7, 17, 38, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1.5px solid #fbbf24',
                borderRadius: '12px',
                padding: '16px',
                zIndex: 25,
                boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 20px rgba(251, 191, 36, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Radio size={16} color="#fbbf24" />
                    <span style={{ fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 800, color: '#fbbf24', letterSpacing: '1px' }}>
                      FIELD TRANSCEIVER // FREQ 142.85 MHz
                    </span>
                  </div>
                  <button
                    onClick={() => setRadioDispatchOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(251, 191, 36, 0.25)'
                }}>
                  <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700, marginBottom: '4px' }}>
                    FROM: {radioDispatches[radioMessageIdx].sender}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#f8fafc', lineHeight: '1.45', fontStyle: 'italic' }}>
                    {radioDispatches[radioMessageIdx].text}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      sound.playRadarPing();
                      setRadioMessageIdx((prev) => (prev + 1) % radioDispatches.length);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(251, 191, 36, 0.2)',
                      border: '1px solid #fbbf24',
                      color: '#fbbf24',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    NEXT COMM CHANNEL ❯
                  </button>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#64748b' }}>
                    SIGNAL: 5/5 BARS
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. TOP FLOATING HUD CONTROL BAR */}
          <div className="tl-hud tl-labcard" style={{
            order: 1,
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: 'rgba(5, 15, 36, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
            gap: '8px 12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
              <Compass size={14} color="#00F0FF" />
              <span style={{ color: '#f8fafc', fontWeight: 700 }}>{currentMission.locationName}</span>
              <span style={{ color: '#475569' }}>|</span>
              <span>{Math.abs(currentMission.coordinates[1])}°{currentMission.coordinates[1] < 0 ? 'S' : 'N'}, {Math.abs(currentMission.coordinates[0])}°{currentMission.coordinates[0] < 0 ? 'W' : 'E'}</span>
            </div>

            {/* SENSOR SANDBOX: FREQUENCY SELECTOR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(15, 23, 42, 0.7)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.6)' }}>
              <button
                onClick={() => { setRadarBand('optical'); sound.playRadarPing(); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: radarBand === 'optical' ? '#ef4444' : 'transparent',
                  color: radarBand === 'optical' ? '#fff' : '#94a3b8'
                }}
                title="Optical Sensor (Blocked by Clouds)"
              >
                OPTICAL
              </button>
              <button
                onClick={() => { setRadarBand('c-band'); sound.playRadarPing(); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: radarBand === 'c-band' ? '#00F0FF' : 'transparent',
                  color: radarBand === 'c-band' ? '#060913' : '#94a3b8'
                }}
                title="Sentinel-1 C-Band (Penetrates Clouds)"
              >
                C-BAND SAR
              </button>
              <button
                onClick={() => { setRadarBand('l-band'); sound.playRadarPing(); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: radarBand === 'l-band' ? '#fbbf24' : 'transparent',
                  color: radarBand === 'l-band' ? '#060913' : '#94a3b8'
                }}
                title="NISAR L-Band (Penetrates Forest Canopy)"
              >
                L-BAND (NISAR)
              </button>
            </div>

            {/* LAYER & COMMUNITY TOGGLES */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => { if (!maskHiddenForTask) setShowFloodLayer(!showFloodLayer); }}
                title={maskHiddenForTask ? 'Hidden while you mark changes — check your marks to reveal it' : 'Show or hide the computed water mask'}
                style={{
                  opacity: maskHiddenForTask ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: showFloodLayer ? 'rgba(0, 240, 255, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  color: showFloodLayer ? '#00F0FF' : '#94a3b8',
                  border: `1px solid ${showFloodLayer ? '#00F0FF' : '#334155'}`
                }}
              >
                <Layers size={13} />
                <span>Water Mask</span>
              </button>

              <button
                onClick={() => setShowImpactLayer(!showImpactLayer)}
                style={{
                  display: (s1?.communities.length ?? 0) > 0 ? 'flex' : 'none',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: showImpactLayer ? 'rgba(249, 115, 22, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  color: showImpactLayer ? '#f97316' : '#94a3b8',
                  border: `1px solid ${showImpactLayer ? '#f97316' : '#334155'}`
                }}
              >
                <Users size={13} />
                <span>Communities</span>
              </button>

              {/* EMERGENCY RELIEF BUTTON */}
              <button
                onClick={() => setShowEvacuationModal(true)}
                style={{
                  display: isJamuna ? 'flex' : 'none',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  border: '1px solid #ef4444'
                }}
              >
                <Flame size={13} />
                <span>Relief Action</span>
              </button>

              {/* FUN FEATURE 1: RADAR PULSE SWEEP BUTTON */}
              <button
                onClick={triggerRadarSweep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: activeRadarSweep ? '#00F0FF' : 'rgba(0, 240, 255, 0.18)',
                  color: activeRadarSweep ? '#060913' : '#00F0FF',
                  border: '1px solid #00F0FF',
                  boxShadow: activeRadarSweep ? '0 0 16px #00F0FF' : 'none',
                  transition: 'all 0.2s ease'
                }}
                title="Emit 360° Microwave Radar Pulse over Sirajganj Basin"
              >
                <Zap size={13} />
                <span>Radar Pulse</span>
              </button>

              {/* FUN FEATURE 2: TACTICAL FIELD RADIO TRANSCEIVER */}
              <button
                onClick={() => {
                  sound.playRadarPing();
                  setRadioDispatchOpen(!radioDispatchOpen);
                  if (!radioDispatchOpen) {
                    setRadioMessageIdx((prev) => (prev + 1) % radioDispatches.length);
                  }
                }}
                style={{
                  display: isJamuna ? 'flex' : 'none',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: radioDispatchOpen ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.15)',
                  color: '#fbbf24',
                  border: '1px solid #fbbf24',
                  boxShadow: radioDispatchOpen ? '0 0 16px rgba(251, 191, 36, 0.5)' : 'none',
                  transition: 'all 0.2s ease'
                }}
                title="Tune Into Field Radio Dispatch Comms"
              >
                <Radio size={13} />
                <span>Field Radio</span>
              </button>
            </div>
          </div>

          {/* SAR ANALYSIS STRIP — numbers computed in the browser from the Sentinel-1 scenes */}
          {s1Active && (() => {
            const lbl: React.CSSProperties = { fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' };
            const val = (color: string): React.CSSProperties => ({ fontSize: '12px', fontWeight: 800, color, fontFamily: 'monospace' });
            const cell: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px' };
            const baseDate = timeline[0].date;
            return (
              <div className="tl-ticker tl-labcard" style={{
                order: 2,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'stretch',
                gap: '0',
                minHeight: '36px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid rgba(0,240,255,0.35)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
              }}>
                <div style={{ padding: '0 12px', background: 'linear-gradient(135deg, #0891b2, #0e7490)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#fff', letterSpacing: '1px', whiteSpace: 'nowrap' }}>◉ SAR ANALYSIS</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(10,20,42,0.9)', padding: '7px 14px', gap: '4px 18px' }}>
                  {analysis.status === 'error' && (
                    <span style={{ ...lbl, color: '#f87171' }}>Could not load the Sentinel-1 data (check the internet connection, then reopen the Radar Lab).</span>
                  )}
                  {analysis.status !== 'error' && !stageStats && (
                    <span style={lbl}>Reading Sentinel-1 backscatter and computing the water mask…</span>
                  )}
                  {stageStats && (
                    <>
                      <div style={cell}>
                        <span style={lbl}>{timelineIndex === 0 ? 'BASELINE' : `NEW WATER SINCE ${baseDate}`}</span>
                        <span style={val('#00F0FF')}>{timelineIndex === 0 ? '—' : `${stageStats.newKm2.toFixed(1)} km²`}</span>
                      </div>
                      <div style={cell}>
                        <span style={lbl}>OPEN WATER ON {timeline[timelineIndex].date}</span>
                        <span style={val('#60a5fa')}>{stageStats.waterKm2.toFixed(1)} km²</span>
                      </div>
                      <div style={cell}>
                        <span style={lbl}>STUDY AREA</span>
                        <span style={val('#e2e8f0')}>{Math.round(stageStats.validKm2).toLocaleString()} km²</span>
                      </div>
                      <div style={cell} title="Area is computed in your browser from Sentinel-1 VH backscatter. One fixed threshold, not validated against ground data: smooth dry sand can read as water and flooded vegetation as land.">
                        <span style={lbl}>METHOD</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>{s1?.platform} RTC · VH &lt; {WATER_VH_DB} dB · EXPERIMENTAL{api.API_MODE === 'mock' ? ' · MOCK API' : ''}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* FEATURE A: MISSION UNLOCK TOAST NOTIFICATION */}
          {unlockToast && (
            <div style={{
              position: 'absolute',
              bottom: '130px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              padding: '14px 28px',
              borderRadius: '12px',
              backgroundColor: 'rgba(5, 15, 36, 0.97)',
              border: '2px solid #fbbf24',
              boxShadow: '0 0 40px rgba(251, 191, 36, 0.6)',
              color: '#fbbf24',
              fontSize: '14px',
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              animation: 'pulse 1s infinite'
            }}>
              {unlockToast}
            </div>
          )}

          {/* 3. BOTTOM FLOATING EARTH'S TIMELINE SLIDER DOCK */}
          <div className="tl-labcard" style={{
            order: 4,
            flexShrink: 0,
            padding: '10px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(5, 15, 36, 0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00F0FF', fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, flexShrink: 0 }}>
              <Clock size={16} />
              <span>TIMELINE</span>
            </div>

            <button
              onClick={() => { sound.playRadarPing(); setPlaying(p => !p); }}
              title={playing ? 'Pause the timeline' : 'Play the timeline'}
              style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', border: '1px solid #00F0FF', background: playing ? 'rgba(0,240,255,0.3)' : 'rgba(0,240,255,0.1)', color: '#00F0FF', fontSize: '12px', fontWeight: 800 }}
            >{playing ? '❚❚' : '▶'}</button>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', gap: '8px' }}>
              {timeline.map((item, idx) => {
                const isActive = timelineIndex === idx;
                return (
                  <button
                    key={item.date}
                    onClick={() => {
                      sound.playRadarPing();
                      setPlaying(false);
                      setTimelineIndex(idx);
                    }}
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: isActive ? '1px solid #00F0FF' : '1px solid #334155',
                      backgroundColor: isActive ? 'rgba(0, 240, 255, 0.25)' : 'rgba(30, 41, 59, 0.45)',
                      color: isActive ? '#00F0FF' : '#94a3b8',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontFamily: 'monospace' }}>
                      <Calendar size={10} />
                      <span>{item.date}</span>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: isActive ? '#f8fafc' : '#cbd5e1', marginTop: '2px', lineHeight: 1.25 }}>
                      {item.label}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="tl-timeline-status" style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right', width: '170px', flexShrink: 0, lineHeight: 1.35 }}>
              <div style={{ color: '#00F0FF', fontWeight: 700 }}>{activeTimeline.status}</div>
              <div>{s1Active
                ? (timelineIndex === 0 ? 'Baseline date' : stageStats ? <>New water: <strong style={{ color: '#f8fafc' }}>{stageStats.newKm2.toFixed(1)} km²</strong></> : 'Analysing…')
                : 'Jamuna demo timeline'}</div>
            </div>
          </div>

          </div>
          {/* END LEFT COLUMN */}

          {/* 4. RIGHT INTELLIGENCE & CHALLENGES PANEL (MINIMIZABLE FOR A WIDER MAP) */}
          <aside className="tl-labpanel" style={{
            position: 'relative',
            flexShrink: 0,
            width: labPanelCollapsed ? '44px' : '350px',
            boxSizing: 'border-box',
            borderRadius: '16px',
            backgroundColor: 'rgba(5, 15, 36, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 240, 255, 0.1)',
            padding: labPanelCollapsed ? '12px 6px' : '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            transition: 'width 0.3s ease, padding 0.3s ease',
            overflowY: labPanelCollapsed ? 'hidden' : 'auto'
          }}>
            {/* Collapse/Expand Toggle Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: labPanelCollapsed ? 'none' : '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: labPanelCollapsed ? '0' : '12px' }}>
              {!labPanelCollapsed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={16} color="#00F0FF" />
                  <span className="tl-gsub" style={{ color: '#FDF5CC' }}>
                    ✦ MISSION BOARD ✦
                  </span>
                </div>
              )}
              <button
                onClick={() => setLabPanelCollapsed(!labPanelCollapsed)}
                style={{
                  width: '28px',
                  height: '28px',
                  flexShrink: 0,
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 240, 255, 0.15)',
                  border: '1px solid rgba(0, 240, 255, 0.4)',
                  color: '#00F0FF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: labPanelCollapsed ? '0 auto' : '0'
                }}
                title={labPanelCollapsed ? 'Expand Question Panel' : 'Minimize to 100% Full-Screen Map'}
              >
                {labPanelCollapsed ? '◀' : '▶'}
              </button>
            </div>

            {labPanelCollapsed && (
              <div
                onClick={() => setLabPanelCollapsed(false)}
                title="Open the mission board"
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', cursor: 'pointer' }}
              >
                <span className="tl-gsub" style={{ writingMode: 'vertical-rl', fontSize: '15px', letterSpacing: '2px' }}>
                  {Object.keys(selectedAnswers).length}/{currentMission.challenges.length} QUESTIONS · {score} XP
                </span>
                <span style={{ fontSize: '18px' }}>📋</span>
              </div>
            )}
            {!labPanelCollapsed && (
              <>
                {s1Active && analysis.status === 'loading' && <FactCard />}

                {/* SPEED ROUND */}
                {s1Active && analysis.status === 'ready' && markPhase === 'idle' && (() => {
                  const key = String(currentMission.id);
                  const left = speed?.active ? Math.max(0, Math.ceil((speed.endsAt - Date.now()) / 1000)) : 0;
                  return (
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: speed?.active ? 'rgba(251,146,60,0.12)' : 'rgba(15,23,42,0.65)', border: `1px solid ${speed?.active ? '#fb923c' : '#334155'}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#fb923c' }}>
                        <span>⚡ SPEED ROUND</span><span>BEST {fun.bestSpeed[key] ?? 0} PTS</span>
                      </div>
                      {!speed && (
                        <>
                          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45 }}>60 seconds. Tap as many places with new water as you can. Each hit in a row raises your combo (up to ×5). Hits must be 3 km apart. The mask is hidden.</div>
                          <button onClick={handleStartSpeed} style={{ padding: '9px', borderRadius: '8px', border: 'none', background: 'linear-gradient(90deg, #fb923c, #fbbf24)', color: '#060913', fontWeight: 800, fontSize: '12.5px', cursor: 'pointer' }}>Start speed round</button>
                        </>
                      )}
                      {speed?.active && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'monospace' }}>
                          <span style={{ fontSize: '26px', fontWeight: 800, color: left <= 10 ? '#f87171' : '#f8fafc' }}>{left}s</span>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#fbbf24' }}>{speed.points} pts</span>
                          <span key={speed.combo} className={speed.combo > 1 ? 'tl-pop' : undefined} style={{ fontSize: '15px', fontWeight: 800, color: speed.combo > 1 ? '#fb923c' : '#64748b' }}>×{Math.max(1, speed.combo)} combo</span>
                        </div>
                      )}
                      {speed && !speed.active && (
                        <>
                          <div style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.5 }}>
                            Time! <strong style={{ color: '#fbbf24' }}>{speed.points} points</strong> from {speed.hits} hits in {speed.taps} taps. The mask is now shown so you can compare. Points are for fun and do not add XP.
                          </div>
                          <button onClick={() => { setSpeed(null); resetMarks(); }} style={{ padding: '8px', borderRadius: '8px', background: 'transparent', border: '1px solid #fb923c', color: '#fb923c', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}>Done</button>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* WATER OVER TIME — computed per date from the Sentinel-1 scenes */}
                {s1Active && analysis.data && (() => {
                  const st = analysis.data.stages;
                  const max = Math.max(...st.map(x => x.waterKm2), 1);
                  const W = 300, H = 92, bw = 34, gap = (W - bw * st.length) / (st.length + 1);
                  return (
                    <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(15,23,42,0.65)', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#00F0FF', marginBottom: '6px' }}>WATER OVER TIME (km²)</div>
                      <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" role="img" aria-label="Open water area on each date">
                        {st.map((x, i) => {
                          const h = Math.max(2, (x.waterKm2 / max) * H);
                          const nh = Math.max(0, (x.newKm2 / max) * H);
                          const bx = gap + i * (bw + gap);
                          const on = i === timelineIndex;
                          return (
                            <g key={i} style={{ cursor: 'pointer' }} onClick={() => { setPlaying(false); setTimelineIndex(i); }}>
                              <rect x={bx} y={H - h} width={bw} height={h} rx={3} fill={on ? '#00F0FF' : '#475569'} opacity={on ? 0.9 : 0.8} />
                              {nh > 0 && <rect x={bx} y={H - nh} width={bw} height={nh} rx={3} fill="#f59e0b" opacity={0.9} />}
                              <text x={bx + bw / 2} y={H - h - 3} textAnchor="middle" fontSize="9" fill="#e2e8f0" fontFamily="monospace">{Math.round(x.waterKm2)}</text>
                              <text x={bx + bw / 2} y={H + 12} textAnchor="middle" fontSize="8.5" fill={on ? '#00F0FF' : '#94a3b8'} fontFamily="monospace">{timeline[i].date.slice(5)}</text>
                            </g>
                          );
                        })}
                      </svg>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                        <span style={{ color: '#94a3b8' }}>■</span> open water &nbsp;<span style={{ color: '#f59e0b' }}>■</span> new since {timeline[0].date}. Tap a bar to jump to that date.
                      </div>
                    </div>
                  );
                })()}

                {/* CHANGE DETECTIVE — mark where new water appeared, then compare with the reference map */}
                {s1Active && (
                  <div style={{
                    borderRadius: '10px',
                    border: `1px solid ${markPhase === 'checked' ? (markSummary?.passed ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.5)') : 'rgba(255,209,102,0.45)'}`,
                    background: 'rgba(15, 23, 42, 0.7)',
                    padding: '12px 13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, color: '#FFD166', letterSpacing: '0.8px' }}>
                        ◎ CHANGE DETECTIVE
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        +{api.XP_PER_CORRECT_MARK} XP / correct mark
                      </span>
                    </div>

                    {markPhase === 'idle' && (
                      <>
                        <div style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.5 }}>
                          Use the swipe line to compare the two radar dates. Then mark up to {api.MARKS_ALLOWED} separate places where <strong>new water</strong> appeared. You need {api.MARKS_NEEDED} correct. The water mask stays hidden until you check.
                        </div>
                        <button onClick={handleStartMarking} disabled={analysis.status !== 'ready'} style={{
                          padding: '9px 12px', borderRadius: '8px', border: 'none', fontSize: '12.5px', fontWeight: 800,
                          cursor: analysis.status === 'ready' ? 'pointer' : 'not-allowed',
                          background: analysis.status === 'ready' ? 'linear-gradient(135deg, #FFD166, #ff9f43)' : '#334155',
                          color: analysis.status === 'ready' ? '#1a1200' : '#94a3b8'
                        }}>
                          {analysis.status === 'ready' ? 'Start marking' : analysis.status === 'error' ? 'Reference data unavailable' : 'Loading reference data…'}
                        </button>
                      </>
                    )}

                    {(markPhase === 'placing' || markPhase === 'checking') && (
                      <>
                        <div style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.5 }}>
                          Click the map where water is present on <strong>{timeline[timelineIndex].date}</strong> but not on {timeline[0].date}. Dark = smooth water. Each mark covers a {(api.MARK_RADIUS_M / 1000).toFixed(1)} km circle.
                        </div>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#FFD166' }}>
                          Marks placed: {marks.length} / {api.MARKS_ALLOWED}
                        </div>
                        {markError && <div style={{ fontSize: '12px', color: '#f87171', lineHeight: 1.4 }}>{markError}</div>}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={handleCheckMarks} disabled={!marks.length || markPhase === 'checking'} style={{
                            flex: 1, padding: '9px 12px', borderRadius: '8px', border: 'none', fontSize: '12.5px', fontWeight: 800,
                            cursor: marks.length && markPhase !== 'checking' ? 'pointer' : 'not-allowed',
                            background: marks.length ? 'linear-gradient(135deg, #8dfaff, #00d8f5)' : '#334155',
                            color: marks.length ? '#04121f' : '#94a3b8'
                          }}>
                            {markPhase === 'checking' ? 'Checking…' : 'Check my marks'}
                          </button>
                          <button onClick={() => setMarks([])} disabled={!marks.length || markPhase === 'checking'} style={{
                            padding: '9px 12px', borderRadius: '8px', border: '1px solid #475569', background: 'transparent',
                            color: '#cbd5e1', fontSize: '12.5px', fontWeight: 600, cursor: marks.length ? 'pointer' : 'not-allowed'
                          }}>
                            Clear
                          </button>
                        </div>
                      </>
                    )}

                    {markPhase === 'checked' && markSummary && (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: markSummary.passed ? '#4ade80' : '#f87171' }}>
                          {markSummary.correct} of {marks.length} marks confirmed{markSummary.passed ? ' — change located' : ` — ${api.MARKS_NEEDED} needed`}
                          {markSummary.xp > 0 && <span style={{ color: '#fbbf24', fontFamily: 'monospace', marginLeft: '8px' }}>+{markSummary.xp} XP</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {marks.map((m, i) => (
                            <div key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '12px', lineHeight: 1.4, color: '#cbd5e1' }}>
                              <span style={{ color: m.correct ? '#4ade80' : '#f87171', fontWeight: 800, flexShrink: 0 }}>{m.correct ? '✓' : '✗'} Mark {i + 1}</span>
                              <span>
                                {m.verdict === 'new-water' && `${m.newWaterPercent}% of the circle is new water.`}
                                {m.verdict === 'already-water' && `Mostly water on both dates (${m.alreadyWaterPercent}% river channel, ${m.newWaterPercent}% new).`}
                                {m.verdict === 'no-change' && `Only ${m.newWaterPercent}% of the circle is new water (${Math.round(api.MARK_PASS_FRACTION * 100)}% needed).`}
                                {m.verdict === 'duplicate' && 'New water, but too close to another mark to count as a separate place.'}
                                {m.verdict === 'outside' && 'Outside the dashed study area, so it cannot be checked.'}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.45 }}>
                          The mask is now shown: cyan is new water, blue was water on both dates. The reference is an experimental estimate, not ground truth.
                        </div>
                        <button onClick={handleStartMarking} style={{
                          alignSelf: 'flex-start', padding: '7px 12px', borderRadius: '8px', border: '1px solid #475569',
                          background: 'transparent', color: '#cbd5e1', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                        }}>
                          Try again (no extra XP)
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Mission Status Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc' }}>
                    Question {currentQuestionIndex + 1} of {currentMission.challenges.length}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700 }}>
                    +50 XP
                  </span>
                </div>

                {/* RAINFALL / RIVER CONTEXT: appears when data exists for this mission */}
                {s1Active && [ctx.rainfall, ctx.riverLevel].filter(Boolean).map(series => {
                  const sr = series!;
                  const pts = [...sr.points].sort((a, b) => a.date.localeCompare(b.date));
                  if (pts.length < 2) return null;
                  const t = (d: string) => new Date(d).getTime();
                  const t0 = t(pts[0].date), t1 = t(pts[pts.length - 1].date);
                  const vmax = Math.max(...pts.map(p => p.value), 0.0001), vmin = Math.min(0, ...pts.map(p => p.value));
                  const W = 300, H = 70;
                  const x = (d: string) => t1 === t0 ? 0 : ((t(d) - t0) / (t1 - t0)) * W;
                  const y = (v: number) => H - ((v - vmin) / (vmax - vmin || 1)) * H;
                  return (
                    <div key={sr.label} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(15,23,42,0.65)', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#00F0FF', marginBottom: '6px' }}>{sr.label.toUpperCase()} ({sr.unit})</div>
                      <svg viewBox={`0 0 ${W} ${H + 14}`} width="100%" role="img" aria-label={sr.label}>
                        <polyline fill="none" stroke="#38bdf8" strokeWidth="1.6" points={pts.map(p => `${x(p.date)},${y(p.value)}`).join(' ')} />
                        {timeline.map((st, i) => t(st.date) >= t0 && t(st.date) <= t1 && (
                          <g key={st.date}>
                            <line x1={x(st.date)} x2={x(st.date)} y1={0} y2={H} stroke={i === timelineIndex ? '#00F0FF' : '#475569'} strokeDasharray="3 3" />
                            <text x={x(st.date)} y={H + 11} fontSize="8" textAnchor="middle" fill="#94a3b8" fontFamily="monospace">{st.date.slice(5)}</text>
                          </g>
                        ))}
                      </svg>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Dashed lines = the radar dates. Source: {sr.source}</div>
                    </div>
                  );
                })}

                {/* ROADS / FARMLAND EXPOSURE: appears when layers exist for this mission */}
                {s1Active && (layers.roads || layers.farmland) && (
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(15,23,42,0.65)', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#00F0FF' }}>ROADS AND FARMLAND</div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45 }}>Measure how much of the mapped {[layers.roads && 'road network', layers.farmland && 'farmland'].filter(Boolean).join(' and ')} lies in or next to new water on {timeline[timelineIndex].date}.</div>
                    <button
                      disabled={exposureBusy || timelineIndex === 0 || analysis.status !== 'ready'}
                      onClick={async () => {
                        setExposureBusy(true);
                        try {
                          const check = async (pts: [number, number][], radius: number) => {
                            const step = Math.max(1, Math.ceil(pts.length / 250));
                            const use = pts.filter((_, i) => i % step === 0);
                            const res = await Promise.all(use.map(p => scoreMark(currentMission.id, timelineIndex, p[0], p[1], radius)));
                            const inside = res.filter(r => r.inside);
                            return { n: inside.length, hit: inside.filter(r => r.newWaterFraction >= 0.25).length };
                          };
                          const out: string[] = [];
                          if (layers.roads) {
                            const r = await check(layers.roads.features.flatMap(f => f.coords), 150);
                            out.push(r.n ? `Roads: ${Math.round((r.hit / r.n) * 100)}% of sampled road points (${r.hit} of ${r.n}) are in or next to new water. Source: ${layers.roads.source}.` : 'Roads: none of the road points fall inside the study area.');
                          }
                          if (layers.farmland) {
                            const cents = layers.farmland.features.map(f => [f.ring.reduce((a, p) => a + p[0], 0) / f.ring.length, f.ring.reduce((a, p) => a + p[1], 0) / f.ring.length] as [number, number]);
                            const r = await check(cents, 300);
                            out.push(r.n ? `Farmland: ${Math.round((r.hit / r.n) * 100)}% of sampled fields (${r.hit} of ${r.n}) have new water around them. Source: ${layers.farmland.source}.` : 'Farmland: no fields fall inside the study area.');
                          }
                          out.push('Experimental estimate from radar, not a validated damage count.');
                          setExposure(out);
                        } finally { setExposureBusy(false); }
                      }}
                      style={{ padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 800, fontSize: '12px', cursor: 'pointer', background: timelineIndex === 0 ? '#334155' : '#00F0FF', color: timelineIndex === 0 ? '#94a3b8' : '#060913' }}
                    >{timelineIndex === 0 ? 'Pick a later date first' : exposureBusy ? 'Measuring…' : 'Measure exposure'}</button>
                    {exposure && exposure.map((l, i) => <div key={i} style={{ fontSize: '11.5px', color: '#e2e8f0', lineHeight: 1.5 }}>{l}</div>)}
                  </div>
                )}

                {/* IMPACT + CONCLUSION */}
                {s1Active && (() => {
                  const key = String(currentMission.id);
                  const note = notes[key] ?? {};
                  const comms = s1?.communities ?? [];
                  const box: React.CSSProperties = { padding: '12px 14px', borderRadius: '10px', background: 'rgba(15,23,42,0.65)', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' };
                  const head: React.CSSProperties = { fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#00F0FF' };
                  const giveXp = (xp: number, patch: Notes[string]) => {
                    const next = { ...notes, [key]: { ...note, ...patch } };
                    setNotes(next); saveJson('terralens.notes.v1', next);
                    if (xp > 0) api.awardXp(xp).then(() => setScore(sc => sc + xp)).catch(() => {});
                  };
                  const pick = async (name: string) => {
                    if (impactBusy || analysis.status !== 'ready') return;
                    setImpactBusy(true);
                    try {
                      const rows = await Promise.all(comms.map(async c => {
                        const sc = await scoreMark(currentMission.id, 2, c.coords[0], c.coords[1], 2000);
                        return { name: c.name, pct: Math.round(sc.newWaterFraction * 100) };
                      }));
                      const top = [...rows].sort((a, b) => b.pct - a.pct)[0];
                      const right = top.name === name;
                      setImpactResult({ pick: name, right, rows });
                      if (right && !note.impactDone) giveXp(api.XP_PER_CORRECT, { impactDone: true });
                    } finally { setImpactBusy(false); }
                  };
                  return (
                    <>
                      {comms.length > 0 && (
                        <div style={box}>
                          <div style={head}>IMPACT TASK</div>
                          <div style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.45 }}>
                            Which community has the most new water within 2 km on {timeline[2].date}? The answer is measured from the radar, not looked up.
                          </div>
                          {comms.map(c => (
                            <button key={c.name} disabled={impactBusy || !!impactResult} onClick={() => pick(c.name)}
                              style={{ textAlign: 'left', padding: '9px 12px', borderRadius: '8px', fontSize: '12.5px', cursor: impactResult ? 'default' : 'pointer', color: impactResult?.pick === c.name ? '#00F0FF' : '#cbd5e1', background: 'rgba(15,23,42,0.65)', border: impactResult?.pick === c.name ? '1px solid #00F0FF' : '1px solid #334155' }}>
                              {c.name}
                            </button>
                          ))}
                          {impactResult && (
                            <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                              <strong style={{ color: impactResult.right ? '#34d399' : '#f87171' }}>{impactResult.right ? 'Correct' : 'Not this one'}{impactResult.right && !note.impactDone ? '' : ''}.</strong>{' '}
                              New water within 2 km: {impactResult.rows.map(r => `${r.name} ${r.pct}%`).join(', ')}. Experimental estimate.
                              {impactResult.right && <span style={{ color: '#fbbf24' }}> +{api.XP_PER_CORRECT} XP (first time only)</span>}
                              <div><button onClick={() => setImpactResult(null)} style={{ marginTop: '6px', padding: '4px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer' }}>Try again</button></div>
                            </div>
                          )}
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>Roads and farmland are not included: no verified data for them yet.</div>
                        </div>
                      )}
                      <div style={box}>
                        <div style={head}>YOUR CONCLUSION</div>
                        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
                          placeholder="In 2 or 3 sentences: what changed, where, and how sure are you?"
                          style={{ resize: 'vertical', padding: '8px 10px', borderRadius: '8px', background: 'rgba(6,9,19,0.7)', border: '1px solid #334155', color: '#f8fafc', fontSize: '12.5px', fontFamily: 'inherit' }} />
                        <button
                          disabled={draft.trim().length < 40}
                          onClick={() => giveXp(note.conclusionXp ? 0 : 25, { text: draft.trim(), conclusionXp: true })}
                          style={{ padding: '8px', borderRadius: '8px', border: 'none', fontWeight: 800, fontSize: '12px', cursor: draft.trim().length < 40 ? 'not-allowed' : 'pointer', background: draft.trim().length < 40 ? '#334155' : '#00F0FF', color: draft.trim().length < 40 ? '#94a3b8' : '#060913' }}>
                          {note.text === draft.trim() && note.text ? 'Saved to journal ✓' : draft.trim().length < 40 ? `Write ${40 - draft.trim().length} more characters` : `Save conclusion${note.conclusionXp ? '' : ' (+25 XP)'}`}
                        </button>
                      </div>
                    </>
                  );
                })()}

                {/* Evidence Badge */}
                <EvidenceBadge observation={currentMission.observation} activeDate={s1Active ? timeline[timelineIndex].date : undefined} />

                {/* Question Box */}
                <div>
                  <div style={{ fontSize: '14px', marginBottom: '12px', color: '#f8fafc', fontWeight: 700, lineHeight: '1.45' }}>
                    {currentQuestionIndex + 1}. {currentChallenge.question}
                  </div>

                  {(() => {
                    const used = hintsByQ[currentQuestionIndex] ?? 0;
                    const hint1 = s1Active
                      ? `Use the map: switch between SAR and Optical, then drag the swipe line across ${timeline[0].date} and ${timeline[Math.min(2, timeline.length - 1)].date} and watch what changes.`
                      : 'Re-read the question and look at what the radar image shows before you pick.';
                    return (
                      <div style={{ marginBottom: '10px' }}>
                        {used >= 1 && (
                          <div style={{ padding: '8px 10px', marginBottom: '6px', borderRadius: '8px', fontSize: '11.5px', lineHeight: 1.45, color: '#fde68a', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)' }}>
                            💡 Hint 1: {hint1}
                          </div>
                        )}
                        {used >= 2 && (
                          <div style={{ padding: '8px 10px', marginBottom: '6px', borderRadius: '8px', fontSize: '11.5px', lineHeight: 1.45, color: '#fde68a', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)' }}>
                            💡 Hint 2: two wrong answers have been crossed out.
                          </div>
                        )}
                        {!showExplanation && used < 2 && (
                          <button
                            onClick={() => { setHintsByQ(h => ({ ...h, [currentQuestionIndex]: used + 1 })); sound.playRadarPing(); }}
                            style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', color: '#fbbf24', background: 'transparent', border: '1px solid rgba(251,191,36,0.45)' }}
                          >
                            💡 Need a hint? ({2 - used} left, loses the +{api.XP_NO_HINTS_BONUS} XP no-hint bonus)
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentChallenge.options.map((option, idx) => {
                      const isThisSelected = selectedAnswers[currentQuestionIndex] === idx;
                      const crossed = (hintsByQ[currentQuestionIndex] ?? 0) >= 2 && idx !== currentChallenge.correctIndex &&
                        currentChallenge.options.map((_, i) => i).filter(i => i !== currentChallenge.correctIndex).slice(0, 2).includes(idx);
                      return (
                        <button
                          key={idx}
                          disabled={showExplanation || crossed}
                          onClick={() => handleSelectOption(idx)}
                          style={{
                            textAlign: 'left',
                            padding: '11px 13px',
                            borderRadius: '8px',
                            fontSize: '12.5px',
                            lineHeight: 1.4,
                            border: isThisSelected ? '1px solid #00F0FF' : '1px solid #334155',
                            backgroundColor: isThisSelected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(15, 23, 42, 0.65)',
                            color: isThisSelected ? '#00F0FF' : '#cbd5e1',
                            cursor: showExplanation ? 'default' : 'pointer',
                            transition: 'all 0.15s',
                            opacity: crossed ? 0.3 : showExplanation && !isThisSelected ? 0.6 : 1,
                            textDecoration: crossed ? 'line-through' : 'none'
                          }}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation Box */}
                {showExplanation && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                    fontSize: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700,
                      color: isCorrect ? '#34d399' : '#f87171',
                      marginBottom: '6px'
                    }}>
                      {isCorrect ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                      {isCorrect ? 'Accurate Evidence! (+50 XP)' : 'Observation Refined'}
                    </div>
                    <p style={{ margin: '0 0 12px 0', color: '#cbd5e1', fontSize: '11.5px', lineHeight: '1.45' }}>
                      {currentChallenge.explanation}
                    </p>

                    <button
                      onClick={handleNextQuestion}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: '#00F0FF',
                        color: '#060913',
                        fontWeight: 800,
                        fontSize: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{currentQuestionIndex < currentMission.challenges.length - 1 ? 'Next Observation' : 'Complete Investigation'}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </aside>

          {/* 5. EMERGENCY RELIEF / EVACUATION ACTION MODAL */}
          {showEvacuationModal && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.82)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '20px'
            }}>
              <div style={{
                width: '520px',
                backgroundColor: '#071126',
                border: '2px solid #ef4444',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 0 40px rgba(239, 68, 68, 0.3)',
                position: 'relative'
              }}>
                <button
                  onClick={() => setShowEvacuationModal(false)}
                  style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <Flame size={24} color="#ef4444" />
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    EMERGENCY FLOOD RESCUE DISPATCH
                  </h3>
                </div>

                <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '18px' }}>
                  Sentinel-1 change detection flags {stageStats && timelineIndex > 0 ? `~${stageStats.newKm2.toFixed(1)} km²` : 'part'} of the study area as newly under water (experimental estimate). Over 26,000 residents across Sirajganj, Shahjadpur, and Belkuchi are in critical flood pathways.
                </p>

                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#fca5a5', fontFamily: 'monospace', fontWeight: 700 }}>
                    DISASTER RESPONSE PROTOCOL
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                    Evacuation Priority: Zone 1 (Lowland Riverine Embankments)
                  </div>
                  <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px' }}>
                    Relief Pledged: ${simulatedReliefPledged.toLocaleString()} USD
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => {
                      setSimulatedReliefPledged(prev => prev + 5000);
                      sound.playSuccessChime();
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Deploy Boat Rescue (+$5k)
                  </button>
                  <button
                    onClick={() => setShowEvacuationModal(false)}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      border: '1px solid #64748b',
                      color: '#cbd5e1',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESEARCH JOURNAL */}
      {activeTab === 'journal' && (
        <div style={{ position: 'relative', zIndex: 1, flex: 1, padding: '32px 48px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="tl-gtitle" style={{ fontSize: '34px', margin: '0 0 4px 0' }}>
                <span className="tl-spark">✦</span> RESEARCH JOURNAL <span className="tl-spark" style={{ animationDelay: '0.8s' }}>✦</span>
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                Your mission logs, your own memories and your rewards.
              </p>
            </div>

            <button
              className="tl-btn3d"
              onClick={() => setShowCertificate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', cursor: 'pointer' }}
            >
              <Award size={16} />
              <span>MY CERTIFICATE</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
            {([
              ['RANK', getRank(), '#38bdf8', '🎖️'],
              ['TOTAL XP', `${score}`, '#FFD166', '⚡'],
              ['MISSIONS', `${journal.length} / 3`, '#34d399', '🛰️'],
              ['COINS', `${coins}`, '#f9a8d4', '🪙'],
            ] as [string, string, string, string][]).map(([k, v, c, ico]) => (
              <div key={k} className="tl-acard" style={{ ['--ac' as string]: c, padding: '14px 16px' } as React.CSSProperties}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{ico} {k}</div>
                <div style={{ fontFamily: "'Lilita One', sans-serif", fontSize: '24px', color: c, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="tl-gsub" style={{ fontSize: '22px', margin: '0 0 18px 0' }}>🗂️ MISSION LOGS</h3>

            {journal.length === 0 && (
              <div style={{
                borderRadius: '12px',
                backgroundColor: 'rgba(11, 17, 32, 0.6)',
                border: '1px dashed rgba(148, 163, 184, 0.35)',
                padding: '24px',
                fontSize: '13px',
                color: '#94a3b8'
              }}>
                No missions logged yet. Finish one in the Radar Lab and it lands here with its radar pictures.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
            {journal.map(entry => {
              const m = missions.find(x => String(x.id) === entry.missionId);
              return (
            <div key={entry.id} className="tl-acard" data-tag={entry.score === 100 ? '★ PERFECT ★' : `SCORE ${entry.score}%`} style={{
              ['--ac' as string]: entry.score === 100 ? '#FFD166' : '#00F0FF',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#00F0FF', fontFamily: 'monospace', fontWeight: 700 }}>MISSION {m?.missionNumber ?? entry.missionId} // {m?.locationName ?? 'Unknown location'}</span>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '2px 0 0 0', color: '#f8fafc' }}>{entry.missionName}</h4>
                </div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <ShieldCheck size={13} />
                  Submitted {new Date(entry.dateCompleted).toLocaleDateString()}
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                backgroundColor: 'rgba(30, 41, 59, 0.3)',
                padding: '14px',
                borderRadius: '8px',
                fontSize: '12px'
              }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Target Coordinates:</span>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>{entry.coordinates[1]}°, {entry.coordinates[0]}° (lat, lon)</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Sensors Used:</span>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginTop: '2px' }}>{m ? `${m.observation.satellite} (${m.observation.polarisation})` : '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Peak New Water (estimate):</span>
                  <div style={{ fontWeight: 600, color: '#00F0FF', marginTop: '2px' }}>~{entry.floodAreaKm2} km²</div>
                </div>
              </div>

              {(() => {
                const sm = getS1Mission(Number(entry.missionId));
                if (!sm) return null;
                const z = 9, n = 2 ** z;
                const tx = Math.floor(((sm.center[0] + 180) / 360) * n);
                const latR = (sm.center[1] * Math.PI) / 180;
                const ty = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
                const url = (i: number) => s1DisplayTileUrl(sm.stages[i].itemId).replace('{z}', String(z)).replace('{x}', String(tx)).replace('{y}', String(ty));
                const pic = (i: number, label: string) => (
                  <figure style={{ margin: 0, flex: 1, minWidth: 0 }}>
                    <img src={url(i)} alt={`Sentinel-1 radar image, ${sm.stages[i].date}`} loading="lazy"
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a' }} />
                    <figcaption style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '4px' }}>{label} · {sm.stages[i].date}</figcaption>
                  </figure>
                );
                return <div style={{ display: 'flex', gap: '12px' }}>{pic(0, 'BEFORE')}{pic(2, 'AFTER')}</div>;
              })()}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShareMsg('Making your card…');
                    downloadShareCard({ missionId: Number(entry.missionId), missionName: entry.missionName, place: m?.locationName ?? '', callsign, rank: getRank(), score: entry.score, xp: entry.xpEarned, areaKm2: entry.floodAreaKm2 })
                      .then(ok => setShareMsg(ok ? 'Saved to your downloads.' : 'Could not create the image in this browser.'));
                  }}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #00F0FF', background: 'rgba(0,240,255,0.1)', color: '#00F0FF', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >⬇ Download share card</button>
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{shareMsg}</span>
              </div>

              {notes[entry.missionId]?.text && (
                <p style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.6, margin: 0, padding: '10px 12px', borderLeft: '3px solid #00F0FF', background: 'rgba(0,240,255,0.06)' }}>
                  <strong>Your conclusion:</strong> {notes[entry.missionId].text}
                </p>
              )}

              <p style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                <strong style={{ color: '#fbbf24' }}>Confidence: experimental.</strong> Water is flagged where VH backscatter is below about –20 dB. It has not been checked against ground data, and flooding under trees or in cities may be missed.
              </p>

              <p style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.6', margin: 0 }}>
                <strong>Result:</strong> {entry.score}% of the investigation questions answered correctly · +{entry.xpEarned} XP · {entry.badgeTitle}
              </p>
            </div>
              );
            })}
            </div>

            <div style={{ marginTop: '34px' }}>
              <Memories onAdd={() => sound.playSuccessChime()} />
            </div>

            <div className="tl-acard" data-tag={`${coins} COINS`} style={{ ['--ac' as string]: '#FFD166', marginTop: '34px' } as React.CSSProperties}>
              <div className="tl-gsub" style={{ fontSize: '21px', marginBottom: '4px' }}>🛍️ COIN SHOP</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>Guest profile: your progress is saved only in this browser.</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {THEMES.map(t => {
                  const owned = cosmetics.owned.includes(t.id);
                  const active = cosmetics.active === t.id;
                  const set = (next: { owned: string[]; active: string }) => { setCosmetics(next); saveJson('terralens.cosmetics.v1', next); };
                  return (
                    <button key={t.id}
                      disabled={!owned && coins < t.cost}
                      onClick={() => {
                        if (owned) set({ ...cosmetics, active: t.id });
                        else api.spendCoins(t.cost).then(p => { setCoins(p.coins); set({ owned: [...cosmetics.owned, t.id], active: t.id }); }).catch(() => {});
                      }}
                      style={{ padding: '10px 14px', borderRadius: '10px', cursor: (!owned && coins < t.cost) ? 'not-allowed' : 'pointer', opacity: (!owned && coins < t.cost) ? 0.5 : 1, background: 'rgba(15,23,42,0.7)', border: active ? '1px solid #00F0FF' : '1px solid #334155', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                      <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: t.bg, display: 'inline-block' }} />
                      <span>{t.name}<br /><span style={{ color: '#94a3b8', fontSize: '10.5px' }}>{active ? 'In use' : owned ? 'Owned · tap to use' : `${t.cost} coins`}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(journal.length > 0 || score > 0) && (
              <button
                onClick={handleResetProgress}
                title="Clears saved XP, coins and journal entries in this browser"
                style={{
                  marginTop: '16px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Reset saved progress
              </button>
            )}
          </div>
        </div>
      )}

      {/* PRINTABLE CERTIFICATE MODAL */}
      {showCertificate && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(6, 9, 19, 0.92)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
          padding: '24px'
        }}>
          <div style={{
            width: '680px',
            backgroundColor: '#0b1120',
            border: '2px solid #00F0FF',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 0 50px rgba(0, 240, 255, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowCertificate(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#00F0FF', fontFamily: 'monospace', letterSpacing: '2px', textTransform: 'uppercase' }}>
                NASA–ISRO NISAR EARTH OBSERVATION DIVISION
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', margin: '8px 0 4px 0', letterSpacing: '1px' }}>
                CERTIFICATE OF SATELLITE DISCOVERY
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                Presented for scientific radar observation & environmental change detection
              </p>
            </div>

            <div style={{
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>This certifies that Earth Investigator:</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#00F0FF', margin: '8px 0', fontFamily: 'monospace' }}>
                {callsign}
              </div>
              <div style={{ fontSize: '13px', color: '#e2e8f0' }}>
                Has achieved the official operational ranking of:
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
                🎖️ {getRank()}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
              <div>
                <strong>Validated Event:</strong> Flood & Surface Dynamics
              </div>
              <div>
                <strong>Satellite data:</strong> Copernicus Sentinel-1 (via Microsoft Planetary Computer)
              </div>
              <div>
                <strong>Total XP Recorded:</strong> {score} XP
              </div>
              <div>
                <strong>Record:</strong> Saved in this browser (not independently verified)
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#00F0FF',
                  color: '#060913',
                  fontWeight: 800,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Printer size={16} />
                <span>Print / Save Certificate as PDF</span>
              </button>

              <button
                onClick={() => setShowCertificate(false)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #475569',
                  color: '#cbd5e1',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISSION BRIEFING — shown when a mission is launched */}
      {editorOpen && (
        <AvatarEditor
          initial={avatar}
          callsign={callsign}
          onClose={() => setEditorOpen(false)}
          onSave={(cfg, name) => {
            setAvatar(cfg); saveAvatar(cfg);
            if (name !== callsign) { setCallsign(name); api.savePlayerProfile({ callsign: name }).catch(() => {}); }
            setEditorOpen(false); sound.playSuccessChime();
          }}
        />
      )}

      {briefingOpen && activeTab === 'lab' && !missionComplete && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(6,9,19,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div role="dialog" aria-label="Mission briefing" style={{ width: '520px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#0b1120', border: '1px solid rgba(0,240,255,0.4)', borderRadius: '16px', padding: '28px', boxShadow: '0 0 35px rgba(0,240,255,0.25)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00F0FF', letterSpacing: '1px' }}>MISSION CONTROL // BRIEFING</div>
              <h2 style={{ fontSize: '22px', margin: '6px 0 2px', color: '#f8fafc' }}>Mission {currentMission.missionNumber}: {currentMission.name}</h2>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{currentMission.locationName}</div>
            </div>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.55, color: '#cbd5e1' }}>{currentMission.story}</p>
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(30,41,59,0.4)', border: '1px solid #334155', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8', marginBottom: '4px' }}>YOUR SATELLITE</div>
              {currentMission.observation.satellite}, {currentMission.observation.band}, {currentMission.observation.polarisation}, {currentMission.observation.resolution} pixels.
            </div>
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8', marginBottom: '6px' }}>YOUR TASKS</div>
              <ol style={{ listStyle: 'decimal', margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.7 }}>
                <li>Compare the radar dates with the swipe line, or press play on the timeline.</li>
                <li>Use Change Detective to mark where new water appeared.</li>
                <li>Answer the {currentMission.challenges.length} field questions.</li>
              </ol>
            </div>
            <div style={{ fontSize: '11.5px', color: '#fbbf24' }}>
              Rewards: +{api.XP_PER_CORRECT} XP per correct answer, +{api.XP_PER_CORRECT_MARK} per correct mark, +{api.XP_MISSION_COMPLETE} for finishing, +{api.XP_NO_HINTS_BONUS} if you use no hints.
            </div>
            {(() => {
              const pk = api.peakFixture(currentMission.id);
              if (!pk) return null;
              const key = String(currentMission.id);
              const max = Math.round(pk.studyKm2 / 2);
              return (
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.35)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#fbbf24' }}>🎯 GUESS THE AREA (optional)</div>
                  <div style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.45 }}>
                    The study area is about {Math.round(pk.studyKm2).toLocaleString()} km². Before you see the radar: how much of it is newly under water at the peak?
                  </div>
                  {!guessResult ? (
                    <>
                      <input type="range" min={0} max={max} step={1} value={guess} onChange={e => setGuess(Number(e.target.value))} aria-label="Your guess in square kilometres" style={{ width: '100%', accentColor: '#fbbf24' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{guess} km²</span>
                        <button
                          disabled={guess === 0}
                          onClick={() => {
                            const off = Math.abs(guess - pk.peakNewKm2) / pk.peakNewKm2;
                            const first = !fun.guessed[key];
                            const xp = !first ? 0 : off <= 0.2 ? 50 : off <= 0.5 ? 20 : 0;
                            setGuessResult({ actual: pk.peakNewKm2, xp, offPct: Math.round(off * 100) });
                            setFun(f => ({ ...f, guessed: { ...f.guessed, [key]: true } }));
                            if (xp > 0) { api.awardXp(xp).then(() => setScore(sc => sc + xp)).catch(() => {}); sound.playSuccessChime(); } else sound.playRadarPing();
                          }}
                          style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', fontWeight: 800, fontSize: '12px', cursor: guess === 0 ? 'not-allowed' : 'pointer', background: guess === 0 ? '#334155' : '#fbbf24', color: '#060913' }}
                        >Lock in guess</button>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{fun.guessed[key] ? 'You already guessed this mission, so this one is for fun.' : 'Within 20%: +50 XP. Within 50%: +20 XP. First guess per mission counts.'}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.5 }}>
                      You guessed <strong>{guess} km²</strong>. The radar estimate is <strong style={{ color: '#00F0FF' }}>{guessResult.actual.toFixed(1)} km²</strong>, so you were {guessResult.offPct}% off.
                      {guessResult.xp > 0 && <span style={{ color: '#fbbf24', fontWeight: 800 }}> +{guessResult.xp} XP</span>}
                    </div>
                  )}
                </div>
              );
            })()}
            <button
              onClick={() => { setBriefingOpen(false); sound.playRadarPing(); }}
              style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#00F0FF', color: '#060913', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
            >Start investigation →</button>
          </div>
        </div>
      )}

      {/* VICTORY MODAL */}
      {missionComplete && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(6, 9, 19, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '20px'
        }}>
          <div style={{
            width: '460px',
            maxHeight: '92vh',
            overflowY: 'auto',
            backgroundColor: '#0b1120',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 0 35px rgba(0, 240, 255, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            position: 'relative'
          }}>
            <Confetti />
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 240, 255, 0.1)',
              border: '2px solid #00F0FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)'
            }}>
              <Trophy size={32} color="#00F0FF" />
            </div>

            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
                Mission {currentMission.missionNumber} Accomplished!
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                Your findings have been stamped into your scientific research journal.
              </p>
            </div>

            {(() => {
              const bd = submitted?.xpBreakdown;
              const rankNow = getRank();
              const rankedUp = api.rankForXp(startXp) !== rankNow;
              const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', padding: '3px 0' };
              return (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '6px' }}>YOUR ANSWERS</div>
                    {currentMission.challenges.map((c, i) => {
                      const ok = selectedAnswers[i] === c.correctIndex;
                      return (
                        <div key={i} style={{ ...row, gap: '8px', justifyContent: 'flex-start' }}>
                          <span style={{ color: ok ? '#34d399' : '#f87171', fontWeight: 800 }}>{ok ? '✓' : '✗'}</span>
                          <span style={{ flex: 1 }}>{c.question.length > 70 ? c.question.slice(0, 68) + '…' : c.question}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '6px' }}>XP EARNED THIS MISSION</div>
                    {bd ? (
                      <>
                        <div style={row}><span>Correct answers</span><span>+{bd.answers}</span></div>
                        <div style={row}><span>Change Detective marks</span><span>+{bd.marks}</span></div>
                        <div style={row}><span>Mission complete</span><span>+{bd.completion}</span></div>
                        <div style={row}><span>No hints used</span><span>+{bd.noHints}</span></div>
                        <div style={{ ...row, borderTop: '1px solid #334155', marginTop: '4px', paddingTop: '6px', color: '#fbbf24', fontWeight: 800 }}><span>Total</span><span>+<CountUp to={bd.total} /> XP</span></div>
                      </>
                    ) : <div style={row}>Saving…</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>{rankedUp ? 'RANK UP!' : 'RANK'}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>{rankNow}</div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{score} XP total</div>
                    </div>
                    <div style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>BADGE UNLOCKED</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>🏅 {submitted?.badgeTitle ?? '…'}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
              <button
                onClick={() => { setMissionComplete(false); setActiveTab('journal'); }}
                style={{
                  flex: '1 1 100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#00F0FF',
                  border: 'none',
                  color: '#060913',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <BookOpen size={16} />
                <span>View Research Journal</span>
              </button>

              <button
                onClick={() => { setMissionComplete(false); setShowFloodLayer(true); setTimelineIndex(0); setPlaying(true); }}
                title="Replay the four radar dates with the water mask"
                style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: 'transparent', border: '1px solid #c084fc', color: '#c084fc', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >▶ Time-lapse</button>
              {(() => {
                const next = missions.find(m => m.id === currentMission.id + 1);
                const open = next && (next.id === 2 ? isAssamUnlocked : isAmazonUnlocked);
                if (!next || !open) return null;
                return (
                  <button
                    onClick={() => handleLaunchMission(next)}
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', backgroundColor: 'transparent', border: '1px solid #00F0FF', color: '#00F0FF', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >Next mission →</button>
                );
              })()}

              <button
                onClick={handleRestartMission}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #475569',
                  color: '#cbd5e1',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                title="Restart"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;