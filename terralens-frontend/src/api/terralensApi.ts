// TERRALENS — API layer (mock backend)
//
// Every function below mirrors one endpoint from the planned FastAPI backend:
//
//   GET  /missions                         → getMissions()
//   GET  /missions/{id}                    → getMission(id)
//   GET  /scenes/{id}                      → getScenes(missionId)
//   GET  /analysis/{id}                    → getAnalysis(missionId)
//   POST /investigations/{id}/marks        → checkMarks(missionId, payload)
//   POST /investigations/{id}/submit       → submitInvestigation(missionId, payload)
//   GET  /players/{id}/progress            → getPlayerProgress()
//   PUT  /players/{id}                     → savePlayerProfile({ callsign })
//   GET  /players/{id}/journal             → getPlayerJournal()
//   GET  /players/{id}/rank                → getPlayerRank()
//
// MOCK MODE (default): nothing runs on a server, every answer is mock data.
//   • Missions come from the fixture files in src/data.
//   • Scene records and analysis numbers are fixtures written in this file.
//   • Player progress and the journal are kept in this browser's localStorage.
//   • The map imagery and the water mask are NOT part of the mock: they are
//     placeholders the backend will replace with its own tiles (see `imagery`
//     and `overlays` below).
//
// LIVE MODE: set VITE_API_BASE (e.g. http://127.0.0.1:8000) in a .env file.
// The FastAPI backend then owns the PLAYER side: progress, callsign, journal,
// rank, XP, coins, reset, and answer checking on submit (routes under /api/game).
// Mission content, scene records, analysis numbers and mark checking stay in the
// browser: the backend has no per-mission map data for them yet.
// If the backend cannot be reached, player calls fall back to this browser's
// localStorage so the game keeps working offline.

import { MISSION_CONTEXT, IMPACT_LAYERS } from '../data/missionContext';
import type { MissionContext, ImpactLayers } from '../data/missionContext';
import { useEffect, useState } from 'react';
import { jamunaMission } from '../data/mission01';
import { assamMission } from '../data/mission02';
import { amazonMission } from '../data/mission03';
import { WATER_VH_DB, analyseMission, getS1Mission, s1DisplayTileUrl, scoreMark } from '../data/sentinel1';
import type { AnalysisStatus, ChangeOverlay, StageStats } from '../data/sentinel1';
import type { MissionData } from '../types/mission';
import type { JournalEntry, MissionResult, SubmitMissionPayload } from '../types/api';

const API_BASE: string | undefined =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE || undefined;

export const API_MODE: 'mock' | 'live' = API_BASE ? 'live' : 'mock';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`API ${path} failed (${r.status})`);
  return r.json() as Promise<T>;
}

/** Id of this browser's player on the backend (kept in localStorage). */
export function playerId(): string {
  try {
    const key = 'terralens.player-id';
    const existing = window.localStorage.getItem(key);
    if (existing && /^[A-Za-z0-9_-]{1,64}$/.test(existing)) return existing;
    const id = window.crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return id;
  } catch { return 'local'; }
}

/** Call the backend; if it cannot be reached at all, run the browser fallback instead. */
async function viaBackend<T>(path: string, init: RequestInit | undefined, fallback: () => Promise<T>): Promise<T> {
  if (!API_BASE) return fallback();
  try {
    return await http<T>(path, init);
  } catch (e) {
    if (e instanceof TypeError) return fallback();   // network failure: backend is not running
    throw e;
  }
}
const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

/** Small artificial delay so the UI is built for a real network round-trip. */
const latency = <T,>(value: T, ms = 120): Promise<T> => new Promise(res => setTimeout(() => res(value), ms));

// ── Missions ─────────────────────────────────────────────────────────────────
export type MissionSummary = MissionData & { requiredXpToUnlock: number };

const MISSIONS: MissionSummary[] = [
  { ...jamunaMission, requiredXpToUnlock: 0 },
  { ...assamMission, requiredXpToUnlock: 100 },
  { ...amazonMission, requiredXpToUnlock: 250 },
];

export function getMissions(): Promise<MissionSummary[]> {
  return latency(MISSIONS);
}

export function getMission(id: number): Promise<MissionSummary> {
  const m = MISSIONS.find(x => x.id === id);
  return m ? latency(m) : Promise.reject(new Error(`Mission ${id} not found`));
}

