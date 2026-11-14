import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { CosmicBackground } from '../components/CosmicBackground';

// ─── Palette (mirrors game_console.gd and title_wave.gd) ──────────────────────
const C = {
  CREAM:      '#FDF5CC',
  CREAM_DARK: '#EBC276',
  NAVY:       '#05102E',
  BLUE:       '#1F85E0',
  CYAN:       '#73D9FF',
  MINT:       '#73FFBE',
  AMBER:      '#FFB84D',
  BTN_FACE:   '#FF9E25',
  BTN_HOVER:  '#FFB040',
  BTN_RIM:    '#FFE68C',
  BTN_DARK:   '#B34700',
  BTN_GLOW:   '#FF9910',
};

// ─── Web Audio synth (mirrors Godot procedural tone generator) ────────────────
class RetroAudio {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private init() {
    if (!this.ctx) {
      const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
      this.ctx = new (window.AudioContext || W.webkitAudioContext!)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.12) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = type;
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // AudioContext blocked
    }
  }

  playFanfare() {
    if (!this.enabled) return;
    [440, 554.37, 659.25, 880].forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 0.18, 'triangle', 0.14);
      }, i * 75);
    });
  }
}

const audio = new RetroAudio();

// ─── TitleWave Canvas (100% faithful port of title_wave.gd) ───────────────────
const TEXT = 'TERRALENS';
const ROT = [-0.05, 0.04, -0.03, 0.06, -0.04, 0.03, -0.05, 0.04, -0.02];
const DY  = [0.0, -9.0, 5.0, -11.0, 3.0, -7.0, 7.0, -5.0, 0.0];
const SC  = [1.0, 1.05, 0.97, 1.08, 1.0, 0.98, 1.06, 1.0, 1.04];

// [letter index, dx, dy, radius, phase, navy-on-letter?]
const SPARKS: [number, number, number, number, number, boolean][] = [
  [0, -52.0, -66.0, 17.0, 0.0, false],
  [2, 34.0,  -74.0, 11.0, 1.3, false],
  [5, 6.0,   -78.0, 13.0, 2.1, false],
  [8, 56.0,  -52.0, 18.0, 0.7, false],
  [1, -44.0,  62.0, 10.0, 2.8, false],
  [4, 26.0,   66.0, 12.0, 1.9, false],
  [7, -36.0,  64.0, 9.0,  0.3, false],
  [0, 2.0,   -14.0, 7.0,  0.5, true],
  [2, 4.0,    6.0,  6.0,  1.1, true],
  [3, -6.0,  -20.0, 7.0,  2.4, true],
  [6, 8.0,    2.0,  6.0,  1.7, true],
  [8, -4.0,  -10.0, 7.0,  0.9, true],
];

const TitleWaveCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for custom fonts to load into the browser context
    document.fonts.ready.then(() => {
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    const drawStar = (c: { x: number; y: number }, r: number, color: string, glow: boolean) => {
      ctx.save();
      if (glow) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fill();
      }

      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI / 2.0 + (k * Math.PI) / 4.0;
        const rr = k % 2 === 0 ? r : r * 0.26;
        const px = c.x + Math.cos(a) * rr;
        const py = c.y + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const t = tRef.current;
      const titleSize = 104;
      ctx.font = `900 ${titleSize}px 'Bagel Fat One', cursive, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      const n = TEXT.length;
      const gap = -6.0;
      const widths: number[] = [];
      let totalW = 0;

      for (let i = 0; i < n; i++) {
        const cw = ctx.measureText(TEXT[i]).width;
        widths.push(cw);
        totalW += cw + gap;
      }
      totalW -= gap;

      let curX = (W - totalW) * 0.5;
      const baseY = 118.0;
      const centers: { x: number; y: number }[] = [];

      for (let i = 0; i < n; i++) {
        const cw = widths[i];
        const cx = curX + cw * 0.5;
        const cy = baseY + DY[i] + Math.sin(t * 1.7 + i * 0.75) * 5.0;
        const rot = ROT[i] + Math.sin(t * 1.3 + i * 0.9) * 0.035;
        const sc = SC[i];
        centers.push({ x: cx, y: cy });

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.scale(sc, sc);

        const ch = TEXT[i];
        const px = -cw * 0.5;
        const py = titleSize * 0.34;

        // Layer 1: Outer deep navy shadow outline
        ctx.lineWidth = 28;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0, 5, 25, 0.45)';
        ctx.strokeText(ch, px, py + 16);

        // Layer 2: Main deep navy border
        ctx.lineWidth = 24;
        ctx.strokeStyle = C.NAVY;
        ctx.strokeText(ch, px, py + 3.5);

        // Layer 3: Cyan/electric blue accent stroke
        ctx.lineWidth = 14;
        ctx.strokeStyle = C.BLUE;
        ctx.strokeText(ch, px, py + 3.5);

        // Layer 4: Dark cream depth
        ctx.fillStyle = C.CREAM_DARK;
        ctx.fillText(ch, px, py + 7);
        ctx.fillText(ch, px, py + 3.5);

        // Layer 5: Bright top cream face
        ctx.fillStyle = C.CREAM;
        ctx.fillText(ch, px, py);

        ctx.restore();
        curX += cw + gap;
      }

      // Render twinkling 8-pointed star sparks (SPARKS)
      for (const s of SPARKS) {
        const center = centers[s[0]];
        if (!center) continue;
        const scX = center.x + s[1];
        const scY = center.y + s[2];
        const tw = 0.55 + 0.45 * Math.sin(t * 2.6 + s[4] * 2.0);
        const radius = s[3] * (s[5] ? 0.7 + 0.3 * tw : tw);
        const col = s[5] ? C.NAVY : C.CREAM;
        drawStar({ x: scX, y: scY }, radius, col, !s[5]);
      }

      // Subtitle ribbon box (matching title_wave.gd)
      const subText = 'SYNTHETIC APERTURE RADAR DISASTER RESPONSE LAB';
      ctx.font = "700 13px 'Lilita One', cursive, sans-serif";
      const subW = ctx.measureText(subText).width;
      const rectW = subW + 68;
      const rectH = 32;
      const rectX = (W - subW) * 0.5 - 34;
      const rectY = 196;

      // Glow & rounded rect
      ctx.save();
      ctx.shadowColor = 'rgba(115, 217, 255, 0.35)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(5, 18, 46, 0.85)';
      ctx.strokeStyle = 'rgba(115, 217, 255, 0.75)';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.roundRect(rectX, rectY, rectW, rectH, 16);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Subtitle text
      ctx.fillStyle = C.CYAN;
      ctx.fillText(subText, rectX + 34, rectY + 20.5);

      // Side decorative stars
      drawStar({ x: rectX + 16, y: rectY + rectH / 2 }, 6, C.CREAM, false);
      drawStar({ x: rectX + rectW - 16, y: rectY + rectH / 2 }, 6, C.CREAM, false);

      tRef.current += 0.016;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [ready]);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '960px', height: '240px', display: 'flex', justifyContent: 'center' }}>
      <canvas
        ref={canvasRef}
        width={960}
        height={240}
        style={{ width: '960px', height: '240px', display: 'block', pointerEvents: 'none' }}
      />
    </div>
  );
};

// ─── Pilot Radar Badge (Canvas from game_console.gd) ──────────────────────────
const PilotRadarBadge: React.FC<{ focused: boolean }> = ({ focused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const R = 36;
      const t = tRef.current;
      const f = focused ? 1.0 : 0.0;

      // Dark radar background
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = '#081B3A';
      ctx.fill();

      // Crosshairs
      ctx.strokeStyle = 'rgba(115, 217, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
      ctx.stroke();

      // Concentric range rings
      [R * 0.55, R * 0.95].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(115, 217, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      // Sweep trail
      const sweepAngle = t * (2.0 + 2.2 * f);
      for (let i = 0; i < 16; i++) {
        const s0 = sweepAngle - i * 0.07;
        const s1 = s0 - 0.07;
        const alpha = 0.45 * (1 - i / 16);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, s0, s1, false);
        ctx.closePath();
        ctx.fillStyle = `rgba(115, 255, 190, ${alpha})`;
        ctx.fill();
      }

      // Sweep lead beam
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);
      ctx.strokeStyle = 'rgba(253, 245, 204, 0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Blips
      const blips: [number, number][] = [[0.9, 0.6], [3.4, 0.4], [5.2, 0.75]];
      blips.forEach(([ba, br]) => {
        const diff = ((sweepAngle - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const alpha = Math.max(0, 1 - diff / 3.0);
        if (alpha > 0.03) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ba) * R * br, cy + Math.sin(ba) * R * br, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 184, 77, ${alpha})`;
          ctx.fill();
        }
      });

      // Outer bezel ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = C.CREAM;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Little Level Badge
      const bx = cx + 24;
      const by = cy + 24;
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fillStyle = C.BTN_FACE;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.strokeStyle = C.CREAM;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "bold 13px 'Bagel Fat One', cursive, sans-serif";
      ctx.fillStyle = C.NAVY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1', bx, by + 1);

      tRef.current += 0.016;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [focused]);

  return <canvas ref={canvasRef} width={88} height={88} style={{ display: 'block', flexShrink: 0 }} />;
};

