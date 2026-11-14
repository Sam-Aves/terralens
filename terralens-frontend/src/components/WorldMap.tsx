import React, { useEffect, useRef } from 'react';
import { Map, Marker, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface WorldMarker {
  id: string;
  lng: number;
  lat: number;
  label: string;
  kind: 'mission' | 'locked' | 'mystery' | 'decoded';
}

interface WorldMapProps {
  markers: WorldMarker[];
  selectedId?: string | null;
  /** Fly here when it changes (search results, list clicks). */
  focus?: { lng: number; lat: number; zoom?: number; nonce: number } | null;
  onMarkerClick?: (id: string) => void;
}

const COLORS = { mission: '#00F0FF', locked: '#64748b', mystery: '#fbbf24', decoded: '#34d399' } as const;

export const WorldMap: React.FC<WorldMapProps> = ({ markers, selectedId, focus, onMarkerClick }) => {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const live = useRef<Marker[]>([]);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  useEffect(() => {
    if (!box.current) return;
    const map = new Map({
      container: box.current,
      center: [60, 12],
      zoom: 1.6,
      style: {
        version: 8,
        sources: { sat: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: '© Esri / Maxar',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } },
        layers: [{ id: 'sat-layer', type: 'raster', source: 'sat' }],
      },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    live.current.forEach(m => m.remove());
    live.current = markers.map(m => {
      const el = document.createElement('button');
      el.type = 'button';
      el.title = m.label;
      el.setAttribute('aria-label', m.label);
      const c = COLORS[m.kind];
      const sel = m.id === selectedId;
      el.className = `tl-pin tl-pin--${m.kind}${sel ? ' tl-pin--sel' : ''}`;
      el.style.setProperty('--pc', c);
      el.textContent = m.kind === 'mystery' ? '?' : m.kind === 'locked' ? '🔒' : m.kind === 'decoded' ? '✓' : '';
      el.addEventListener('click', e => { e.stopPropagation(); clickRef.current?.(m.id); });
      return new Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
    });
  }, [markers, selectedId]);

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 5, duration: 1400 });
  }, [focus]);

  return <div ref={box} style={{ position: 'absolute', inset: 0 }} />;
};