// ── Scenes (mock fixtures) ───────────────────────────────────────────────────
export interface SceneRecord {
  /** Timeline date this scene belongs to (YYYY-MM-DD). */
  date: string;
  granuleId: string;
  platform: string;
  beamMode: string;
  polarization: string;
  /** Relative orbit (path) number. */
  path: string;
  direction: string;
  processing: string;
  label: string;
}

export interface ScenesResponse {
  missionId: number;
  /** One record per timeline date; the first one is the pre-event baseline. */
  scenes: SceneRecord[];
  /** Map tiles for each scene, in the same order. BACKEND: replace with your own tile URLs. */
  imagery: { date: string; tiles: string[] }[];
  source: 'mock';
}

export function getScenes(missionId: number): Promise<ScenesResponse> {
  const cfg = getS1Mission(missionId);
  const stages = cfg?.stages ?? [];
  return latency({
    missionId,
    scenes: stages.map(st => ({
      date: st.date,
      granuleId: st.itemId.replace(/_rtc$/, ''),
      platform: cfg?.platform ?? '',
      beamMode: 'IW',
      polarization: 'VV+VH',
      path: cfg?.orbit.match(/\d+/)?.[0] ?? '',
      direction: cfg?.orbit.startsWith('Descending') ? 'DESCENDING' : 'ASCENDING',
      processing: cfg?.product ?? '',
      label: st.label,
    })),
    imagery: stages.map(st => ({ date: st.date, tiles: [s1DisplayTileUrl(st.itemId)] })),
    source: 'mock' as const,
  });
}

// ── Analysis ─────────────────────────────────────────────────────────────────
export interface AnalysisResponse {
  missionId: number;
  source: 'mock' | 'backend';
  sensor: string;
  productType: string;
  method: string;
  thresholdDb: number;
  /** Results are not validated against independent reference data. */
  status: 'experimental';
  baselineDate: string;
  stages: (StageStats & { date: string })[];
  /** Water-mask image per stage for the map (may be empty). BACKEND: replace with a change-layer tile URL. */
  overlays: ChangeOverlay[];
}

/**
 * MOCK analysis numbers per mission (km², inside each mission's study area).
 * They were measured once from the Sentinel-1 scenes with the method in
 * data/sentinel1.ts and are frozen here so the game shows the same values every
 * time. BACKEND: return your pipeline's numbers in this shape.
 */
