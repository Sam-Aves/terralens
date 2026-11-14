import React from 'react';
import type { SatelliteObservation } from '../../types/mission';
import { ShieldCheck, Satellite, Calendar, Activity } from 'lucide-react';

interface EvidenceBadgeProps {
  observation: SatelliteObservation;
  activeDate?: string;
}

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({ observation, activeDate }) => {
  const satellite = observation.satellite ?? observation.sensor ?? '—';
  const polarization = observation.polarisation ?? observation.polarization ?? '—';
  const date = activeDate ?? observation.acquisitionDate ?? '—';
  const processingLevel = observation.processingLevel ?? 'Provisional';

  const getLevelColor = (level: string) => {
    if (level.includes('Validated') || level.includes('L2')) {
      return 'color: #34d399; border-color: rgba(16,185,129,0.4); background: rgba(6,78,59,0.4)';
    }
    if (level.includes('Provisional') || level.includes('L1')) {
      return 'color: #fbbf24; border-color: rgba(245,158,11,0.4); background: rgba(78,52,6,0.4)';
    }
    return 'color: #f87171; border-color: rgba(239,68,68,0.4); background: rgba(78,6,6,0.4)';
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      borderRadius: '8px',
      backgroundColor: 'rgba(11, 17, 32, 0.9)',
      border: '1px solid rgba(51, 65, 85, 0.6)',
      fontSize: '11px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#00F0FF', fontWeight: 600 }}>
        <Satellite size={14} />
        <span>{satellite}</span>
      </div>

      <div style={{ width: '1px', height: '14px', backgroundColor: '#334155' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#cbd5e1' }}>
        <Calendar size={12} style={{ color: '#94a3b8' }} />
        <span>Acquired: {date}</span>
      </div>

      <div style={{ width: '1px', height: '14px', backgroundColor: '#334155' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#cbd5e1' }}>
        <Activity size={12} style={{ color: '#94a3b8' }} />
        <span>Pol: {polarization}</span>
      </div>

      <div style={{ width: '1px', height: '14px', backgroundColor: '#334155' }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        border: '1px solid',
        fontSize: '10px',
        fontWeight: 600,
        ...Object.fromEntries(
          getLevelColor(processingLevel).split(';').filter(Boolean).map(s => {
            const [k, v] = s.split(':').map(x => x.trim());
            const camelKey = k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
            return [camelKey, v];
          })
        ),
      }}>
        <ShieldCheck size={11} />
        <span>{processingLevel}</span>
      </div>
    </div>
  );
};
