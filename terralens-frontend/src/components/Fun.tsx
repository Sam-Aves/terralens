// Fun extras: confetti, count-up numbers, radar fact cards, the Spot-the-Flood
// mini-game, the shareable result card and the small saved state behind them.
import React, { useEffect, useMemo, useState } from 'react';
import { S1_MISSIONS, s1DisplayTileUrl } from '../data/sentinel1';
import type { S1Mission } from '../data/sentinel1';

// ── Saved state (this browser only) ──────────────────────────────────────────
export interface FunState {
  streak: { count: number; last: string };          // last = 'YYYY-MM-DD' of the latest visit
  bestScore: Record<string, number>;                // best quiz score per mission, %
  bestSpeed: Record<string, number>;                // best speed-round points per mission
  bestSpot: number;                                 // best Spot-the-Flood score
  guessed: Record<string, boolean>;                 // area guess already rewarded per mission
  mystery: Record<string, { unlocked?: boolean; done?: boolean }>;
  explorerBonus?: boolean;                          // World Explorer bonus already collected
}
const FUN_KEY = 'terralens.fun.v1';
export const emptyFun = (): FunState => ({ streak: { count: 0, last: '' }, bestScore: {}, bestSpeed: {}, bestSpot: 0, guessed: {}, mystery: {} });
export function loadFun(): FunState {
  try { const r = window.localStorage.getItem(FUN_KEY); if (r) return { ...emptyFun(), ...(JSON.parse(r) as Partial<FunState>) }; } catch { /* blocked */ }
  return emptyFun();
}
export function saveFun(f: FunState) { try { window.localStorage.setItem(FUN_KEY, JSON.stringify(f)); } catch { /* blocked */ } }

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Counts today's visit: +1 if the last visit was yesterday, restart at 1 after a gap. */
export function touchStreak(f: FunState): FunState {
  const today = dayKey(new Date());
  if (f.streak.last === today) return f;
  const y = new Date(); y.setDate(y.getDate() - 1);
  return { ...f, streak: { count: f.streak.last === dayKey(y) ? f.streak.count + 1 : 1, last: today } };
}

