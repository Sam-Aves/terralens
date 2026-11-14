import type { MissionData } from '../types/mission';

export const jamunaMission: MissionData = {
  id: 1,
  missionNumber: '01',
  name: 'The Changing Jamuna',
  locationName: 'Jamuna River, Bangladesh',
  coordinates: [89.70, 24.50],
  zoom: 10,
  estimatedAreaKm2: 12.5,
  preFloodDate: '2024-05-17',
  postFloodDate: '2024-07-16',
  floodPolygon: [
    [89.62, 24.58],
    [89.75, 24.56],
    [89.81, 24.48],
    [89.78, 24.38],
    [89.65, 24.40],
    [89.58, 24.49],
  ],
  story:
    'Sentinel-1 C-band SAR captured this braided river system before and during peak monsoon. ' +
    'Your task: identify the inundation extent using radar backscatter signatures.',
  observation: {
    type: 'SAR Flood Inundation',
    satellite: 'Sentinel-1A',
    band: 'C-band (5.6 cm)',
    acquisitionDate: '2024-07-16',
    polarisation: 'VV+VH',
    resolution: '10 m',
    processingLevel: 'L1 GRD → RTC',
  },
  challenges: [
    {
      question:
        'Open calm floodwater appears as deep black in Sentinel-1 SAR imagery because:',
      options: [
        'Water absorbs all microwave radiation permanently',
        'Specular reflection bounces the radar pulse away from the sensor',
        'The sensor cannot operate over water surfaces',
        'Cloud cover blocks the C-band signal',
      ],
      correctIndex: 1,
      explanation:
        'Calm water acts as a specular mirror. The radar pulse reflects away at the same angle it arrived, returning no signal to the satellite. This yields near-zero backscatter (< –16 dB), displayed as black.',
    },
    {
      question:
        'Which Sentinel-1 polarisation channel is most sensitive to flood water beneath vegetation?',
      options: ['HH (horizontal transmit / horizontal receive)', 'VV (vertical transmit / vertical receive)', 'VH (vertical transmit / horizontal receive)', 'HV (horizontal transmit / vertical receive)'],
      correctIndex: 2,
      explanation:
        'VH cross-polarisation captures volumetric scattering that penetrates into vegetation canopy, revealing double-bounce between water surface and stems — the dominant mechanism for detecting flooded forests.',
    },
    {
      question:
        'Bright white/yellow patches in the urban fringe of this Jamuna image indicate:',
      options: [
        'Sand bars exposed by the receding river',
        'Double-bounce radar return from flooded building walls',
        'Clouds misidentified by the SAR processor',
        'Agricultural fields with residual standing water',
      ],
      correctIndex: 1,
      explanation:
        'The double-bounce effect occurs when the radar pulse bounces first off the flat water surface, then off a vertical wall (or vice versa), returning directly back to the sensor — producing very high backscatter displayed as bright white.',
    },
  ],
};