const ANALYSIS_FIXTURES: Record<number, StageStats[]> = {
  1: [
    { waterKm2: 122.9, newKm2: 0,     persistentKm2: 122.9, recededKm2: 0,   validKm2: 1014.8 },
    { waterKm2: 196.7, newKm2: 80.9,  persistentKm2: 115.9, recededKm2: 7.0, validKm2: 1014.8 },
    { waterKm2: 281.9, newKm2: 162.2, persistentKm2: 119.7, recededKm2: 3.2, validKm2: 1014.8 },
    { waterKm2: 187.9, newKm2: 68.5,  persistentKm2: 119.4, recededKm2: 3.5, validKm2: 1014.8 },
  ],
  2: [
    { waterKm2: 199.8, newKm2: 0,     persistentKm2: 199.8, recededKm2: 0,   validKm2: 1663.7 },
    { waterKm2: 229.5, newKm2: 38.3,  persistentKm2: 191.2, recededKm2: 8.6, validKm2: 1663.7 },
    { waterKm2: 382.6, newKm2: 184.7, persistentKm2: 198.0, recededKm2: 1.8, validKm2: 1663.7 },
    { waterKm2: 249.2, newKm2: 53.5,  persistentKm2: 195.7, recededKm2: 4.1, validKm2: 1663.7 },
  ],
  3: [
    { waterKm2: 327.7, newKm2: 0,     persistentKm2: 327.7, recededKm2: 0,    validKm2: 1948.9 },
    { waterKm2: 534.1, newKm2: 209.0, persistentKm2: 325.1, recededKm2: 2.6,  validKm2: 1948.9 },
    { waterKm2: 580.3, newKm2: 254.9, persistentKm2: 325.4, recededKm2: 2.2,  validKm2: 1948.9 },
    { waterKm2: 339.3, newKm2: 40.3,  persistentKm2: 299.0, recededKm2: 28.7, validKm2: 1948.9 },
  ],
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function getAnalysis(missionId: number): Promise<AnalysisResponse> {
  const cfg = getS1Mission(missionId);
  if (!cfg) throw new Error(`No radar analysis is available yet for mission ${missionId}`);
  // The water-mask picture for the map is drawn from the radar tiles when they can be
  // reached; without a connection the fixture numbers still show and the mask is absent.
  const live = await analyseMission(missionId).catch(() => null);
  const fixture = ANALYSIS_FIXTURES[missionId];
  const stats = fixture ?? live?.stats.map(st => ({
    waterKm2: round1(st.waterKm2), newKm2: round1(st.newKm2), persistentKm2: round1(st.persistentKm2),
    recededKm2: round1(st.recededKm2), validKm2: round1(st.validKm2),
  }));
  if (!stats) throw new Error(`The radar data for mission ${missionId} could not be loaded`);
  return {
    missionId,
    source: 'mock',
    sensor: cfg.platform,
    productType: cfg.product,
    method: 'Threshold classification on VH backscatter, new water = later date minus baseline',
    thresholdDb: WATER_VH_DB,
    status: 'experimental',
    baselineDate: cfg.stages[0].date,
    stages: stats.map((st, i) => ({ ...st, date: cfg.stages[i].date })),
    overlays: live?.overlays ?? [],
  };
}

export interface AnalysisState {
  status: AnalysisStatus;
  data: AnalysisResponse | null;
  error: string | null;
}

/** React hook around GET /analysis/{id}. Starts the first time `enabled` is true. */
export function useAnalysis(missionId: number, enabled: boolean): AnalysisState {
  const [state, setState] = useState<AnalysisState>({ status: 'idle', data: null, error: null });

  useEffect(() => {
    if (!enabled) return;
    if (state.status === 'ready' && state.data?.missionId === missionId) return;
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    getAnalysis(missionId)
      .then(data => { if (!cancelled) setState({ status: 'ready', data, error: null }); })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: 'error', data: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, enabled]);

  return state;
}

// ── Change Detective: check the places a player marked ──────────────────────
/** Radius of one mark on the map, metres. */
export const MARK_RADIUS_M = 1000;
/** A mark counts when at least this share of its circle is new water. */
export const MARK_PASS_FRACTION = 0.25;
/** Marks closer together than this count as the same region, metres. */
export const MARK_MIN_SPACING_M = 3000;
export const MARKS_ALLOWED = 3;
export const MARKS_NEEDED = 2;
export const XP_PER_CORRECT_MARK = 50;

export interface MarkInput { id: number; lng: number; lat: number }

export type MarkVerdict = 'new-water' | 'already-water' | 'no-change' | 'outside' | 'duplicate';

export interface MarkResult extends MarkInput {
  correct: boolean;
  verdict: MarkVerdict;
  /** Percent of the circle the reference mask classifies as new water. */
  newWaterPercent: number;
  /** Percent of the circle that was already water on the baseline date. */
  alreadyWaterPercent: number;
}

export interface CheckMarksResponse {
  missionId: number;
  stageDate: string;
  results: MarkResult[];
  correctCount: number;
  passed: boolean;
  xpAwarded: number;
}

function metresBetween(a: MarkInput, b: MarkInput): number {
  const k = Math.PI / 180;
  const x = (b.lng - a.lng) * k * Math.cos(((a.lat + b.lat) / 2) * k);
  const y = (b.lat - a.lat) * k;
  return Math.sqrt(x * x + y * y) * 6371000;
}

export async function checkMarks(missionId: number, payload: { stageIndex: number; marks: MarkInput[] }): Promise<CheckMarksResponse> {
  if (!getS1Mission(missionId)) throw new Error(`No reference change map is available yet for mission ${missionId}`);

  const results: MarkResult[] = [];
  for (const m of payload.marks.slice(0, MARKS_ALLOWED)) {
    const sc = await scoreMark(missionId, payload.stageIndex, m.lng, m.lat, MARK_RADIUS_M);
    const tooClose = results.some(r => r.correct && metresBetween(r, m) < MARK_MIN_SPACING_M);
    const verdict: MarkVerdict = !sc.inside ? 'outside'
      : sc.newWaterFraction >= MARK_PASS_FRACTION ? (tooClose ? 'duplicate' : 'new-water')
      : sc.persistentFraction >= 0.5 ? 'already-water'
      : 'no-change';
    results.push({ ...m, correct: verdict === 'new-water', verdict, newWaterPercent: Math.round(sc.newWaterFraction * 100), alreadyWaterPercent: Math.round(sc.persistentFraction * 100) });
  }
  const correctCount = results.filter(r => r.correct).length;
  return {
    missionId,
    stageDate: getS1Mission(missionId)?.stages[payload.stageIndex]?.date ?? '',
    results,
    correctCount,
    passed: correctCount >= MARKS_NEEDED,
    xpAwarded: correctCount * XP_PER_CORRECT_MARK,
  };
}

// ── Player (stored in this browser) ──────────────────────────────────────────
export interface PlayerProgress {
  playerId: string;
  callsign: string | null;
  xp: number;
  coins: number;
  completedMissionIds: number[];
  journal: JournalEntry[];
  updatedAt: string | null;
}

const STORAGE_KEY = 'terralens.player.v1';
const START_COINS = 50;

function emptyPlayer(): PlayerProgress {
  return { playerId: 'local', callsign: null, xp: 0, coins: START_COINS, completedMissionIds: [], journal: [], updatedAt: null };
}

let memoryPlayer: PlayerProgress | null = null; // used when localStorage is unavailable

function readPlayer(): PlayerProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyPlayer(), ...(JSON.parse(raw) as Partial<PlayerProgress>) };
  } catch { /* private mode or blocked storage: fall through */ }
  return memoryPlayer ?? emptyPlayer();
}

