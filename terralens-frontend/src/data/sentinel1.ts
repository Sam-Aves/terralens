// TERRALENS — real Sentinel-1 radar scenes + in-browser change detection
//
// Imagery: Sentinel-1A IW, radiometrically terrain-corrected (RTC, gamma0),
// served as map tiles by the Microsoft Planetary Computer data API (public,
// no key). Contains modified Copernicus Sentinel data (2024).
//
// Method (experimental, not validated):
//   1. Read VH backscatter in dB for the study area on each date.
//   2. Classify a pixel as open water when VH < WATER_VH_DB.
//      (VH is used instead of VV because wind-roughened water often rises
//       above a VV threshold, which made the river "vanish" on windy dates.)
//   3. Drop isolated water pixels (speckle).
//   4. New water = water on the later date AND not water on the baseline date.
//   5. Area = sum of the true ground area of each pixel (varies with latitude).
// Known limits: smooth dry sand can look like water; flooded vegetation can
// look like land; one fixed threshold is a starting point, not a calibration.

const TILER = 'https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad';
const COLLECTION = 'sentinel-1-rtc';

/** Water / land threshold on VH backscatter, in dB. */
export const WATER_VH_DB = -20;

const GRID_ZOOM = 11;          // ~70 m pixels at this latitude
const VH_LO = -35;             // dB mapped to pixel value 0
const VH_HI = -5;              // dB mapped to pixel value 255

export interface S1Stage {
  date: string;
  itemId: string;
  label: string;
  status: string;
}

export type Bounds = [west: number, south: number, east: number, north: number];

export interface S1Community { coords: [number, number]; name: string; affected: number }

/** Everything the Radar Lab needs to show and analyse one mission's Sentinel-1 scenes. */
export interface S1Mission {
  platform: string;
  product: string;
  orbit: string;
  /** Study area used for the area statistics. */
  aoi: Bounds;
  /** Area covered by every scene in the series (same orbit track). */
  sceneBounds: Bounds;
  /** Where the map should open. */
  center: [number, number];
  zoom: number;
  /** First stage is the baseline the later dates are compared with. */
  stages: S1Stage[];
  /** Settlements shown as "potentially exposed" markers. */
  communities: S1Community[];
}

export const JAMUNA_S1: S1Mission = {
  platform: 'Sentinel-1A',
  product: 'RTC gamma0 (from IW GRD)',
  orbit: 'Ascending · relative orbit 114',
  aoi: [89.55, 24.35, 89.85, 24.65],
  sceneBounds: [88.8, 23.75, 91.54, 25.66],
  center: [89.7, 24.5],
  zoom: 10,
  stages: [
    {
      date: '2024-05-17',
      itemId: 'S1A_IW_GRDH_1SDV_20240517T120509_20240517T120534_053911_068D7E_rtc',
      label: 'Pre-Monsoon Baseline',
      status: 'Dry-season channels and exposed sandbars',
    },
    {
      date: '2024-06-22',
      itemId: 'S1A_IW_GRDH_1SDV_20240622T120508_20240622T120533_054436_069FAB_rtc',
      label: 'Early Monsoon Rise',
      status: 'River rising; low sandbars going under',
    },
    {
      date: '2024-07-16',
      itemId: 'S1A_IW_GRDH_1SDV_20240716T120507_20240716T120532_054786_06ABD2_rtc',
      label: 'Peak Inundation',
      status: 'Widest water extent in this series',
    },
    {
      date: '2024-09-02',
      itemId: 'S1A_IW_GRDH_1SDV_20240902T120507_20240902T120532_055486_06C4F5_rtc',
      label: 'Monsoon Recession',
      status: 'Water drawing back toward the main channels',
    },
  ],
  communities: [
    { coords: [89.68, 24.52], name: 'Sirajganj Upazila', affected: 12400 },
    { coords: [89.72, 24.44], name: 'Shahjadpur',        affected: 8200  },
    { coords: [89.63, 24.47], name: 'Belkuchi',          affected: 5600  },
  ],
};

