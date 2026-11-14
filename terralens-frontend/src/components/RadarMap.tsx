import React, { useEffect, useRef, useState } from 'react';
import { Map, NavigationControl } from 'maplibre-gl';
import type { RasterTileSource, ImageSource, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { JAMUNA_S1, WATER_VH_DB, s1DisplayTileUrl } from '../data/sentinel1';
import type { AnalysisStatus, ChangeOverlay, S1Mission, StageStats } from '../data/sentinel1';

// Kept for older imports: the Jamuna stage list
export const TIMELINE_STAGES = JAMUNA_S1.stages;

const ARCGIS_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ARCGIS_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

function buildImageryStyle() {
  return {
    version: 8 as const,
    sources: {
      sat:    { type: 'raster' as const, tiles: [ARCGIS_IMAGERY], tileSize: 256, maxzoom: 19,
                attribution: '© Esri / Maxar / NASA EarthData' },
      labels: { type: 'raster' as const, tiles: [ARCGIS_LABELS], tileSize: 256 },
    },
    layers: [
      { id: 'sat-layer',    type: 'raster' as const, source: 'sat' },
      { id: 'labels-layer', type: 'raster' as const, source: 'labels' },
    ],
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface RadarMapProps {
  coordinates:     [number, number];
  zoom?:           number;
  showFloodLayer?: boolean;
  showImpactLayer?: boolean;
  timelineIndex?:  number;        // 0–3, drives the POST map flood stage
  radarBand?:      'optical' | 'c-band' | 'l-band'; // Sensor sandbox frequency
  /** Sentinel-1 scenes, study area and timeline of the mission on screen (null = optical basemap only). */
  s1?:             S1Mission | null;
  /** Change-detection result for the selected date (null until computed). */
  stageStats?:     StageStats | null;
  /** Computed water / new-water mask for the selected date. */
  overlay?:        ChangeOverlay | null;
  analysisStatus?: AnalysisStatus;
  /** Places the player has marked; `correct` is null until they have been checked. */
  marks?:          { id: number; lng: number; lat: number; correct: boolean | null }[];
  /** Radius of each mark on the ground, metres. */
  markRadiusM?:    number;
  /** When true the map shows a crosshair and reports clicks through onMapClick. */
  markMode?:       boolean;
  onMapClick?:     (lng: number, lat: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const RadarMap: React.FC<RadarMapProps> = ({
  coordinates,
  zoom = 10,
  showFloodLayer  = true,
  showImpactLayer = false,
  timelineIndex   = 2,
  radarBand       = 'c-band',
  s1              = null,
  stageStats      = null,
  overlay         = null,
  analysisStatus  = 'idle',
  marks,
  markRadiusM     = 1500,
  markMode        = false,
  onMapClick,
}) => {
  const s1Enabled = !!s1;
  const stages = s1?.stages ?? JAMUNA_S1.stages;
  // Read through a ref inside map callbacks that are bound once
  const s1Ref = useRef(s1);
  s1Ref.current = s1;
  const [swipePct, setSwipePct]   = useState(50);
  const [preMin,   setPreMin]     = useState(false);
  const [postMin,  setPostMin]    = useState(false);
  const [postLoaded, setPostLoaded] = useState(false);
  const [loadTick, setLoadTick]     = useState(0); // bumps whenever a map finishes loading its style
  const [vpWidth, setVpWidth]     = useState(0); // live width of the map viewport (keeps PRE map aligned with POST)

  const viewportRef    = useRef<HTMLDivElement>(null);
  const preMap_divRef  = useRef<HTMLDivElement>(null);
  const postMap_divRef = useRef<HTMLDivElement>(null);
  const mapPreRef      = useRef<Map | null>(null);
  const mapPostRef     = useRef<Map | null>(null);
  const isDragging     = useRef(false);
  const syncingRef     = useRef(false);
  const s1UrlRef       = useRef<{ pre: string | null; post: string | null }>({ pre: null, post: null });
  const overlayUrlRef  = useRef<string | null>(null);
  // Which map instances have finished loading (layers may only be added to these)
  const readyRef       = useRef<{ pre: Map | null; post: Map | null }>({ pre: null, post: null });
  // Latest click handler, so the map listeners (bound once) never call a stale one
  const clickRef       = useRef<{ on: boolean; fn?: (lng: number, lat: number) => void }>({ on: false });
  clickRef.current     = { on: markMode, fn: onMapClick };

  // ── Bootstrap maps once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!preMap_divRef.current || !postMap_divRef.current) return;

    const style = buildImageryStyle();

    const mapPost = new Map({
      container: postMap_divRef.current,
      style,
      center: coordinates,
      zoom,
      attributionControl: false,
    });
    mapPost.addControl(new NavigationControl(), 'top-right');

    const mapPre = new Map({
      container: preMap_divRef.current,
      style: JSON.parse(JSON.stringify(style)),
      center: coordinates,
      zoom,
      attributionControl: false,
    });

    mapPostRef.current = mapPost;
    mapPreRef.current  = mapPre;

    // Sync pan/zoom
    const sync = (src: Map, dst: Map) => {
      src.on('move', () => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        dst.setCenter(src.getCenter());
        dst.setZoom(src.getZoom());
        dst.setBearing(src.getBearing());
        dst.setPitch(src.getPitch());
        syncingRef.current = false;
      });
    };
    sync(mapPost, mapPre);
    sync(mapPre, mapPost);

    mapPre.on('load', () => { readyRef.current.pre = mapPre; setLoadTick(t => t + 1); });

    // Clicks on either side of the swipe line report the same ground position
    [mapPre, mapPost].forEach(m => m.on('click', e => {
      if (clickRef.current.on) clickRef.current.fn?.(e.lngLat.lng, e.lngLat.lat);
    }));

    // Add community markers to POST map on load (the water mask is added when it has been computed)
    mapPost.on('load', () => {
      // Community circles
      (s1Ref.current?.communities ?? []).forEach(pt => {
        const id = `impact-${pt.name}`;
        mapPost.addSource(id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: pt.name, affected: pt.affected },
            geometry: { type: 'Point', coordinates: pt.coords },
          },
        });
        mapPost.addLayer({
          id:     `circle-${id}`,
          type:   'circle',
          source: id,
          paint: {
            'circle-radius':       10,
            'circle-color':        '#f97316',
            'circle-opacity':      showImpactLayer ? 0.85 : 0,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        });
      });

      readyRef.current.post = mapPost;
      setPostLoaded(true);
      setLoadTick(t => t + 1);
    });

    return () => {
      mapPost.remove();
      mapPre.remove();
      mapPostRef.current = null;
      mapPreRef.current  = null;
      readyRef.current   = { pre: null, post: null };
      s1UrlRef.current   = { pre: null, post: null };
      overlayUrlRef.current = null;
      setPostLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Real Sentinel-1 scenes: baseline date on the PRE map, selected date on the POST map ──
  const sarOn = s1Enabled && radarBand !== 'optical';

  useEffect(() => {
    const apply = (map: Map | null, side: 'pre' | 'post', itemId: string) => {
      if (!map) return;
      const url = s1DisplayTileUrl(itemId);
      const src = map.getSource('s1') as RasterTileSource | undefined;
      if (!src) {
        if (!sarOn) return;
        map.addSource('s1', {
          type: 'raster',
          tiles: [url],
          tileSize: 256,
          minzoom: 6,
          maxzoom: 14,
          bounds: s1?.sceneBounds,
          attribution: 'Contains modified Copernicus Sentinel data (2024) · Microsoft Planetary Computer',
        });
        map.addLayer(
          { id: 's1-layer', type: 'raster', source: 's1', paint: { 'raster-fade-duration': 250 } },
          map.getLayer('change-layer') ? 'change-layer' : 'labels-layer'
        );
      } else if (s1UrlRef.current[side] !== url) {
        src.setTiles([url]);
      }
      s1UrlRef.current[side] = url;
      if (map.getLayer('s1-layer')) map.setLayoutProperty('s1-layer', 'visibility', sarOn ? 'visible' : 'none');
      // Hide the optical basemap under the radar scene so the two are never mixed up
      if (map.getLayer('sat-layer')) map.setLayoutProperty('sat-layer', 'visibility', sarOn ? 'none' : 'visible');
    };
    const stage = stages[timelineIndex] ?? stages[2];
    const ready = readyRef.current;
    if (ready.pre  && ready.pre  === mapPreRef.current)  apply(ready.pre,  'pre',  stages[0].itemId);
    if (ready.post && ready.post === mapPostRef.current) apply(ready.post, 'post', stage.itemId);
  }, [sarOn, timelineIndex, loadTick, s1]);

  // ── Computed change mask (new water / water on both dates) on the POST map ──
  useEffect(() => {
    const map = mapPostRef.current;
    if (!map || readyRef.current.post !== map) return;
    if (overlay) {
      const src = map.getSource('change') as ImageSource | undefined;
      if (!src) {
        map.addSource('change', { type: 'image', url: overlay.url, coordinates: overlay.coordinates });
        map.addLayer(
          { id: 'change-layer', type: 'raster', source: 'change',
            paint: { 'raster-opacity': 0.9, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } },
          'labels-layer'
        );
        // Dashed outline of the study area the statistics refer to
        const [w, s, e, n] = s1?.aoi ?? JAMUNA_S1.aoi;
        map.addSource('aoi', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[w, n], [e, n], [e, s], [w, s], [w, n]] } },
        });
        map.addLayer(
          { id: 'aoi-layer', type: 'line', source: 'aoi',
            paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.9, 'line-dasharray': [3, 2] } },
          'labels-layer'
        );
      } else if (overlayUrlRef.current !== overlay.url) {
        src.updateImage({ url: overlay.url, coordinates: overlay.coordinates });
      }
      overlayUrlRef.current = overlay.url;
    }
    const vis = overlay && showFloodLayer && sarOn ? 'visible' : 'none';
    if (map.getLayer('change-layer')) map.setLayoutProperty('change-layer', 'visibility', vis);
    // The study-area outline stays on even when the mask is hidden, so marks can be placed inside it
    if (map.getLayer('aoi-layer'))    map.setLayoutProperty('aoi-layer', 'visibility', overlay && sarOn ? 'visible' : 'none');
  }, [overlay, showFloodLayer, sarOn, loadTick]);

  // ── Player's marks: one circle per mark on both maps, sized in real metres ──
  useEffect(() => {
    const data = {
      type: 'FeatureCollection' as const,
      features: (marks ?? []).map(m => ({
        type: 'Feature' as const,
        properties: { state: m.correct === null ? 'pending' : m.correct ? 'right' : 'wrong' },
        geometry: { type: 'Point' as const, coordinates: [m.lng, m.lat] },
      })),
    };
    // MapLibre zoom uses 512 px tiles: metres per pixel = 78271.52 · cos(lat) / 2^zoom
    const pxAtZoom0 = markRadiusM / (78271.52 * Math.cos((coordinates[1] * Math.PI) / 180));
    const colour = ['match', ['get', 'state'], 'right', '#22c55e', 'wrong', '#ef4444', '#FFD166'] as unknown as string;
    const ready = readyRef.current;
    [ready.pre, ready.post].forEach(map => {
      if (!map || (map !== mapPreRef.current && map !== mapPostRef.current)) return;
      const src = map.getSource('marks') as GeoJSONSource | undefined;
      if (src) { src.setData(data); return; }
      if (!data.features.length) return;
      map.addSource('marks', { type: 'geojson', data });
      map.addLayer({
        id: 'marks-layer', type: 'circle', source: 'marks',
        paint: {
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, pxAtZoom0, 22, pxAtZoom0 * 2 ** 22],
          'circle-color': colour,
          'circle-opacity': 0.22,
          'circle-stroke-color': colour,
          'circle-stroke-width': 2.5,
        },
      });
    });
  }, [marks, markRadiusM, coordinates, loadTick]);

  // ── React to showImpactLayer toggle ──────────────────────────────────────
  useEffect(() => {
    const map = mapPostRef.current;
    if (!map || !postLoaded) return;
    (s1?.communities ?? []).forEach(pt => {
      const lid = `circle-impact-${pt.name}`;
      if (map.getLayer(lid))
        map.setPaintProperty(lid, 'circle-opacity', showImpactLayer ? 0.85 : 0);
    });
  }, [showImpactLayer, postLoaded, s1]);

  // ── Fly to mission location changes ──────────────────────────────────────
  useEffect(() => {
    mapPostRef.current?.flyTo({ center: coordinates, zoom, duration: 1800 });
    mapPreRef.current?.flyTo({ center: coordinates, zoom, duration: 1800 });
  }, [coordinates, zoom]);

  // ── Keep the PRE map exactly as wide as the viewport, whatever the layout ─
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setVpWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!vpWidth) return;
    mapPreRef.current?.resize();
    mapPostRef.current?.resize();
  }, [vpWidth]);

  // ── Swipe drag ────────────────────────────────────────────────────────────
  const onHandleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); isDragging.current = true; };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const pct  = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      setSwipePct(pct);
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  const effectivePct  = preMin ? 0 : postMin ? 100 : swipePct;
  const currentStage  = stages[timelineIndex] ?? stages[2];
  const baseStage     = stages[0];
  const isBaseline    = timelineIndex === 0;
  // Short text for the computed result on the selected date
  const newWaterText  = !s1Enabled || analysisStatus === 'idle' ? currentStage.label
    : isBaseline ? 'baseline date'
    : stageStats ? `${stageStats.newKm2.toFixed(1)} km² new water`
    : analysisStatus === 'error' ? 'analysis unavailable'
    : 'analysing…';

  // Flood-stage colour cue: green → amber → red → amber
  const stageColor = ['#73D9FF', '#FFB84D', '#FF4365', '#fbbf24'][timelineIndex] ?? '#73D9FF';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Panel header row (Swipe Bar) ────────────────────────────── */}
      <div style={{
        display: 'flex',
        height: '36px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 5,
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
      }}>
        {/* PRE side */}
        <div style={{
          flex: preMin ? '0 0 44px' : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px', gap: '8px', minWidth: 0,
          background: 'rgba(5,15,40,0.92)',
          borderBottom: '2px solid rgba(115,217,255,0.5)',
          borderRight:  '1px solid rgba(51,65,85,0.5)',
          transition: 'flex 0.3s ease', overflow: 'hidden',
        }}>
          {!preMin && (
            <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700,
              color: '#73D9FF', letterSpacing: '0.5px', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              ◀ PRE-FLOOD &nbsp;|&nbsp; {baseStage.date} — {s1Enabled ? 'Sentinel-1 baseline' : 'Dry Baseline'}
            </span>
          )}
          <button onClick={() => { setPreMin(v => !v); if (preMin) setSwipePct(50); }}
            title={preMin ? 'Expand' : 'Collapse PRE panel'}
            style={{ background: 'rgba(115,217,255,0.12)', border: '1px solid rgba(115,217,255,0.4)',
              color: '#73D9FF', borderRadius: '4px', cursor: 'pointer', fontSize: '10px',
              padding: '2px 6px', flexShrink: 0 }}>
            {preMin ? '⇥' : '⇤'}
          </button>
        </div>

        {/* POST side — label changes with timeline */}
        <div style={{
          flex: postMin ? '0 0 44px' : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px', gap: '8px', minWidth: 0,
          background: 'rgba(5,15,40,0.92)',
          borderBottom: `2px solid ${stageColor}88`,
          borderLeft: '1px solid rgba(51,65,85,0.5)',
          transition: 'flex 0.3s ease', overflow: 'hidden',
        }}>
          <button onClick={() => { setPostMin(v => !v); if (postMin) setSwipePct(50); }}
            title={postMin ? 'Expand' : 'Collapse POST panel'}
            style={{ background: `${stageColor}22`, border: `1px solid ${stageColor}66`,
              color: stageColor, borderRadius: '4px', cursor: 'pointer', fontSize: '10px',
              padding: '2px 6px', flexShrink: 0 }}>
            {postMin ? '⇤' : '⇥'}
          </button>
          {!postMin && (
            <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700,
              color: stageColor, letterSpacing: '0.5px', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
              title={`${currentStage.date} — ${currentStage.label} | ${newWaterText}`}>
              {currentStage.date} — {currentStage.label} &nbsp;|&nbsp; {newWaterText} ▶
            </span>
          )}
        </div>
      </div>

      {/* ── Map viewport ────────────────────────────────────────────────── */}
      <div ref={viewportRef} className={markMode ? 'tl-marking' : undefined}
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* POST map — full background (High-Contrast Synthetic Aperture Radar Grayscale Backscatter) */}
        <div ref={postMap_divRef} style={{
          position: 'absolute',
          inset: 0,
          // With real Sentinel-1 scenes loaded, C-band needs no filter (it is already radar).
          // Without them (other missions) the old grey filter over optical imagery is kept for now.
          filter: radarBand === 'l-band'
            ? (s1Enabled ? 'sepia(0.6) saturate(1.5) hue-rotate(-12deg)' : 'grayscale(0.7) contrast(1.5) brightness(0.9) sepia(0.3) hue-rotate(30deg)')
            : radarBand === 'c-band'
              ? (s1Enabled ? 'none' : 'grayscale(1) contrast(1.8) brightness(0.92)')
              : 'none'
        }} />

        {/* Optical Sensor Cloud Obstruction Overlay (When user selects OPTICAL band) */}
        {radarBand === 'optical' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 40% 50%, rgba(240, 245, 255, 0.88), rgba(200, 220, 240, 0.95))',
            backdropFilter: 'blur(10px)',
            pointerEvents: 'none',
            zIndex: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <div style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.9)',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              fontWeight: 800,
              boxShadow: '0 0 25px rgba(239, 68, 68, 0.6)',
              textAlign: 'center',
              letterSpacing: '1px'
            }}>
              ☁️ OPTICAL SENSOR BLINDED BY MONSOON CLOUD COVER (100%)
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#fef08a', marginTop: '4px' }}>
                SWITCH TO C-BAND SAR OR L-BAND (NISAR) TO PENETRATE CLOUDS & SURFACE VEGETATION
              </div>
            </div>
          </div>
        )}

        {/* L-Band NISAR Biomass / Canopy Penetration Shimmer Filter */}
        {radarBand === 'l-band' && (
          <div style={{
            position: 'absolute',
            top: '46px',
            right: '12px',
            background: 'rgba(251, 191, 36, 0.15)',
            border: '1px solid #fbbf24',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '10.5px',
            fontFamily: 'monospace',
            color: '#fbbf24',
            zIndex: 15,
            pointerEvents: 'none',
            fontWeight: 700
          }}>
            {s1Enabled
              ? '📡 SIMULATED L-BAND VIEW — tinted Sentinel-1 C-band; no NISAR scene loaded'
              : '📡 NISAR L-BAND (24 cm λ): PENETRATING DENSE VEGETATION CANOPY'}
          </div>
        )}

        {/* PRE map — clipped left half (Natural Color Optical Earth Baseline) */}
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: `${effectivePct}%`,
          overflow: 'hidden',
          transition: isDragging.current ? 'none' : 'width 0.15s ease',
        }}>
          <div ref={preMap_divRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: vpWidth ? `${vpWidth}px` : '100vw',
              filter: sarOn ? 'none' : 'saturate(1.2) contrast(1.05)',
            }} />
        </div>

        {/* Swipe handle */}
        {!preMin && !postMin && (
          <div onMouseDown={onHandleMouseDown}
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${swipePct}%`,
              width: '4px',
              backgroundColor: '#00F0FF',
              boxShadow: '0 0 14px rgba(0,240,255,0.9)',
              cursor: 'ew-resize',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: '30px', height: '30px', borderRadius: '50%',
              background: '#060913', border: '2px solid #00F0FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#00F0FF', fontSize: '13px', fontWeight: 'bold',
              userSelect: 'none', boxShadow: '0 0 10px rgba(0,240,255,0.6)',
            }}>↔</div>
          </div>
        )}

        {/* PRE label pill */}
        {effectivePct >= 10 && (
          <div style={{
            position: 'absolute', top: '10px', left: '10px',
            background: 'rgba(6,9,25,0.88)', border: '1px solid rgba(115,217,255,0.45)',
            borderRadius: '6px', padding: '4px 10px',
            fontSize: '10px', fontFamily: 'monospace', color: '#73D9FF', zIndex: 6,
            pointerEvents: 'none',
          }}>
            PRE · {baseStage.date} · {sarOn ? 'Sentinel-1A VV' : 'Dry Baseline'}
          </div>
        )}

        {/* POST label pill — updates with timeline */}
        {effectivePct <= 90 && (
          <div style={{
            position: 'absolute', top: '10px', right: '52px',
            background: 'rgba(6,9,25,0.88)', border: `1px solid ${stageColor}66`,
            borderRadius: '6px', padding: '4px 10px',
            fontSize: '10px', fontFamily: 'monospace', color: stageColor, zIndex: 6,
            pointerEvents: 'none',
          }}>
            POST · {currentStage.date} · {sarOn ? `Sentinel-1A VV · ${newWaterText}` : newWaterText}
          </div>
        )}

        {/* Flood-stage status banner (shown at bottom of POST side) */}
        {effectivePct <= 90 && s1Enabled && !isBaseline && stageStats && showFloodLayer && (
          <div style={{
            position: 'absolute', bottom: '12px', right: '12px',
            background: 'rgba(6,9,25,0.90)', border: `1px solid ${stageColor}66`,
            borderRadius: '8px', padding: '8px 14px',
            fontSize: '11px', fontFamily: 'monospace', color: stageColor, zIndex: 6,
            pointerEvents: 'none', maxWidth: '220px',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '3px' }}>⚡ {currentStage.status}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px', lineHeight: 1.45 }}>
              New water since {baseStage.date}: {stageStats.newKm2.toFixed(1)} km²<br />
              Experimental · VH &lt; {WATER_VH_DB} dB
            </div>
          </div>
        )}

        {/* SAR Legend */}
        <div style={{
          position: 'absolute', bottom: '12px', left: '12px',
          background: 'rgba(6,9,19,0.90)', border: '1px solid rgba(0,240,255,0.3)',
          borderRadius: '8px', padding: '10px 14px',
          fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8',
          display: 'flex', flexDirection: 'column', gap: '5px',
          zIndex: 6, pointerEvents: 'none',
        }}>
          <div style={{ color: '#00F0FF', fontWeight: 700, marginBottom: '3px' }}>SAR LEGEND</div>
          {s1Enabled && showFloodLayer && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '14px', height: '10px', background: 'rgba(0,240,255,0.8)',
                  border: '1.5px solid #00F0FF', borderRadius: '2px' }} />
                <span>New water since {baseStage.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '14px', height: '10px', background: 'rgba(59,130,246,0.75)',
                  border: '1.5px solid #3b82f6', borderRadius: '2px' }} />
                <span>Water on both dates</span>
              </div>
            </>
          )}
          {sarOn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '10px', border: '1.5px dashed #ffffff', borderRadius: '2px', boxSizing: 'border-box' }} />
              <span>Study area (statistics)</span>
            </div>
          )}
          {showImpactLayer && (s1?.communities.length ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', background: '#f97316',
                borderRadius: '50%', border: '2px solid white' }} />
              <span>Potentially exposed community</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '14px', height: '10px', background: 'rgba(255,255,255,0.1)',
              border: '1.5px solid #94a3b8', borderRadius: '2px' }} />
            <span>{sarOn ? 'Sentinel-1A VV backscatter (dark = smooth)' : 'Esri World Imagery (optical)'}</span>
          </div>
          <div style={{ marginTop: '3px', paddingTop: '5px', borderTop: '1px solid rgba(0,240,255,0.2)',
            fontSize: '9.5px', color: '#00F0FF', letterSpacing: '0.5px' }}>
            {s1Enabled ? 'COPERNICUS SENTINEL-1 (2024) · PLANETARY COMPUTER' : 'OPTICAL BASEMAP · ESRI'}
          </div>
        </div>
      </div>
    </div>
  );
};
