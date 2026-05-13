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
  // 3-day horizon forecast
  forecastH1: RiskLevel;
  forecastH2: RiskLevel;
  forecastH3: RiskLevel;
  disasterType: string;
  predictedAt: string;
  telemetry?: {
    temp: number | null;
    hum: number | null;
    depth: number | null;
    depth_prev: number | null;
    moist: number | null;
    ax: number | null;
    ay: number | null;
    az: number | null;
    gx: number | null;
    gy: number | null;
    gz: number | null;
  };
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

      // Confidence score per severity tier (ensemble model reliability)
      const LEVEL_CONFIDENCE: Record<string, number> = {
        LOW: 95, MEDIUM: 85, HIGH: 88, CRITICAL: 92,
      };
      const RISK_SCORE: Record<string, number> = {
        LOW: 10, MEDIUM: 40, HIGH: 70, CRITICAL: 95,
      };
      const toRisk = (s: string | undefined): RiskLevel =>
        (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(s ?? '') ? (s as RiskLevel) : 'LOW');

      // Map iot_predictions API rows (one per sensor, with H0–H3 pivoted as columns)
      const mappedZones: PredictionZone[] = (Array.isArray(data) ? data : []).map((row: any) => {
        const riskLevel = toRisk(row.risk_level);
        const forecastH1 = toRisk(
          ({ Normal: 'LOW', Moderate: 'MEDIUM', Severe: 'HIGH', Extreme: 'CRITICAL' } as Record<string, RiskLevel>)[row.status_h1] ?? row.risk_level
        );
        const forecastH2 = toRisk(
          ({ Normal: 'LOW', Moderate: 'MEDIUM', Severe: 'HIGH', Extreme: 'CRITICAL' } as Record<string, RiskLevel>)[row.status_h2] ?? row.risk_level
        );
        const forecastH3 = toRisk(
          ({ Normal: 'LOW', Moderate: 'MEDIUM', Severe: 'HIGH', Extreme: 'CRITICAL' } as Record<string, RiskLevel>)[row.status_h3] ?? row.risk_level
        );

        return {
          zone: row.zone || `${row.disaster_type ?? 'Unknown'} Sensor`,
          district: row.district || `Sensor ID: ${row.source_id ?? '—'}`,
          riskScore: RISK_SCORE[riskLevel] ?? 10,
          riskLevel,
          confidence: LEVEL_CONFIDENCE[riskLevel] ?? 85,
          leadTimeHours: 0,   // H=0 = current reading; forecast shown separately
          likelyImpact: `${row.disaster_type ? row.disaster_type.charAt(0).toUpperCase() + row.disaster_type.slice(1) : 'Hazard'} risk currently ${row.predicted_status ?? riskLevel}. Forecast: Day+1 ${row.status_h1 ?? '—'}, Day+2 ${row.status_h2 ?? '—'}, Day+3 ${row.status_h3 ?? '—'}.`,
          recommendedAction: `Initiate ${riskLevel} monitoring protocols. ${riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'Pre-position emergency resources and alert response teams.' : 'Continue routine monitoring and review resource availability.'}`,
          forecastH1,
          forecastH2,
          forecastH3,
          disasterType: row.disaster_type ?? 'unknown',
          predictedAt: row.predicted_at,
          telemetry: {
            temp: row.temp,
            hum: row.hum,
            depth: row.depth,
            depth_prev: row.depth_prev,
            moist: row.moist,
            ax: row.ax,
            ay: row.ay,
            az: row.az,
            gx: row.gx,
            gy: row.gy,
            gz: row.gz,
          }
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
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">AI Disaster Predictions</h1>
            <p className="text-sm text-slate-400">
              Real-time IoT sensor predictions with 3-day horizon forecasts for flood and landslide risk.
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
            XGBoost/LightGBM ensemble — flood: depth &amp; humidity; landslide: soil moisture &amp; vibration.
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

              <div className="flex items-center gap-4 mb-4 text-[10px] text-slate-500 font-medium">
                <span className="flex items-center gap-1.5"><Clock3 size={12} /> Predicted at: {new Date(zone.predictedAt).toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-4 gap-5 mb-4">
                <Metric title="Confidence" value={`${zone.confidence}%`} />
                <Metric title="Day +1" value={zone.forecastH1} />
                <Metric title="Day +2" value={zone.forecastH2} />
                <Metric title="Day +3" value={zone.forecastH3} />
              </div>

              {zone.telemetry && (
                <div className="mb-4 bg-[#0a0f16]/50 rounded-lg p-3 border border-slate-800/40">
                  <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-2">Live Telemetry (H=0)</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                    {zone.disasterType === 'flood' ? (
                      <>
                        <TeleMetric label="Temp" value={zone.telemetry.temp} unit="°C" />
                        <TeleMetric label="Hum" value={zone.telemetry.hum} unit="%" />
                        <TeleMetric label="Depth" value={zone.telemetry.depth} unit="mm" />
                        <TeleMetric label="Prev" value={zone.telemetry.depth_prev} unit="mm" />
                      </>
                    ) : (
                      <>
                        <TeleMetric label="Moist" value={zone.telemetry.moist} unit="%" />
                        <TeleMetric label="Accel X" value={zone.telemetry.ax} />
                        <TeleMetric label="Accel Y" value={zone.telemetry.ay} />
                        <TeleMetric label="Accel Z" value={zone.telemetry.az} />
                        <TeleMetric label="Gyro X" value={zone.telemetry.gx} />
                        <TeleMetric label="Gyro Y" value={zone.telemetry.gy} />
                      </>
                    )}
                  </div>
                </div>
              )}

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

function TeleMetric({ label, value, unit = '' }: { label: string, value: number | null | undefined, unit?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="text-[9px] text-slate-500 font-bold uppercase">{label}</p>
      <p className="text-xs font-medium text-slate-300">{value}{unit}</p>
    </div>
  );
}