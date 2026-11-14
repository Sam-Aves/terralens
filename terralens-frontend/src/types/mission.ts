// TERRALENS – unified MissionData type
// Fields match what App.tsx reads from currentMission.*

export interface SatelliteObservation {
  type: string;
  satellite: string;
  band: string;
  acquisitionDate: string;
  polarisation: string;
  resolution: string;
  processingLevel: string;
  // Legacy alias used in older sidebar
  sensor?: string;
  polarization?: string;
}

export interface ChallengeQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MissionData {
  id: number;
  missionNumber: string;
  name: string;
  locationName: string;
  coordinates: [number, number]; // [lng, lat]
  zoom: number;
  estimatedAreaKm2: number;
  preFloodDate: string;
  postFloodDate: string;
  floodPolygon: [number, number][];
  story: string;
  observation: SatelliteObservation;
  challenges: ChallengeQuestion[];
}
