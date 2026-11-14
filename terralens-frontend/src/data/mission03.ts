import type { MissionData } from '../types/mission';

export const amazonMission: MissionData = {
  id: 3,
  missionNumber: '03',
  name: 'Amazon Wetland Dynamics',
  locationName: 'Solimões River near Coari, Amazon Basin, Brazil',
  coordinates: [-63.22, -4.02],
  zoom: 10,
  estimatedAreaKm2: 185.6,
  preFloodDate: '2023-11-22',
  postFloodDate: '2024-06-01',
  floodPolygon: [
    [-63.42, -3.18],
    [-62.80, -3.10],
    [-62.60, -3.42],
    [-62.75, -3.78],
    [-63.20, -3.80],
    [-63.50, -3.52],
  ],
  story:
    'The Amazon flood pulse creates the world\'s largest seasonally inundated forest. ' +
    'Sentinel-1 C-band radar tracks open water from the late-2023 drought low to the 2024 high. Flooding hidden under the forest canopy needs longer wavelengths such as NISAR and is not captured here.',
  observation: {
    type: 'Sub-canopy Inundation Mapping',
    satellite: 'Sentinel-1A',
    band: 'C-band (5.6 cm)',
    acquisitionDate: '2024-06-01',
    polarisation: 'VV+VH',
    resolution: '10 m',
    processingLevel: 'L1 GRD → RTC',
  },
  challenges: [
    {
      question: 'Why is Sentinel-1 radar a good tool for the Amazon, where optical satellite images are often unusable?',
      options: [
        'Radar is cheaper than optical imagery',
        'Microwaves pass through cloud and the sensor works day and night',
        'Radar images are always in colour',
        'Radar only works when the sky is clear',
      ],
      correctIndex: 1,
      explanation:
        'Optical sensors need sunlight and a clear view. The Amazon is cloudy for much of the year, and dense canopy hides the ground. Sentinel-1 sends its own microwave pulse, which passes through cloud and works at night, so it can still map open water.',
    },
    {
      question: 'The Amazon "flood pulse" is primarily driven by:',
      options: [
        'Monthly tidal cycles in the Atlantic Ocean',
        'Seasonal precipitation over the Andes and Amazon basin',
        'Deforestation releasing stored groundwater',
        'El Niño-Southern Oscillation (ENSO) exclusively',
      ],
      correctIndex: 1,
      explanation:
        'Intense seasonal rainfall (November–May) over the Andes and Amazon headwaters raises river levels by 10–15 m, inundating up to 350,000 km² of várzea (floodplain forest) — a critical habitat and carbon store that satellite radar helps to monitor.',
    },
    {
      question: 'SAR backscatter over flooded várzea forest appears brighter than open water because of:',
      options: [
        'Speckle noise artefacts in the processor',
        'Coherent double-bounce between standing water and tree trunks',
        'Atmospheric scintillation at S-band',
        'DEM errors causing false layover',
      ],
      correctIndex: 1,
      explanation:
        'The double-bounce mechanism: the radar pulse hits the smooth water surface and reflects upward into a tree trunk, then back directly toward the satellite. This coherent two-bounce path produces very high backscatter — a signature of flooded forest. Longer-wavelength L-band radar sees it best; the C-band Sentinel-1 used here penetrates the canopy poorly, so the water mask here maps open water only.',
    },
  ],
};