/** Mission 02 — Brahmaputra at Kaziranga, Assam: the early-July 2024 flood. */
export const ASSAM_S1: S1Mission = {
  platform: 'Sentinel-1A',
  product: 'RTC gamma0 (from IW GRD)',
  orbit: 'Ascending · relative orbit 143',
  aoi: [93.2, 26.5, 93.7, 26.8],
  sceneBounds: [92.56, 25.48, 95.34, 27.37],
  center: [93.45, 26.65],
  zoom: 10,
  stages: [
    {
      date: '2024-05-19',
      itemId: 'S1A_IW_GRDH_1SDV_20240519T114910_20240519T114935_053940_068E82_rtc',
      label: 'Pre-Monsoon Baseline',
      status: 'Low river; wide sandbars between channels',
    },
    {
      date: '2024-06-24',
      itemId: 'S1A_IW_GRDH_1SDV_20240624T114909_20240624T114934_054465_06A0B1_rtc',
      label: 'Monsoon Onset',
      status: 'River starting to rise',
    },
    {
      date: '2024-07-06',
      itemId: 'S1A_IW_GRDH_1SDV_20240706T114908_20240706T114933_054640_06A6C6_rtc',
      label: 'Flood Peak',
      status: 'Widest water extent in this series',
    },
    {
      date: '2024-08-23',
      itemId: 'S1A_IW_GRDH_1SDV_20240823T114908_20240823T114933_055340_06BF8E_rtc',
      label: 'Flood Recession',
      status: 'Water back near the main channels',
    },
  ],
  communities: [],
};

/** Mission 03 — Solimões (Amazon) near Coari, Brazil: low water to high water and back. */
export const AMAZON_S1: S1Mission = {
  platform: 'Sentinel-1A',
  product: 'RTC gamma0 (from IW GRD)',
  orbit: 'Descending · relative orbit 156',
  aoi: [-63.45, -4.2, -63.0, -3.85],
  sceneBounds: [-65.1, -4.83, -62.61, -3.08],
  center: [-63.22, -4.02],
  zoom: 10,
  stages: [
    {
      date: '2023-11-22',
      itemId: 'S1A_IW_GRDH_1SDV_20231122T095626_20231122T095651_051328_063178_rtc',
      label: 'Low-Water Baseline',
      status: 'Dry-season low; lake beds and sandbars exposed',
    },
    {
      date: '2024-01-09',
      itemId: 'S1A_IW_GRDH_1SDV_20240109T095624_20240109T095649_052028_06499B_rtc',
      label: 'Rising Water',
      status: 'Flood pulse arriving; lakes refilling',
    },
    {
      date: '2024-06-01',
      itemId: 'S1A_IW_GRDH_1SDV_20240601T095627_20240601T095652_054128_069508_rtc',
      label: 'High Water',
      status: 'Widest open water in this series',
    },
    {
      date: '2024-10-11',
      itemId: 'S1A_IW_GRDH_1SDV_20241011T095627_20241011T095652_056053_06DB5C_rtc',
      label: 'Falling Water',
      status: 'Water dropping toward the next dry-season low',
    },
  ],
  communities: [],
};

export const S1_MISSIONS: Record<number, S1Mission> = { 1: JAMUNA_S1, 2: ASSAM_S1, 3: AMAZON_S1 };

export function getS1Mission(missionId: number): S1Mission | null {
  return S1_MISSIONS[missionId] ?? null;
}

/** Tile URL template for showing a scene on the map (VV backscatter in dB, greyscale). */
export function s1DisplayTileUrl(itemId: string): string {
  return `${TILER}/{z}/{x}/{y}@1x?collection=${COLLECTION}&item=${itemId}` +
    `&expression=10*log10(vv)&asset_as_band=true&rescale=-24,-4&format=png`;
}

