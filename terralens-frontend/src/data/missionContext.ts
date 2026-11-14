// OPTIONAL DATA SLOTS: fill these in and the app shows the matching feature automatically.
// Nothing here is invented: while a mission has no entry, its card simply does not appear.
//
// In live mode the backend serves the same shapes:
//   GET /missions/{id}/context        → MissionContext
//   GET /missions/{id}/impact-layers  → ImpactLayers

export interface ContextPoint { date: string; value: number }          // date: 'YYYY-MM-DD'
export interface ContextSeries {
  label: string;                                                       // e.g. 'Daily rainfall'
  unit: string;                                                        // e.g. 'mm' or 'm'
  points: ContextPoint[];
  source: string;                                                      // shown under the chart, e.g. 'NASA GPM IMERG'
}
export interface MissionContext {
  rainfall?: ContextSeries;
  riverLevel?: ContextSeries;
}

type LngLat = [number, number];
export interface ImpactLayers {
  /** Road centre-lines. */
  roads?: { features: { name?: string; coords: LngLat[] }[]; source: string };
  /** Farmland or other land-use polygons (outer ring only). */
  farmland?: { features: { name?: string; ring: LngLat[] }[]; source: string };
}

/** Example (do not enable without a real source):
 *  1: { rainfall: { label: 'Daily rainfall', unit: 'mm', source: '…', points: [{ date: '2024-06-20', value: 12.4 }, …] } }
 */
export const MISSION_CONTEXT: Record<number, MissionContext> = {};

/** Example: 1: { roads: { source: 'OpenStreetMap', features: [{ name: 'N5', coords: [[89.7, 24.4], [89.71, 24.45]] }] } } */
export const IMPACT_LAYERS: Record<number, ImpactLayers> = {};
