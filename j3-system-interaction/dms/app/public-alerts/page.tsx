'use client';

import Link from 'next/link';
import { Shield, AlertTriangle, ArrowLeft, Waves, Mountain, Clock, MapPin } from 'lucide-react';
import { MOCK_ALERTS } from '@/data/mock-data';
import { IncidentSeverity } from '@/types';
import { normalizeRiskAlert } from '@/lib/risk-alert';
import { useState, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 border-red-500/30 text-red-400',
  HIGH: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  MEDIUM: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  LOW: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

export default function PublicAlertsPage() {
  const socket = useSocket();
  const [alerts, setAlerts] = useState(MOCK_ALERTS.filter(a => a.isPublic && a.isActive));

  useEffect(() => {
    if (!socket) return;

    // Listen for new risk alerts from Kafka
    const handleNewAlert = (incoming: any) => {
      const normalized = normalizeRiskAlert(incoming) as any;
      // Only add if public
      if (normalized.isPublic) {
        setAlerts((prev) => [normalized, ...prev]);
      }
    };

    socket.on('dashboard:risk-alert', handleNewAlert);

    return () => {
      socket.off('dashboard:risk-alert', handleNewAlert);
    };
  }, [socket]);

  const publicAlerts = alerts;

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white font-sans">
      <header className="border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Shield size={24} className="text-blue-400 fill-blue-400" />
            <span className="text-sm font-bold tracking-wide">DMC SRI LANKA</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Public Alerts</h1>
            <p className="text-xs text-slate-400">Verified alerts from disaster management authorities.</p>
          </div>
        </div>

        {publicAlerts.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <AlertTriangle size={32} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium">No active public alerts at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {publicAlerts.map(alert => (
              <div key={alert.alertId} className={`bg-[#131924] border rounded-xl p-6 ${alert.severity === IncidentSeverity.CRITICAL ? 'border-red-500/30' : 'border-slate-800/80'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${alert.severity === IncidentSeverity.CRITICAL ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                      {alert.title.toLowerCase().includes('flood') || alert.title.toLowerCase().includes('rain') ?
                        <Waves size={18} className={alert.severity === IncidentSeverity.CRITICAL ? 'text-red-400' : 'text-blue-400'} /> :
                        <Mountain size={18} className="text-orange-400" />
                      }
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{alert.title}</h3>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><MapPin size={10} /> {alert.district}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${SEVERITY_STYLES[alert.severity]}`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{alert.description}</p>

                {/* AI Prediction & Confidence Metrics */}
                {(alert.predictionProbability !== undefined || alert.considerationScore !== undefined || alert.resourcePressure !== undefined) && (
                  <div className="mt-4 pt-4 border-t border-slate-800/50 grid grid-cols-3 gap-4">
                    {/* Prediction Probability */}
                    {alert.predictionProbability !== undefined && (
                      <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-1">Prediction Probability</div>
                        <div className="text-xl font-bold text-blue-400">{(alert.predictionProbability * 100).toFixed(0)}%</div>
                        <div className="text-[8px] text-slate-600 mt-1">AI Confidence</div>
                      </div>
                    )}
                    {/* Consideration Score */}
                    {alert.considerationScore !== undefined && (
                      <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                        <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-1">Consideration Score</div>
                        <div className="text-xl font-bold text-cyan-400">{(alert.considerationScore * 100).toFixed(0)}%</div>
                        <div className="text-[8px] text-slate-600 mt-1">Decision Support</div>
                      </div>
                    )}
                    {/* Resource Pressure */}
                    {alert.resourcePressure !== undefined && (
                      <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                        <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-1">Resource Pressure</div>
                        <div className="text-xl font-bold text-orange-400">{(alert.resourcePressure * 100).toFixed(0)}%</div>
                        <div className="text-[8px] text-slate-600 mt-1">District Strain</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Resource Summary Breakdown */}
                {alert.resourceSummary && (
                  <div className="mt-4 pt-4 border-t border-slate-800/50">
                    <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">District Resources</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                      {/* Overall Summary */}
                      <div className="p-2 rounded bg-slate-800/30 border border-slate-700/50">
                        <div className="text-[8px] text-slate-500 uppercase tracking-wide">Total Resources</div>
                        <div className="text-sm font-bold text-white mt-1">{alert.resourceSummary.overall.total}</div>
                        <div className="text-[8px] text-green-400 mt-0.5">{alert.resourceSummary.overall.available} available</div>
                      </div>
                      {/* By Type */}
                      {Object.entries(alert.resourceSummary.by_type).map(([type, counts]) => (
                        <div key={type} className="p-2 rounded bg-slate-800/20 border border-slate-700/30">
                          <div className="text-[8px] text-slate-400 uppercase tracking-wide truncate">{type.replace(/_/g, ' ')}</div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-xs font-semibold text-white">{counts.total}</div>
                            <div className="text-[10px] text-teal-400 font-bold">{counts.available}</div>
                          </div>
                          <div className="w-full h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-teal-500" style={{width: `${(counts.available / counts.total) * 100}%`}} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Probability Distribution */}
                {alert.probabilities && Object.keys(alert.probabilities).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/50">
                    <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Scenario Probabilities</div>
                    <div className="space-y-1.5">
                      {Object.entries(alert.probabilities).map(([key, prob]) => (
                        <div key={key} className="flex items-center gap-2">
                          <div className="w-20 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{key}</div>
                          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full flex items-center justify-end pr-1" style={{
                              width: `${prob * 100}%`,
                              background: key === 'EXTREME' ? '#ef4444' : key === 'SEVERE' ? '#f97316' : key === 'MODERATE' ? '#eab308' : '#3b82f6'
                            }} />
                          </div>
                          <div className="w-10 text-right text-[9px] font-bold text-white">{(prob * 100).toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {alert.source && <p className="text-[10px] text-slate-500"><span className="font-bold text-slate-400">Source:</span> {alert.source}</p>}
                  </div>
                  {alert.predictionCategory && <span className="text-[9px] font-bold px-2 py-1 bg-slate-800/50 text-slate-300 rounded uppercase tracking-wider">{alert.predictionCategory}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
