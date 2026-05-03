'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Clock, Search, Filter } from 'lucide-react';
import { MOCK_ALERTS } from '@/data/mock-data';
import { IncidentSeverity, AlertType } from '@/types';
import { DISTRICT_NAMES } from '@/data/districts';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';

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

// Extracted type from MOCK_ALERTS for type safety
type Alert = typeof MOCK_ALERTS[0];

export default function AlertsPage() {
  const socket = useSocket();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (newAlert: Alert) => {
      setAlerts((prevAlerts) => [newAlert, ...prevAlerts]);
    };

    socket.on('dashboard:risk-alert', handleNewAlert);

    return () => {
      socket.off('dashboard:risk-alert', handleNewAlert);
    };
  }, [socket]);

const enforcedDistrict = (user?.role === UserRole.SYSTEM_ADMIN || user?.role.includes('NATIONAL')) ? 'ALL' : (user as any)?.assignedDistrict || 'ALL';
  const filtered = alerts.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (districtFilter !== 'ALL' && a.district !== districtFilter) return false;
    if (enforcedDistrict !== 'ALL' && a.district !== enforcedDistrict) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold tracking-tight">System Alerts</h1>
              {enforcedDistrict !== 'ALL' && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-400">
                  <MapPin size={12} /> {enforcedDistrict} Zone Only
                </span>
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
    </div>
  );
}