// ─── Orbiting Satellite Canvas around Play Button ─────────────────────────────
const OrbitingSatellite: React.FC<{ hovered: boolean }> = ({ hovered }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const oc = { x: W / 2, y: H / 2 };
      const oa = W / 2 - 12;
      const ob = 44;
      const t = tRef.current;

      // Orbit dashes
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(253, 245, 204, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(oc.x, oc.y, oa, ob, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const speed = hovered ? 1.4 : 0.8;
      const th = t * speed;

      const sx = oc.x + Math.cos(th) * oa;
      const sy = oc.y + Math.sin(th) * ob;

      // Ion tail trail
      for (let j = 7; j > 0; j--) {
        const tj = th - j * 0.06;
        const tx = oc.x + Math.cos(tj) * oa;
        const ty = oc.y + Math.sin(tj) * ob;
        ctx.beginPath();
        ctx.arc(tx, ty, 3.0 - j * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(115, 217, 255, ${0.3 - j * 0.04})`;
        ctx.fill();
      }

      // Satellite craft
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(t * 1.5) * 0.35);

      // Solar Wings
      ctx.fillStyle = C.CYAN;
      ctx.fillRect(-16, -3, 10, 6);
      ctx.fillRect(6, -3, 10, 6);
      ctx.strokeStyle = C.NAVY;
      ctx.lineWidth = 1;
      ctx.strokeRect(-16, -3, 10, 6);
      ctx.strokeRect(6, -3, 10, 6);

      // Bus Body
      ctx.fillStyle = C.CREAM;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeStyle = C.NAVY;
      ctx.strokeRect(-5, -5, 10, 10);

      // Dish
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(0, -9);
      ctx.strokeStyle = C.CREAM;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -10, 2, 0, Math.PI * 2);
      ctx.fillStyle = C.AMBER;
      ctx.fill();

      ctx.restore();

      tRef.current += 0.016;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [hovered]);

  return (
    <canvas
      ref={canvasRef}
      width={460}
      height={110}
      style={{
        position: 'absolute',
        top: '-20px',
        left: '-55px',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
};

// ─── Callsign Scrambler Logic ─────────────────────────────────────────────────
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%/<>+';
function scramble(target: string, progress: number): string {
  const revealed = Math.floor(progress * target.length * 1.1);
  return target
    .split('')
    .map((ch, i) => (i < revealed || ch === '-' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
    .join('');
}

// ─── Main Welcome Screen ──────────────────────────────────────────────────────
interface WelcomeScreenProps {
  callsign?: string;
  onCallsignChange?: (callsign: string) => void;
  onEnter?: () => void;
  onStartMission?: (callsign: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  callsign = 'EXPLORER-01',
  onCallsignChange,
  onEnter,
  onStartMission,
}) => {
  const [displayText, setDisplayText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isBtnHovered, setIsBtnHovered] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scramble intro on mount
  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.08;
      setDisplayText(scramble(callsign, progress));
      if (progress >= 1.0) {
        clearInterval(interval);
        setDisplayText(callsign);
      }
    }, 45);
    return () => clearInterval(interval);
  }, [callsign]);

  const handleLaunch = () => {
    const finalName = (displayText || callsign).trim() || 'RADAR-AGENT';
    audio.playFanfare();
    onStartMission?.(finalName);
    setTimeout(() => {
      onEnter?.();
    }, 400);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        minHeight: '680px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#040611',
        userSelect: 'none',
        fontFamily: "'Lilita One', sans-serif",
      }}
    >
      {/* ── 1. REAL COSMIC WEBGL SHADER (Earth Orbit + Twinkling Stars + River Flood) ── */}
      <CosmicBackground />

      {/* ── 2. FOREGROUND INTERFACE ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '18px 36px',
        }}
      >
        {/* Top Agency Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 20px',
              borderRadius: '16px',
              backgroundColor: 'rgba(5, 18, 46, 0.75)',
              border: '2px solid rgba(115, 217, 255, 0.55)',
              boxShadow: '0 0 16px rgba(115, 217, 255, 0.2)',
              fontSize: '13px',
              color: 'rgba(253, 245, 204, 0.92)',
              letterSpacing: '0.8px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: C.CYAN,
                boxShadow: `0 0 10px ${C.CYAN}`,
              }}
            />
            NASA–ISRO EARTH OBSERVATION PROGRAM // NISAR &amp; SENTINEL-1
          </div>

          <button
            onClick={() => {
              audio.enabled = !soundEnabled;
              setSoundEnabled(!soundEnabled);
            }}
            style={{
              background: 'rgba(5, 18, 46, 0.75)',
              border: '1px solid rgba(115, 217, 255, 0.4)',
              borderRadius: '8px',
              color: soundEnabled ? C.CYAN : '#64748b',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? 'SND: ON' : 'SND: OFF'}</span>
          </button>
        </header>

        {/* Center Hero: TitleWave Canvas + Console */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {/* Exact Bagel Fat One Animated Canvas */}
          <TitleWaveCanvas />

          {/* Console Box */}
          <div
            style={{
              width: '460px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              marginTop: '12px',
            }}
          >
            {/* Callsign Pill + Radar Badge */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <PilotRadarBadge focused={isFocused} />

              <div
                style={{
                  flex: 1,
                  height: '62px',
                  borderRadius: '31px',
                  backgroundColor: 'rgba(5, 18, 46, 0.85)',
                  border: `2px solid ${isFocused ? C.CYAN : 'rgba(115, 217, 255, 0.45)'}`,
                  boxShadow: isFocused ? '0 0 20px rgba(115, 217, 255, 0.4)' : '0 0 10px rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 20px',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={displayText}
                  maxLength={18}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setDisplayText(val);
                    onCallsignChange?.(val);
                    audio.playTone(720, 0.02, 'sine', 0.08);
                  }}
                  onFocus={() => {
                    setIsFocused(true);
                    audio.playTone(600, 0.04, 'triangle', 0.1);
                  }}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLaunch();
                  }}
                  placeholder="TYPE YOUR CALLSIGN"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    textAlign: 'center',
                    fontFamily: "'Bagel Fat One', cursive, sans-serif",
                    fontSize: '24px',
                    color: C.CREAM,
                    caretColor: C.AMBER,
                    letterSpacing: '1px',
                  }}
                />
              </div>
            </div>

            {/* Launch Play Button with Orbiting Satellite */}
            <div style={{ position: 'relative', width: '350px' }}>
              <OrbitingSatellite hovered={isBtnHovered} />

              <button
                onClick={handleLaunch}
                onMouseEnter={() => {
                  setIsBtnHovered(true);
                  audio.playTone(640, 0.05, 'sine', 0.1);
                }}
                onMouseLeave={() => setIsBtnHovered(false)}
                style={{
                  width: '100%',
                  height: '68px',
                  borderRadius: '34px',
                  border: `3px solid ${C.BTN_RIM}`,
                  backgroundColor: isBtnHovered ? C.BTN_HOVER : C.BTN_FACE,
                  color: C.NAVY,
                  fontSize: '22px',
                  fontFamily: "'Lilita One', sans-serif",
                  fontWeight: 900,
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  boxShadow: `
                    0 8px 0 ${C.BTN_DARK},
                    0 12px 24px rgba(255, 158, 37, 0.45)
                  `,
                  transform: isBtnHovered ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  zIndex: 10,
                }}
              >
                ENTER MISSION CONTROL
              </button>
            </div>
          </div>
        </main>

        {/* Footer Chips */}
        <footer
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            paddingBottom: '10px',
          }}
        >
          {['SENTINEL-1 C-BAND', 'NISAR L-BAND', 'NASA EARTHDATA OPEN TILES'].map((txt) => (
            <div
              key={txt}
              style={{
                padding: '4px 16px',
                borderRadius: '16px',
                backgroundColor: 'rgba(5, 18, 46, 0.65)',
                border: '1px solid rgba(115, 217, 255, 0.4)',
                fontSize: '12px',
                color: 'rgba(253, 245, 204, 0.85)',
                letterSpacing: '0.6px',
              }}
            >
              {txt}
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
};
