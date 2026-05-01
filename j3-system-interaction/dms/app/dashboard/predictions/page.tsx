'use client';

import { ReactNode, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, Clock3, RefreshCcw, ShieldAlert, Waves } from 'lucide-react';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface PredictionZone {
  zone: string;
  district: string;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  leadTimeHours: number;
  likelyImpact: string;
  recommendedAction: string;
}

const PREDICTION_ZONES: PredictionZone[] = [
  {
    zone: 'Kelani Lower Basin',
    district: 'Colombo',
    riskScore: 89,
    riskLevel: 'CRITICAL',
    confidence: 91,
    leadTimeHours: 8,
    likelyImpact: 'Rapid inundation in low-lying urban pockets and drainage backflow.',
    recommendedAction: 'Prepare staged evacuation and pre-position rescue boats in Kaduwela and Wellampitiya.',
  },
  {
    zone: 'Kalu Ganga - Ratnapura Reach',
    district: 'Ratnapura',
    riskScore: 82,
    riskLevel: 'HIGH',
    confidence: 87,
    leadTimeHours: 10,
    likelyImpact: 'Sustained floodplain overflow along downstream settlements.',
    recommendedAction: 'Issue targeted household alerts and activate night-shift field monitoring.',
  },
  {
    zone: 'Attanagalu Oya Corridor',
    district: 'Gampaha',
    riskScore: 76,
    riskLevel: 'HIGH',
    confidence: 84,
    leadTimeHours: 6,
    likelyImpact: 'Road-side flash flooding and mobility disruption in feeder roads.',
    recommendedAction: 'Deploy traffic control units and open temporary shelter capacity near Ja-Ela.',
  },
  {
    zone: 'Gin Ganga Midstream',
    district: 'Galle',
    riskScore: 58,
    riskLevel: 'MEDIUM',
    confidence: 79,
    leadTimeHours: 14,
    likelyImpact: 'Localized flooding near river banks and paddy tracts.',
    recommendedAction: 'Continue telemetry watch and keep evacuation transport on standby.',
  },
  {
    zone: 'Nilwala Basin',
    district: 'Matara',
    riskScore: 35,
    riskLevel: 'LOW',
    confidence: 74,
    leadTimeHours: 18,
    likelyImpact: 'Minor water accumulation in drainage-constrained neighborhoods.',
    recommendedAction: 'Maintain routine monitoring and public advisory updates.',
  },
];

const LEVEL_STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export default function PredictionsPage() {
  const [zones, setZones] = useState(PREDICTION_ZONES);
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());
  const [refreshNote, setRefreshNote] = useState('Predictions are currently using local mock data.');

  const filteredZones = useMemo(
    () => zones.filter((zone) => (riskFilter === 'ALL' ? true : zone.riskLevel === riskFilter)),
    [riskFilter, zones],
  );

  const summary = useMemo(() => {
    const critical = zones.filter((zone) => zone.riskLevel === 'CRITICAL').length;
    const high = zones.filter((zone) => zone.riskLevel === 'HIGH').length;
    const avgConfidence = Math.round(
      zones.reduce((sum, zone) => sum + zone.confidence, 0) / zones.length,
    );
    return { critical, high, avgConfidence };
  }, [zones]);

  const handleRefreshPredictions = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshNote('Refreshing prediction snapshot from local model...');

    window.setTimeout(() => {
      setZones((previousZones) =>
        previousZones.map((zone, index) => {
          const shift = index % 2 === 0 ? 1 : -1;
          const nextRiskScore = Math.max(20, Math.min(95, zone.riskScore + shift));
          const nextConfidence = Math.max(60, Math.min(98, zone.confidence + (shift > 0 ? 1 : 0)));
          return { ...zone, riskScore: nextRiskScore, confidence: nextConfidence };
        }),
      );
      setLastRefreshedAt(new Date());
      setRefreshNote('Predictions refreshed. Backend is not connected, so this is a simulated update.');
      setIsRefreshing(false);
    }, 900);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">AI Flood Predictions</h1>
            <p className="text-sm text-slate-400">
              Forward risk estimates to guide pre-emptive response planning and staged deployment.
            </p>
          </div>
          <button
            onClick={handleRefreshPredictions}
            disabled={isRefreshing}
            className="px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed border border-blue-500/40 text-sm font-semibold text-blue-300 flex items-center gap-2 transition-colors"
          >
            <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Predictions'}
          </button>
        </div>

        <div className="mb-6 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-200">{refreshNote}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Last refreshed: {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-6">
          <StatCard title="Critical Zones" value={summary.critical.toString()} icon={<ShieldAlert size={14} />} tone="red" />
          <StatCard title="High-Risk Zones" value={summary.high.toString()} icon={<AlertTriangle size={14} />} tone="orange" />
          <StatCard title="Avg Confidence" value={`${summary.avgConfidence}%`} icon={<BrainCircuit size={14} />} tone="blue" />
          <StatCard title="Prediction Window" value="6-18h" icon={<Clock3 size={14} />} tone="green" />
        </div>

        <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Waves size={16} className="text-blue-400" />
            Risk model tracks rain intensity, basin response, upstream flow, and terrain saturation.
          </div>
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as 'ALL' | RiskLevel)}
            className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none min-w-[180px]"
          >
            <option value="ALL">Risk: All</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="space-y-4">
          {filteredZones.map((zone) => (
            <article key={zone.zone} className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 mb-1">{zone.zone}</h3>
                  <p className="text-[11px] text-slate-500 font-semibold tracking-wide uppercase">{zone.district} District</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border bg-blue-500/10 text-blue-400 border-blue-500/30">
                    SCORE {zone.riskScore}
                  </span>
                  <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${LEVEL_STYLES[zone.riskLevel]}`}>
                    {zone.riskLevel}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5 mb-4">
                <Metric title="Confidence" value={`${zone.confidence}%`} />
                <Metric title="Lead Time" value={`${zone.leadTimeHours} hrs`} />
                <Metric title="Operational Priority" value={zone.riskLevel === 'CRITICAL' ? 'Immediate' : zone.riskLevel === 'HIGH' ? 'High' : 'Monitor'} />
              </div>

              <div className="space-y-3 border-t border-slate-800/60 pt-4">
                <p className="text-sm text-slate-300">
                  <span className="text-slate-400 font-semibold">Likely impact:</span> {zone.likelyImpact}
                </p>
                <p className="text-sm text-slate-200">
                  <span className="text-blue-400 font-semibold">Recommended action:</span> {zone.recommendedAction}
                </p>
              </div>
            </article>
          ))}
          {filteredZones.length === 0 && (
            <div className="text-center py-20 text-slate-500 bg-[#131924] rounded-xl border border-slate-800/80">
              No prediction zones found for the selected filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  tone: 'red' | 'orange' | 'blue' | 'green';
}) {
  const toneStyles = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
  };
  return (
    <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{title}</span>
        <span className={toneStyles[tone]}>{icon}</span>
      </div>
      <span className="text-4xl font-bold tracking-tight">{value}</span>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-[#0a0f16] border border-slate-800/80 rounded-lg p-3">
      <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">{title}</p>
      <p className="text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}