// ── Web-Mercator tile maths ──────────────────────────────────────────────────
const N = 2 ** GRID_ZOOM;
const lon2x = (lon: number) => ((lon + 180) / 360) * N;
const lat2y = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N;
};
const x2lon = (x: number) => (x / N) * 360 - 180;
const y2lat = (y: number) => {
  const n = Math.PI - (2 * Math.PI * y) / N;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

// ── Water grid for one scene ─────────────────────────────────────────────────
/** Per-pixel class: 0 = not water, 1 = water, 2 = no data. */
interface WaterGrid {
  w: number;
  h: number;
  cls: Uint8Array;
  /** Ground area of one pixel in each row, km². */
  rowKm2: Float32Array;
  bounds: Bounds;
}

const gridCache = new Map<string, Promise<WaterGrid>>();

function loadWaterGrid(itemId: string, aoi: Bounds): Promise<WaterGrid> {
  const key = `${itemId}|${aoi.join(',')}`;
  let p = gridCache.get(key);
  if (!p) {
    p = buildWaterGrid(itemId, aoi);
    gridCache.set(key, p);
    p.catch(() => gridCache.delete(key)); // allow a retry after a network failure
  }
  return p;
}

async function buildWaterGrid(itemId: string, aoi: Bounds): Promise<WaterGrid> {
  const fx0 = lon2x(aoi[0]), fx1 = lon2x(aoi[2]);
  const fy0 = lat2y(aoi[3]), fy1 = lat2y(aoi[1]);
  const tx0 = Math.floor(fx0), tx1 = Math.floor(fx1);
  const ty0 = Math.floor(fy0), ty1 = Math.floor(fy1);

  const canvas = document.createElement('canvas');
  canvas.width = (tx1 - tx0 + 1) * 256;
  canvas.height = (ty1 - ty0 + 1) * 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available');

  const jobs: Promise<void>[] = [];
  for (let x = tx0; x <= tx1; x++) {
    for (let y = ty0; y <= ty1; y++) {
      const url = `${TILER}/${GRID_ZOOM}/${x}/${y}@1x?collection=${COLLECTION}&item=${itemId}` +
        `&expression=10*log10(vh)&asset_as_band=true&rescale=${VH_LO},${VH_HI}&format=png`;
      jobs.push(
        fetch(url)
          .then(r => {
            if (!r.ok) throw new Error(`Sentinel-1 tile request failed (${r.status})`);
            return r.blob();
          })
          .then(b => createImageBitmap(b))
          .then(bmp => { ctx.drawImage(bmp, (x - tx0) * 256, (y - ty0) * 256); })
      );
    }
  }
  await Promise.all(jobs);

  // Crop to the study area
  const cx0 = Math.round((fx0 - tx0) * 256), cx1 = Math.round((fx1 - tx0) * 256);
  const cy0 = Math.round((fy0 - ty0) * 256), cy1 = Math.round((fy1 - ty0) * 256);
  const w = cx1 - cx0, h = cy1 - cy0;
  const px = ctx.getImageData(cx0, cy0, w, h).data;

  const cut = ((WATER_VH_DB - VH_LO) / (VH_HI - VH_LO)) * 255;
  const raw = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    raw[i] = px[i * 4 + 3] === 0 ? 2 : px[i * 4] < cut ? 1 : 0;
  }

  // Speckle clean-up: a water pixel needs at least two water neighbours
  const cls = new Uint8Array(raw);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (raw[i] !== 1) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if (raw[yy * w + xx] === 1) n++;
        }
      }
      if (n < 2) cls[i] = 0;
    }
  }

  // True ground area per pixel (Web-Mercator pixels shrink away from the equator)
  const rowKm2 = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    const lat = y2lat(ty0 + (cy0 + y + 0.5) / 256);
    const metres = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / N;
    rowKm2[y] = (metres * metres) / 1e6;
  }

  return {
    w, h, cls, rowKm2,
    bounds: [x2lon(tx0 + cx0 / 256), y2lat(ty0 + cy1 / 256), x2lon(tx0 + cx1 / 256), y2lat(ty0 + cy0 / 256)],
  };
}

// ── Change detection between two dates ───────────────────────────────────────
export interface StageStats {
  /** Open water detected on this date, km². */
  waterKm2: number;
  /** Water on this date that was not water on the baseline date, km². */
  newKm2: number;
  /** Water on both dates, km². */
  persistentKm2: number;
  /** Water on the baseline date that is not water on this date, km². */
  recededKm2: number;
  /** Study area with valid data on both dates, km². */
  validKm2: number;
}

export interface ChangeOverlay {
  /** PNG data URL: cyan = new water, blue = water on both dates. */
  url: string;
  /** Corner coordinates for a MapLibre image source: TL, TR, BR, BL. */
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
}

