'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Clock, Search, Filter, Plus, XCircle } from 'lucide-react';
import { IncidentSeverity, AlertType, UserRole } from '@/types';
import { DISTRICT_NAMES } from '@/data/districts';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { normalizeRiskAlert } from '@/lib/risk-alert';

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const ALERT_TYPE_STYLES: Record<string, string> = {
  RISK_ALERT: 'bg-red-500/10 text-red-400 border-red-500/20',
  PUBLIC_ALERT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  SHELTER_CAPACITY: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  RESOURCE_SHORTAGE: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  INCIDENT_STATUS: 'bg-slate-800 text-slate-300 border-slate-700',
};

// Alert interface matching the API response shape
type Alert = {
  alertId: string;
  title: string;
  description: string;
  type: AlertType;
  severity: IncidentSeverity;
  district: string;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
  source?: string;
};

export default function AlertsPage() {
  const socket = useSocket();
  const { user, hasPermission } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS.map((alert) => normalizeRiskAlert(alert)) as Alert[]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');

  const [isCreating, setIsCreating] = useState(false);
  const [alertForm, setAlertForm] = useState({
    title: '',
    description: '',
    type: AlertType.PUBLIC_ALERT,
    severity: IncidentSeverity.HIGH,
    district: 'ALL',
    isPublic: true
  });

  // Fetch initial alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/alerts');
        if (!response.ok) throw new Error('Failed to fetch alerts');
        const data = await response.json();
        setAlerts(data);
      } catch (err) {
        console.error('Error fetching alerts:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (incoming: any) => {
      setAlerts((prevAlerts) => [normalizeRiskAlert(incoming) as Alert, ...prevAlerts]);
    };

    socket.on('dashboard:risk-alert', handleNewAlert);

    return () => {
      socket.off('dashboard:risk-alert', handleNewAlert);
    };
  }, [socket]);

  // Handle creating and broadcasting a new alert
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();

    const newAlert: Alert = {
      alertId: `ALT-${Math.floor(Math.random() * 10000)}`,
      title: alertForm.title,
      description: alertForm.description,
      type: alertForm.type as AlertType,
      severity: alertForm.severity as IncidentSeverity,
      district: alertForm.district,
      isPublic: alertForm.isPublic,
      isActive: true,
      createdAt: new Date().toISOString(),
      source: `${user?.name || 'Command'} (${user?.role.replace(/_/g, ' ')})`
    };

    // Optimistic UI update
    setAlerts(prev => [newAlert, ...prev]);

    // Broadcast to server
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlert),
      });
    } catch (err) {
      console.error('Failed to save alert to database', err);
    }

    if (socket) {
      socket.emit('client:create-alert', newAlert);
    }

    // Reset and close
    setIsCreating(false);
    setAlertForm({
      title: '', description: '', type: AlertType.PUBLIC_ALERT,
      severity: IncidentSeverity.HIGH, district: 'ALL', isPublic: true
    });
  };
  const enforcedDistrict = (user?.role === UserRole.SYSTEM_ADMIN || user?.role.includes('NATIONAL')) ? 'ALL' : (user as any)?.assignedDistrict || 'ALL';
  const filtered = alerts.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (districtFilter !== 'ALL' && a.district !== districtFilter) return false;
    if (enforcedDistrict !== 'ALL' && a.district !== enforcedDistrict) return false;
    return true;
  });

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
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight">System Alerts</h1>
                {enforcedDistrict !== 'ALL' && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-400">
                    <MapPin size={12} /> {enforcedDistrict} Zone Only
                  </span>
                )}
              </div>

              {/* NEW: Create Alert Button */}
              {hasPermission('issue:alerts') && (
                <button onClick={() => setIsCreating(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                  <Plus size={16} /> Issue New Alert
                </button>
              )}
            </div>
            <p className="text-sm text-slate-400">Monitor risk warnings, public alerts, and system notifications.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-4 flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input type="text" placeholder="Search alerts..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none">
            <option value="ALL">All Types</option>
            {Object.values(AlertType).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none">
            <option value="ALL">All Severities</option>
            {Object.values(IncidentSeverity).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none">
            <option value="ALL">All Districts</option>
            {DISTRICT_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {filtered.map((alert, index) => (
            <div key={alert.alertId || `new-alert-${index}`} className={`bg-[#131924] border rounded-xl p-6 ${alert.severity === IncidentSeverity.CRITICAL && alert.isActive ? 'border-red-500/30' : 'border-slate-800/80'} ${!alert.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${alert.severity === IncidentSeverity.CRITICAL ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                    <AlertTriangle size={20} className={alert.severity === IncidentSeverity.CRITICAL ? 'text-red-400' : 'text-blue-400'} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {alert.title}
                      {!alert.isActive && <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-400 rounded uppercase tracking-wider">RESOLVED</span>}
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1 font-semibold tracking-wide">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {alert.district}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-widest border ${SEVERITY_STYLES[alert.severity]}`}>
                    {alert.severity} SEVERITY
                  </span>
                  <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${ALERT_TYPE_STYLES[alert.type]}`}>
                    {(alert.type || 'UNKNOWN').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed ml-16">{alert.description}</p>
              {(alert.predictionCategory || alert.considerationScore !== undefined) && (
                <div className="ml-16 mt-3 flex flex-wrap gap-2 text-[10px] font-bold tracking-widest text-slate-400">
                  {alert.predictionCategory && <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700">CATEGORY {alert.predictionCategory}</span>}
                  {alert.predictionProbability !== undefined && <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700">PROB {alert.predictionProbability.toFixed(3)}</span>}
                  {alert.considerationScore !== undefined && <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700">SCORE {alert.considerationScore.toFixed(3)}</span>}
                  {alert.topProbabilityKey && <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700">TOP {alert.topProbabilityKey}</span>}
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-between items-center ml-16">
                <div className="text-[10px] font-bold text-slate-500 tracking-widest">
                  SOURCE: <span className="text-slate-400">{alert.source || 'SYSTEM'}</span>
                </div>
                <div className="text-[10px] font-bold tracking-widest">
                  {alert.isPublic ? <span className="text-blue-400">PUBLICLY VISIBLE</span> : <span className="text-orange-400">INTERNAL ONLY</span>}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-20 text-slate-500 bg-[#131924] rounded-xl border border-slate-800/80">
              <Filter size={32} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm font-medium">No alerts found matching the current filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* NEW: Create Alert Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131924] border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-red-500/5">
              <h3 className="font-bold text-red-400 flex items-center gap-2"><AlertTriangle size={18} /> Issue System Alert</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white"><XCircle size={18} /></button>
            </div>

            <form onSubmit={handleCreateAlert} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5">Alert Headline</label>
                <input required type="text" value={alertForm.title} onChange={e => setAlertForm({ ...alertForm, title: e.target.value })} placeholder="e.g., Immediate Evacuation Required"
                  className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5">Alert Type</label>
                  <select value={alertForm.type} onChange={e => setAlertForm({ ...alertForm, type: e.target.value as AlertType })}
                    className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white">
                    {Object.values(AlertType).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5">Severity</label>
                  <select value={alertForm.severity} onChange={e => setAlertForm({ ...alertForm, severity: e.target.value as IncidentSeverity })}
                    className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white">
                    {Object.values(IncidentSeverity).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5">Target District</label>
                  <select value={alertForm.district} onChange={e => setAlertForm({ ...alertForm, district: e.target.value })}
                    className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white max-h-40">
                    <option value="ALL">National (All Districts)</option>
                    {DISTRICT_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5">Visibility</label>
                  <select value={alertForm.isPublic ? 'true' : 'false'} onChange={e => setAlertForm({ ...alertForm, isPublic: e.target.value === 'true' })}
                    className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white">
                    <option value="true">Public (Visible to Citizens)</option>
                    <option value="false">Internal (DMC Staff Only)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5">Detailed Message</label>
                <textarea required rows={3} value={alertForm.description} onChange={e => setAlertForm({ ...alertForm, description: e.target.value })} placeholder="Provide specific instructions or details..."
                  className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-white resize-none" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-2.5 bg-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-red-600 rounded-lg text-xs font-bold text-white hover:bg-red-500 transition-colors">Broadcast Alert</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}