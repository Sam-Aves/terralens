import type { MissionData } from '../types/mission';

export const assamMission: MissionData = {
  id: 2,
  missionNumber: '02',
  name: 'Brahmaputra Surge',
  locationName: 'Brahmaputra River, Assam, India',
  coordinates: [93.45, 26.65],
  zoom: 10,
  estimatedAreaKm2: 38.2,
  preFloodDate: '2024-05-19',
  postFloodDate: '2024-07-06',
  floodPolygon: [
    [93.42, 26.28],
    [93.68, 26.30],
    [93.82, 26.18],
    [93.80, 26.02],
    [93.55, 25.98],
    [93.38, 26.10],
  ],
  story:
    'The Brahmaputra, one of the world\'s largest rivers, undergoes massive annual flooding in Assam. ' +
    'Sentinel-1 C-band radar sees the July 2024 flood at Kaziranga through the monsoon cloud. NISAR L-band, which penetrates vegetation better, is not loaded in this mission yet.',
  observation: {
    type: 'Flood Extent & Wetland Mapping',
    satellite: 'Sentinel-1A',
    band: 'C-band (5.6 cm)',
    acquisitionDate: '2024-07-06',
    polarisation: 'VV+VH',
    resolution: '10 m',
    processingLevel: 'L1 GRD → RTC',
  },
  challenges: [
    {
      question: 'This mission maps water with the VH channel (water if below about –20 dB) because:',
      options: [
        'Calm water returns very little cross-polarised signal, so it stays dark even when wind ripples make it brighter in VV',
        'VH images are taken at night, when floods are easier to see',
        'VH is the only channel that can see through cloud',
        'Land always scatters more in VV than in VH',
      ],
      correctIndex: 0,
      explanation:
        'Smooth water acts like a mirror and sends the radar pulse away from the satellite. In VV, wind can roughen the surface and brighten it, which is why a VV-only threshold failed on windy dates. The cross-polarised VH channel stays dark over water, so it separates water from land more reliably.',
    },
    {
      question: 'Compared with 19 May 2024, which of the four Kaziranga dates shows the most new water?',
      options: [
        '19 May 2024 (the baseline itself)',
        '24 June 2024',
        '6 July 2024',
        '23 August 2024',
      ],
      correctIndex: 2,
      explanation:
        'Use the timeline: on 6 July 2024 the Sentinel-1 analysis finds about 185 km² of new water, the peak of the series, with about 383 km² open water in total. By 23 August the water has started to recede. This is an experimental estimate, not a validated flood map.',
    },
    {
      question: 'What SAR processing step removes terrain-induced radiometric distortions before flood analysis?',
      options: [
        'Speckle filtering',
        'Range Doppler focusing',
        'Radiometric Terrain Correction (RTC)',
        'Coherence estimation',
      ],
      correctIndex: 2,
      explanation:
        'Radiometric Terrain Correction (RTC) normalises backscatter for local incidence angle variations caused by topography, preventing mountain slopes from appearing falsely bright or dark and skewing the flood threshold.',
    },
  ],
};