function compare(pre: WaterGrid, post: WaterGrid): { stats: StageStats; overlay: ChangeOverlay } {
  const { w, h } = post;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const s: StageStats = { waterKm2: 0, newKm2: 0, persistentKm2: 0, recededKm2: 0, validKm2: 0 };

  for (let y = 0; y < h; y++) {
    const a = post.rowKm2[y];
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const b = pre.cls[i], c = post.cls[i];
      if (b === 2 || c === 2) continue;
      s.validKm2 += a;
      const o = i * 4;
      if (c === 1 && b !== 1) {            // new water
        s.newKm2 += a; s.waterKm2 += a;
        img.data[o] = 0; img.data[o + 1] = 240; img.data[o + 2] = 255; img.data[o + 3] = 205;
      } else if (c === 1) {                // water on both dates
        s.persistentKm2 += a; s.waterKm2 += a;
        img.data[o] = 59; img.data[o + 1] = 130; img.data[o + 2] = 246; img.data[o + 3] = 150;
      } else if (b === 1) {
        s.recededKm2 += a;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const [west, south, east, north] = post.bounds;
  return {
    stats: s,
    overlay: {
      url: canvas.toDataURL('image/png'),
      coordinates: [[west, north], [east, north], [east, south], [west, south]],
    },
  };
}

export interface MissionAnalysis {
  stats: StageStats[];
  overlays: ChangeOverlay[];
}

const gridsCache = new Map<number, Promise<WaterGrid[]>>();
const analysisCache = new Map<number, Promise<MissionAnalysis>>();

function loadAllGrids(missionId: number): Promise<WaterGrid[]> {
  const cfg = getS1Mission(missionId);
  if (!cfg) return Promise.reject(new Error(`No Sentinel-1 scenes are configured for mission ${missionId}`));
  let p = gridsCache.get(missionId);
  if (!p) {
    p = Promise.all(cfg.stages.map(st => loadWaterGrid(st.itemId, cfg.aoi)));
    gridsCache.set(missionId, p);
    p.catch(() => gridsCache.delete(missionId));
  }
  return p;
}

/** Runs the change detection for every timeline stage against the first (baseline) stage. */
export function analyseMission(missionId: number): Promise<MissionAnalysis> {
  let p = analysisCache.get(missionId);
  if (!p) {
    p = (async () => {
      const grids = await loadAllGrids(missionId);
      const results = grids.map(g => compare(grids[0], g));
      return { stats: results.map(r => r.stats), overlays: results.map(r => r.overlay) };
    })();
    analysisCache.set(missionId, p);
    p.catch(() => analysisCache.delete(missionId));
  }
  return p;
}

export type AnalysisStatus = 'idle' | 'loading' | 'ready' | 'error';

// ── Checking a player's mark against the reference change mask ───────────────
export interface MarkScore {
  /** False when the mark lies outside the study area (no reference data there). */
  inside: boolean;
  /** Share of the circle that is new water on the chosen date (0–1). */
  newWaterFraction: number;
  /** Share of the circle that was already water on the baseline date (0–1). */
  persistentFraction: number;
}

/**
 * Looks at a circle of `radiusM` metres around a point and reports how much of it
 * the reference mask classifies as new water for the given timeline stage.
 */
export async function scoreMark(missionId: number, stageIndex: number, lng: number, lat: number, radiusM: number): Promise<MarkScore> {
  const grids = await loadAllGrids(missionId);
  const pre = grids[0];
  const post = grids[stageIndex];
  if (!post) throw new Error(`Unknown timeline stage ${stageIndex}`);
  const [west, south, east, north] = post.bounds;
  if (lng < west || lng > east || lat < south || lat > north) {
    return { inside: false, newWaterFraction: 0, persistentFraction: 0 };
  }
  const cx = ((lon2x(lng) - lon2x(west)) / (lon2x(east) - lon2x(west))) * post.w;
  const cy = ((lat2y(lat) - lat2y(north)) / (lat2y(south) - lat2y(north))) * post.h;
  const row = Math.min(post.h - 1, Math.max(0, Math.floor(cy)));
  const pxMetres = Math.sqrt(post.rowKm2[row]) * 1000;
  const r = radiusM / pxMetres;
  let valid = 0, fresh = 0, old = 0;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(post.h - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(post.w - 1, Math.ceil(cx + r)); x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
      const b = pre.cls[y * post.w + x], c = post.cls[y * post.w + x];
      if (b === 2 || c === 2) continue;
      valid++;
      if (c === 1 && b !== 1) fresh++;
      else if (c === 1) old++;
    }
  }
  return valid === 0
    ? { inside: false, newWaterFraction: 0, persistentFraction: 0 }
    : { inside: true, newWaterFraction: fresh / valid, persistentFraction: old / valid };
}