function writePlayer(p: PlayerProgress): PlayerProgress {
  const next = { ...p, updatedAt: new Date().toISOString() };
  memoryPlayer = next;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* keep in memory only */ }
  return next;
}

export function getPlayerProgress(): Promise<PlayerProgress> {
  return viaBackend(`/api/game/players/${playerId()}/progress`, undefined, () => latency(readPlayer()));
}

export function savePlayerProfile(profile: { callsign: string }): Promise<PlayerProgress> {
  return viaBackend(`/api/game/players/${playerId()}`, { method: 'PUT', body: JSON.stringify(profile) },
    () => latency(writePlayer({ ...readPlayer(), callsign: profile.callsign })));
}

export function getPlayerJournal(): Promise<JournalEntry[]> {
  return viaBackend(`/api/game/players/${playerId()}/journal`, undefined, () => latency(readPlayer().journal));
}

/** Wipes the saved player (XP, coins, journal) in this browser. */
export function resetPlayer(): Promise<PlayerProgress> {
  return viaBackend(`/api/game/players/${playerId()}`, { method: 'DELETE' }, () => latency(writePlayer(emptyPlayer())));
}

/** Adds bonus XP (impact task, written conclusion). BACKEND: POST /players/{id}/xp */
export function awardXp(xp: number): Promise<PlayerProgress> {
  return viaBackend(`/api/game/players/${playerId()}/xp`, json({ xp }), () => {
    const p = readPlayer();
    return latency(writePlayer({ ...p, xp: p.xp + xp }));
  });
}

/** Spends coins on a cosmetic. Rejects when there are not enough. BACKEND: POST /players/{id}/coins/spend */
export function spendCoins(cost: number): Promise<PlayerProgress> {
  return viaBackend(`/api/game/players/${playerId()}/coins/spend`, json({ cost }), () => {
    const p = readPlayer();
    if (p.coins < cost) return Promise.reject(new Error('Not enough coins'));
    return latency(writePlayer({ ...p, coins: p.coins - cost }));
  });
}

// ── Optional context data: rainfall / river level, roads / farmland ─────────
export function getMissionContext(missionId: number): Promise<MissionContext> {
  return latency(MISSION_CONTEXT[missionId] ?? {});
}
export function getImpactLayers(missionId: number): Promise<ImpactLayers> {
  return latency(IMPACT_LAYERS[missionId] ?? {});
}

/** Peak new-water area and study-area size for a mission (mock fixture). BACKEND: derive from /analysis/{id}. */
export function peakFixture(missionId: number): { peakNewKm2: number; studyKm2: number } | null {
  const f = ANALYSIS_FIXTURES[missionId];
  if (!f) return null;
  return { peakNewKm2: Math.max(...f.map(s => s.newKm2)), studyKm2: f[0].validKm2 };
}

// ── Rank ─────────────────────────────────────────────────────────────────────
export const RANKS = [
  { title: 'Radar Rookie', minXp: 0 },
  { title: 'Signal Explorer', minXp: 100 },
  { title: 'Change Detective', minXp: 350 },
  { title: 'Earth Investigator', minXp: 600 },
  { title: "Earth's Guardian", minXp: 850 },
] as const;