// ── Confetti ─────────────────────────────────────────────────────────────────
export const Confetti: React.FC<{ pieces?: number }> = ({ pieces = 70 }) => {
  const bits = useMemo(() => Array.from({ length: pieces }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.9, dur: 2.2 + Math.random() * 1.6,
    size: 6 + Math.random() * 6, rot: Math.random() * 360,
    color: ['#00F0FF', '#fbbf24', '#c084fc', '#34d399', '#f472b6', '#38bdf8'][i % 6],
  })), [pieces]);
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
      {bits.map((b, i) => (
        <span key={i} className="tl-confetti" style={{ left: `${b.left}%`, width: b.size, height: b.size * 0.45, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
};

// ── Count-up number ──────────────────────────────────────────────────────────
export const CountUp: React.FC<{ to: number; ms?: number }> = ({ to, ms = 1100 }) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
};

// ── Radar fact cards (general, well-established SAR facts) ───────────────────
export const RADAR_FACTS = [
  'SAR stands for Synthetic Aperture Radar. The satellite uses its own motion to act like a much longer antenna.',
  'Radar is an active sensor: it sends its own microwave pulse, so it works at night.',
  'Microwaves pass through cloud, which is why radar is used to map floods during storms.',
  'Calm water looks dark in radar images because it reflects the pulse away from the satellite.',
  'Sentinel-1 uses C-band radar with a wavelength of about 5.6 cm.',
  'The grainy look of radar images is called speckle. It comes from many small echoes adding together inside each pixel.',
  'VV and VH describe how the radar wave is sent and received: vertical out, then vertical or horizontal back.',
  'Buildings often look very bright in radar because walls and ground bounce the pulse straight back.',
];
export const FactCard: React.FC = () => {
  const [i, setI] = useState(() => Math.floor(Math.random() * RADAR_FACTS.length));
  useEffect(() => { const t = window.setInterval(() => setI(x => (x + 1) % RADAR_FACTS.length), 5000); return () => window.clearInterval(t); }, []);
  return (
    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(0,240,255,0.07)', border: '1px solid rgba(0,240,255,0.35)' }}>
      <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, color: '#00F0FF', marginBottom: '4px' }}>DID YOU KNOW? · analysing the radar scenes…</div>
      <div key={i} className="tl-fade" style={{ fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.5 }}>{RADAR_FACTS[i]}</div>
    </div>
  );
};

// ── Tile helpers ─────────────────────────────────────────────────────────────
function centreTile(m: S1Mission, z: number): [number, number] {
  const n = 2 ** z;
  const x = Math.floor(((m.center[0] + 180) / 360) * n);
  const r = (m.center[1] * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [x, y];
}
const tileUrl = (itemId: string, z: number, x: number, y: number) =>
  s1DisplayTileUrl(itemId).replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

// ── Spot the Flood ───────────────────────────────────────────────────────────
interface SpotRound { place: string; lowUrl: string; highUrl: string; lowDate: string; highDate: string; highOnLeft: boolean }
const PLACES: Record<number, string> = { 1: 'Jamuna, Bangladesh', 2: 'Kaziranga, Assam', 3: 'Solimões, Amazon' };
function buildRounds(n: number): SpotRound[] {
  const all: SpotRound[] = [];
  for (const [idStr, m] of Object.entries(S1_MISSIONS)) {
    const [cx, cy] = centreTile(m, 9);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = cx * 2 + i, y = cy * 2 + j;
      all.push({
        place: PLACES[Number(idStr)] ?? `Mission ${idStr}`,
        lowUrl: tileUrl(m.stages[0].itemId, 10, x, y), highUrl: tileUrl(m.stages[2].itemId, 10, x, y),
        lowDate: m.stages[0].date, highDate: m.stages[2].date, highOnLeft: Math.random() < 0.5,
      });
    }
  }
  return all.sort(() => Math.random() - 0.5).slice(0, n);
}

export const SpotTheFlood: React.FC<{ best: number; onFinish: (score: number) => void; onPick?: (right: boolean) => void }> = ({ best, onFinish, onPick }) => {
  const TOTAL = 6;
  const [rounds, setRounds] = useState<SpotRound[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<null | boolean>(null);   // was the pick right?
  const [log, setLog] = useState<boolean[]>([]);                 // right/wrong per finished round
  const start = () => { setRounds(buildRounds(TOTAL)); setIdx(0); setScore(0); setPicked(null); setLog([]); };
  const done = rounds !== null && idx >= rounds.length;
  const r = rounds && !done ? rounds[idx] : null;
  const pick = (left: boolean) => {
    if (!r || picked !== null) return;
    const right = left === r.highOnLeft;
    setPicked(right); setLog(l => [...l, right]); if (right) setScore(s => s + 1); onPick?.(right);
  };
  const next = () => {
    if (!rounds) return;
    if (idx + 1 >= rounds.length) onFinish(score);
    setIdx(i => i + 1); setPicked(null);
  };
  const btn: React.CSSProperties = { padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#00F0FF', color: '#060913', fontWeight: 800, fontSize: '13px', cursor: 'pointer' };
  const img = (left: boolean) => {
    const isHigh = left === r!.highOnLeft;
    const show = picked !== null;
    return (
      <button onClick={() => pick(left)} disabled={show} style={{ flex: 1, minWidth: 0, padding: 0, borderRadius: '10px', overflow: 'hidden', cursor: show ? 'default' : 'pointer', background: '#0f172a', border: show ? `2px solid ${isHigh ? '#34d399' : '#475569'}` : '2px solid #334155' }}>
        <img src={isHigh ? r!.highUrl : r!.lowUrl} alt={left ? 'Radar image A' : 'Radar image B'} style={{ display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover' }} />
        <div style={{ padding: '6px', fontSize: '11px', fontFamily: 'monospace', color: show ? (isHigh ? '#34d399' : '#94a3b8') : '#cbd5e1' }}>
          {show ? `${isHigh ? 'HIGH WATER' : 'BASELINE'} · ${isHigh ? r!.highDate : r!.lowDate}` : (left ? 'IMAGE A' : 'IMAGE B')}
        </div>
      </button>
    );
  };
  return (
    <div className="tl-acard" data-tag={`${TOTAL} ROUNDS`} style={{ ['--ac' as string]: '#00F0FF', display: 'flex', flexDirection: 'column', gap: '12px' } as React.CSSProperties}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div className="tl-gsub" style={{ fontSize: '21px' }}>🛰️ SPOT THE FLOOD</div>
        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>BEST {best} / {TOTAL}</div>
      </div>
      {rounds && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} aria-label={`Round ${Math.min(idx + 1, TOTAL)} of ${TOTAL}, score ${score}`}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={`${i}-${String(log[i])}`} className={log[i] !== undefined ? 'tl-pop' : undefined} style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 800, color: '#060913', background: log[i] === true ? '#34d399' : log[i] === false ? '#f87171' : i === idx ? '#FFD166' : '#1e293b', border: `2px solid ${i === idx && log[i] === undefined ? '#FDF5CC' : 'rgba(255,255,255,0.15)'}` }}>
              {log[i] === true ? '★' : log[i] === false ? '✕' : i + 1}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: "'Lilita One', sans-serif", fontSize: '18px', color: '#FFD166' }}>{score} ★</span>
        </div>
      )}
      {!rounds && (
        <>
          <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.5 }}>Two real Sentinel-1 radar images of the same place. Tap the one taken on the high-water date. Remember: dark and smooth means open water.</div>
          <button className="tl-btn3d" style={btn} onClick={start}>PLAY</button>
        </>
      )}
      {r && (
        <>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{r.place}: which image has more water?</div>
          <div style={{ display: 'flex', gap: '12px' }}>{img(true)}{img(false)}</div>
          {picked !== null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span className="tl-pop" style={{ fontFamily: "'Lilita One', sans-serif", fontSize: '20px', color: picked ? '#34d399' : '#f87171' }}>{picked ? 'NICE! +1 ★' : 'MISSED IT'}</span>
              <button className="tl-btn3d" style={btn} onClick={next}>{idx + 1 >= rounds!.length ? 'Finish' : 'Next →'}</button>
            </div>
          )}
        </>
      )}
      {done && (
        <>
          <div style={{ textAlign: 'center' }}>
            <div className="tl-pop" style={{ fontFamily: "'Bagel Fat One', cursive, sans-serif", fontSize: '40px', color: '#FDF5CC', textShadow: '0 3px 0 #2563eb' }}>{score} / {TOTAL}</div>
            <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{score === TOTAL ? 'Perfect run! Eagle eyes.' : score >= TOTAL - 2 ? 'Sharp radar reading.' : 'Tip: dark and smooth means open water.'}{score > best ? ' New best!' : ''}</div>
          </div>
          <button className="tl-btn3d" style={btn} onClick={start}>PLAY AGAIN</button>
        </>
      )}
    </div>
  );
};

