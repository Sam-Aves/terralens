// TERRALENS API Contract Types
// Compatible with both local /fixtures and Day 3 Live API

export interface ObservationMetadata {
  satellite: string; // e.g. "Sentinel-1A"
  sensor: string; // e.g. "SAR C-Band (5.6 cm)"
  band: string;
  polarisation: string; // "VV" | "VH" | "VV+VH"
  resolution: string; // "10m"
  processingLevel: string; // "L1 GRD"
  acquisitionDate: string; // "2024-07-12"
  attribution: string;
}

export interface SettlementImpactPoint {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  affectedResidents: number;
  exposureStatus: 'potentially exposed'; // Contract rule: labelled "potentially exposed", never "damaged"
}

export interface MissionChallenge {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hints: string[]; // Capped at 3 hints per question
}

export interface MissionDetail {
  id: string;
  missionNumber: string;
  name: string;
  locationName: string;
  coordinates: [number, number]; // [lng, lat]
  zoom: number;
  preFloodDate: string;
  postFloodDate: string;
  estimatedAreaKm2: number;
  story: string;
  observation: ObservationMetadata;
  tileUrls: {
    beforeTiles: string[]; // NASA GIBS or baseline tile template
    afterTiles: string[];  // Sentinel-1 SAR flood tile template
  };
  floodPolygon: [number, number][]; // GeoJSON coordinates
  settlements: SettlementImpactPoint[];
  challenges: MissionChallenge[];
  requiredXpToUnlock: number;
}

export interface SubmitMissionPayload {
  missionId: string;
  playerCallsign: string;
  answers: Record<number, number>; // question index -> chosen option index
  hintsUsed: number;
  drawnPolygon?: GeoJSON.Polygon | null; // From terra-draw
}

export interface MissionResult {
  missionId: string;
  score: number;
  xpEarned: number;
  correctCount: number;
  totalQuestions: number;
  badgeAwarded: {
    id: string;
    title: string;
    icon: string;
    description: string;
  } | null;
  explanations: {
    questionId: number;
    isCorrect: boolean;
    explanation: string;
  }[];
  timestamp: string;
}

export interface JournalEntry {
  id: string;
  missionId: string;
  missionName: string;
  dateCompleted: string;
  score: number;
  xpEarned: number;
  badgeTitle: string;
  thumbnailUrl: string;
  coordinates: [number, number];
  floodAreaKm2: number;
}