export function rankForXp(xp: number): string {
  return [...RANKS].reverse().find(r => xp >= r.minXp)?.title ?? RANKS[0].title;
}

export async function getPlayerRank(): Promise<{ rank: string; xp: number; nextRankAtXp: number | null }> {
  return viaBackend(`/api/game/players/${playerId()}/rank`, undefined, () => {
    const p = readPlayer();
    return latency({ rank: rankForXp(p.xp), xp: p.xp, nextRankAtXp: RANKS.find(r => r.minXp > p.xp)?.minXp ?? null });
  });
}

// ── Submit an investigation ──────────────────────────────────────────────────
export const XP_PER_CORRECT = 50;
const COINS_PER_CORRECT = 25;
export const XP_MISSION_COMPLETE = 100;
export const XP_NO_HINTS_BONUS = 25;

export interface XpBreakdown { answers: number; marks: number; completion: number; noHints: number; total: number }

export interface SubmitResponse {
  result: MissionResult;
  progress: PlayerProgress;
  xpBreakdown: XpBreakdown;
  badgeTitle: string;
}

export type SubmitPayload = SubmitMissionPayload & {
  /** Places the player marked as changed, and how many the reference map confirmed. */
  marks?: MarkInput[];
  correctMarks?: number;
};

export function submitInvestigation(missionId: number, payload: SubmitPayload): Promise<SubmitResponse> {
  return viaBackend(`/api/game/investigations/${missionId}/players/${playerId()}/submit`, json(payload),
    () => submitInBrowser(missionId, payload));
}

async function submitInBrowser(missionId: number, payload: SubmitPayload): Promise<SubmitResponse> {
  const mission = MISSIONS.find(m => m.id === missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);

  // The answers are checked here, not trusted from the screen
  const explanations = mission.challenges.map((c, i) => ({
    questionId: i,
    isCorrect: payload.answers[i] === c.correctIndex,
    explanation: c.explanation,
  }));
  const correctCount = explanations.filter(e => e.isCorrect).length;
  // MOCK: the marking result is taken from the screen. BACKEND: re-check the marks server-side.
  const markXp = Math.min(MARKS_ALLOWED, Math.max(0, payload.correctMarks ?? 0)) * XP_PER_CORRECT_MARK;
  const noHints = (payload.hintsUsed ?? 0) === 0 ? XP_NO_HINTS_BONUS : 0;
  const xpBreakdown: XpBreakdown = {
    answers: correctCount * XP_PER_CORRECT, marks: markXp,
    completion: XP_MISSION_COMPLETE, noHints, total: 0,
  };
  xpBreakdown.total = xpBreakdown.answers + xpBreakdown.marks + xpBreakdown.completion + xpBreakdown.noHints;
  const xpEarned = xpBreakdown.total;

  // Area for the journal: the peak new-water area from the analysis fixture when there is one
  const fixture = ANALYSIS_FIXTURES[missionId];
  const floodAreaKm2 = fixture ? Math.max(...fixture.map(s => s.newKm2)) : mission.estimatedAreaKm2;

  const now = new Date().toISOString();
  const entry: JournalEntry = {
    id: `${missionId}-${Date.now()}`,
    missionId: String(missionId),
    missionName: mission.name,
    dateCompleted: now,
    score: Math.round((correctCount / mission.challenges.length) * 100),
    xpEarned,
    badgeTitle: correctCount === mission.challenges.length ? 'All Answers Correct' : 'Mission Complete',
    thumbnailUrl: '',
    coordinates: mission.coordinates,
    floodAreaKm2,
  };

  const before = readPlayer();
  const progress = writePlayer({
    ...before,
    callsign: payload.playerCallsign || before.callsign,
    xp: before.xp + xpEarned,
    coins: before.coins + correctCount * COINS_PER_CORRECT,
    completedMissionIds: Array.from(new Set([...before.completedMissionIds, missionId])),
    // newest first; one entry per mission (a replay replaces the older entry)
    journal: [entry, ...before.journal.filter(j => j.missionId !== String(missionId))],
  });

  const result: MissionResult = {
    missionId: String(missionId),
    score: entry.score,
    xpEarned,
    correctCount,
    totalQuestions: mission.challenges.length,
    badgeAwarded: null,
    explanations,
    timestamp: now,
  };
  return latency({ result, progress, xpBreakdown, badgeTitle: entry.badgeTitle }, 200);
}
