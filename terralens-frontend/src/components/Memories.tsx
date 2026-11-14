// "My Memories": a personal scrapbook inside the Research Journal.
// Everything the player writes here stays in this browser (localStorage).
import React, { useRef, useState } from 'react';

export interface Memory { id: string; date: string; title: string; text: string; mood: string; photo?: string }
const KEY = 'terralens.memories.v1';
const MOODS = ['🌊', '🛰️', '🌧️', '🌱', '😮', '😊', '💡', '❤️'];
const NOTE_COLOURS = ['#FFD166', '#7df9ff', '#f9a8d4', '#86efac', '#c4b5fd'];
const MAX_TEXT = 500;

function load(): Memory[] {
  try { const r = window.localStorage.getItem(KEY); return r ? (JSON.parse(r) as Memory[]) : []; } catch { return []; }
}
function save(list: Memory[]): boolean {
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

/** Shrinks a chosen picture so it fits in browser storage (longest side 480 px, JPEG). */
function shrink(file: File): Promise<string | null> {
  return new Promise(res => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 480 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d')?.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      try { res(c.toDataURL('image/jpeg', 0.8)); } catch { res(null); }
    };
    im.onerror = () => { URL.revokeObjectURL(url); res(null); };
    im.src = url;
  });
}

export const Memories: React.FC<{ onAdd?: () => void }> = ({ onAdd }) => {
  const [list, setList] = useState<Memory[]>(load);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [mood, setMood] = useState(MOODS[0]);
  const [photo, setPhoto] = useState<string | undefined>();
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const commit = (next: Memory[]) => {
    if (save(next)) { setList(next); return true; }
    setMsg('Could not save: browser storage is full. Remove a photo or an old memory.');
    return false;
  };
  const add = () => {
    if (!text.trim()) return;
    const m: Memory = { id: String(Date.now()), date: new Date().toISOString(), title: title.trim(), text: text.trim(), mood, photo };
    if (commit([m, ...list])) {
      setTitle(''); setText(''); setPhoto(undefined); setMsg('');
      if (fileRef.current) fileRef.current.value = '';
      onAdd?.();
    }
  };
  const field: React.CSSProperties = { padding: '10px 12px', borderRadius: '12px', background: 'rgba(6,9,19,0.7)', border: '2px solid #334155', color: '#f8fafc', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="tl-acard" data-tag="ONLY YOU SEE THIS" style={{ ['--ac' as string]: '#f9a8d4', display: 'flex', flexDirection: 'column', gap: '10px' } as React.CSSProperties}>
        <div className="tl-gsub" style={{ fontSize: '21px' }}>📔 MY MEMORIES</div>
        <div style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Write down anything you want to remember: what surprised you, a flood you lived through, an idea. Saved only in this browser.</div>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="Title (optional)" aria-label="Memory title" style={field} />
        <textarea value={text} onChange={e => setText(e.target.value.slice(0, MAX_TEXT))} rows={3} placeholder="Write your memory here…" aria-label="Your memory" style={{ ...field, resize: 'vertical' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>STICKER</span>
          {MOODS.map(m => (
            <button key={m} onClick={() => setMood(m)} aria-label={`Sticker ${m}`} aria-pressed={mood === m}
              style={{ width: '34px', height: '34px', borderRadius: '50%', fontSize: '17px', cursor: 'pointer', background: mood === m ? 'rgba(249,168,212,0.25)' : 'rgba(15,23,42,0.7)', border: mood === m ? '2px solid #f9a8d4' : '2px solid #334155', transform: mood === m ? 'scale(1.15)' : 'none', transition: 'transform 0.12s' }}>{m}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{text.length} / {MAX_TEXT}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ padding: '8px 14px', borderRadius: '20px', border: '2px dashed #64748b', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer' }}>
            📷 {photo ? 'Change photo' : 'Add a photo (optional)'}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const d = await shrink(f); if (d) { setPhoto(d); setMsg(''); } else setMsg('That picture could not be read.'); }} />
          </label>
          {photo && <img src={photo} alt="Chosen photo preview" style={{ height: '44px', borderRadius: '8px', border: '2px solid #FDF5CC' }} />}
          {photo && <button onClick={() => { setPhoto(undefined); if (fileRef.current) fileRef.current.value = ''; }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>remove</button>}
          <button className={text.trim() ? 'tl-btn3d' : 'tl-btn3d tl-btn3d--locked'} disabled={!text.trim()} onClick={add} style={{ marginLeft: 'auto', padding: '9px 22px', cursor: text.trim() ? 'pointer' : 'not-allowed' }}>SAVE MEMORY</button>
        </div>
        {msg && <div role="alert" style={{ fontSize: '12px', color: '#f87171' }}>{msg}</div>}
      </div>

      {list.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '6px' }}>No memories yet. Your first one will appear here as a sticky note.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '22px', padding: '6px 4px' }}>
          {list.map((m, i) => {
            const c = NOTE_COLOURS[Number(m.id) % NOTE_COLOURS.length];
            return (
              <div key={m.id} className="tl-note" style={{ ['--tilt' as string]: `${(i % 2 ? 1 : -1) * (1 + (Number(m.id) % 3))}deg`, background: c } as React.CSSProperties}>
                <span aria-hidden="true" style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', fontSize: '26px' }}>{m.mood}</span>
                <button onClick={() => { if (window.confirm('Delete this memory?')) commit(list.filter(x => x.id !== m.id)); }} aria-label="Delete this memory" title="Delete"
                  style={{ position: 'absolute', top: '6px', right: '8px', background: 'transparent', border: 'none', color: 'rgba(11,13,38,0.55)', fontSize: '15px', cursor: 'pointer' }}>✕</button>
                <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'rgba(11,13,38,0.65)', marginTop: '6px' }}>{new Date(m.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                {m.title && <div style={{ fontFamily: "'Lilita One', sans-serif", fontSize: '18px', color: '#0B0D26', lineHeight: 1.15 }}>{m.title}</div>}
                {m.photo && <img src={m.photo} alt={m.title ? `Photo for ${m.title}` : 'Memory photo'} style={{ width: '100%', borderRadius: '6px', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />}
                <div style={{ fontSize: '13px', color: '#0B0D26', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
