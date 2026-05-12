'use client';

import { ReactNode, useMemo, useState, useEffect } from 'react';
import { AlertTriangle, BrainCircuit, Clock3, RefreshCcw, ShieldAlert, Waves } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

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

const LEVEL_STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export default function PredictionsPage() {
  const socket = useSocket();
  const { hasPermission } = useAuth();
  const [zones, setZones] = useState<PredictionZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());
  const [refreshNote, setRefreshNote] = useState('Fetching live predictions from database...');

  const fetchPredictions = async () => {
    setIsRefreshing(true);
    setRefreshNote('Syncing latest prediction models from backend...');
    
    try {
      const response = await fetch('/api/predictions');
      if (!response.ok) throw new Error('Failed to fetch predictions');
      
      const data = await response.json();

      const SEVERITY_MAP: Record<number, RiskLevel> = { 0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'CRITICAL' };

      // Map disaster_predictions table columns to the UI format
      const mappedZones: PredictionZone[] = (Array.isArray(data) ? data : []).map((row: any) => {
        const severity: number = row.predicted_severity ?? 0;
        const probs = [row.prob_normal, row.prob_moderate, row.prob_severe, row.prob_extreme];
        const confidence = Math.round((probs[severity] ?? 0) * 100) || 85;
        const riskLevel = SEVERITY_MAP[severity] ?? 'LOW';
        const leadTimeHours = (row.horizon ?? 1) * 24;

        return {
          zone: row.division_name || 'Unknown Zone',
          district: row.district || row.division_name || 'Unknown District',
          riskScore: Math.round((severity / 3) * 100),
          riskLevel,
          confidence,
          leadTimeHours,
          likelyImpact: `Potential ${row.hazard_type || 'hazard'} impacts expected in ${row.division_name || 'the area'} within ${leadTimeHours} hours.`,
          recommendedAction: `Initiate standard ${riskLevel} risk monitoring protocols and review resource availability.`,
        };
      });

      setZones(mappedZones);
      setRefreshNote('Predictions synced successfully with live database.');
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setRefreshNote('Error syncing predictions. Showing last known state.');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
      setLastRefreshedAt(new Date());
    }
  };

  // Fetch initial data on mount
  useEffect(() => {
    fetchPredictions();
  }, []);

  const handleIssueAlert = async (zone: PredictionZone) => {
    if (!socket) {
      toast.error('Socket connection not available');
      return;
    }
    
    const newAlert = {
      alertId: `ALT-PRED-${Math.floor(Math.random() * 10000)}`,
      title: `AI Prediction Alert: ${zone.riskLevel} Risk in ${zone.zone}`,
      description: `Likely Impact: ${zone.likelyImpact} Recommended Action: ${zone.recommendedAction}`,
      type: 'RISK_ALERT',
      severity: zone.riskLevel === 'CRITICAL' ? 'CRITICAL' : zone.riskLevel === 'HIGH' ? 'HIGH' : zone.riskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW',
      district: zone.district,
      isPublic: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      source: 'AI Prediction System'
    };
    
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlert),
      });
    } catch (err) {
      console.error('Failed to save alert to database', err);
    }
    
    socket.emit('client:create-alert', newAlert);
    toast.success(`Public Alert issued for ${zone.zone}`);
  };

  const filteredZones = useMemo(
    () => zones.filter((zone) => (riskFilter === 'ALL' ? true : zone.riskLevel === riskFilter)),
    [riskFilter, zones],
  );

  const summary = useMemo(() => {
    if (zones.length === 0) return { critical: 0, high: 0, avgConfidence: 0 };
    const critical = zones.filter((zone) => zone.riskLevel === 'CRITICAL').length;
    const high = zones.filter((zone) => zone.riskLevel === 'HIGH').length;
    const avgConfidence = Math.round(
      zones.reduce((sum, zone) => sum + zone.confidence, 0) / zones.length,
    );
    return { critical, high, avgConfidence };
  }, [zones]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

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
            onClick={fetchPredictions}
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
          <StatCard title="Prediction Window" value="6-24h" icon={<Clock3 size={14} />} tone="green" />
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
          {filteredZones.map((zone, index) => (
            <article key={`${zone.zone}-${index}`} className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 mb-1">{zone.zone}</h3>
                  <p className="text-[11px] text-slate-500 font-semibold tracking-wide uppercase">{zone.district}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border bg-blue-500/10 text-blue-400 border-blue-500/30">
                    SCORE {zone.riskScore}
                  </span>
                  <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${LEVEL_STYLES[zone.riskLevel]}`}>
                    {zone.riskLevel}
                  </span>
                  {hasPermission('issue:alerts') && (
                    <button
                      onClick={() => handleIssueAlert(zone)}
                      className="px-2.5 py-1 ml-2 rounded text-[9px] font-bold tracking-widest border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 transition-colors"
                    >
                      ISSUE ALERT
                    </button>
                  )}
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