// ── Mystery-signal bonus questions (general radar knowledge, not facts about the places) ──
export const MYSTERY_QUIZ: Record<string, { q: string; options: string[]; correct: number; why: string }> = {
  'm-mekong': { q: 'What does SAR stand for?', options: ['Satellite Area Recorder', 'Synthetic Aperture Radar', 'Surface Angle Reading'], correct: 1, why: 'Synthetic Aperture Radar: the moving satellite combines many echoes to act like one very long antenna.' },
  'm-indus': { q: 'Why can a radar satellite take images at night?', options: ['It uses moonlight', 'It carries its own microwave source', 'It only records heat'], correct: 1, why: 'Radar is an active sensor. It lights the ground with its own microwave pulse and listens for the echo.' },
  'm-niger': { q: 'The grainy texture in radar images is called:', options: ['Speckle', 'Glare', 'Static bloom'], correct: 0, why: 'Speckle comes from many small echoes inside one pixel adding up or cancelling out.' },
};
export const MYSTERY_COST = 40;
export const MYSTERY_XP = 30;
export const EXPLORER_BONUS_XP = 100;

// ── Shareable result card (PNG download) ─────────────────────────────────────
function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = url;
  });
}
export async function downloadShareCard(o: { missionId: number; missionName: string; place: string; callsign: string; rank: string; score: number; xp: number; areaKm2: number }): Promise<boolean> {
  const W = 1200, H = 630;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); if (!g) return false;
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#060913'); bg.addColorStop(1, '#0c1f3d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#00F0FF'; g.lineWidth = 3; g.strokeRect(14, 14, W - 28, H - 28);
  g.fillStyle = '#00F0FF'; g.font = '800 30px monospace'; g.fillText('TERRALENS', 50, 72);
  g.fillStyle = '#94a3b8'; g.font = '18px monospace'; g.fillText('SATELLITE RADAR INVESTIGATION', 250, 70);
  g.fillStyle = '#f8fafc'; g.font = '800 46px sans-serif'; g.fillText(o.missionName, 50, 140);
  g.fillStyle = '#94a3b8'; g.font = '22px sans-serif'; g.fillText(o.place, 50, 176);

  const m = S1_MISSIONS[o.missionId];
  if (m) {
    const [x, y] = centreTile(m, 9);
    const [a, b] = await Promise.all([loadImg(tileUrl(m.stages[0].itemId, 9, x, y)), loadImg(tileUrl(m.stages[2].itemId, 9, x, y))]);
    const S = 330, top = 210;
    ([[a, 50, 'BEFORE', m.stages[0].date], [b, 50 + S + 20, 'AFTER', m.stages[2].date]] as [HTMLImageElement | null, number, string, string][]).forEach(([im, left, label, date]) => {
      g.fillStyle = '#0f172a'; g.fillRect(left, top, S, S);
      if (im) g.drawImage(im, left, top, S, S);
      g.strokeStyle = '#334155'; g.lineWidth = 2; g.strokeRect(left, top, S, S);
      g.fillStyle = 'rgba(6,9,19,0.8)'; g.fillRect(left, top + S - 34, S, 34);
      g.fillStyle = '#e2e8f0'; g.font = '16px monospace'; g.fillText(`${label} · ${date}`, left + 10, top + S - 12);
    });
  }
  const X = 790;
  const stat = (label: string, value: string, y: number, color: string) => {
    g.fillStyle = '#94a3b8'; g.font = '16px monospace'; g.fillText(label, X, y);
    g.fillStyle = color; g.font = '800 40px sans-serif'; g.fillText(value, X, y + 44);
  };
  stat('INVESTIGATOR', o.callsign.slice(0, 16), 232, '#f8fafc');
  stat('RANK', o.rank, 322, '#38bdf8');
  stat('SCORE', `${o.score}%  ·  +${o.xp} XP`, 412, '#fbbf24');
  stat('PEAK NEW WATER (EST.)', `~${o.areaKm2} km²`, 502, '#00F0FF');
  g.fillStyle = '#64748b'; g.font = '14px sans-serif';
  g.fillText('Experimental estimate. Contains modified Copernicus Sentinel-1 data, via Microsoft Planetary Computer.', 50, H - 36);
  try {
    const url = c.toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = `terralens-mission-${o.missionId}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  } catch { return false; }   // the radar images could not be read back (cross-origin)
}
