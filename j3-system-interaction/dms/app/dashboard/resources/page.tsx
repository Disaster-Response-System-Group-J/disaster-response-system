'use client';

import { useState } from 'react';
import { Truck, Search, Shield, MapPin, Activity, CheckCircle2, XCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { MOCK_RESOURCES } from '@/data/mock-data';
import { ResourceType, ResourceStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DISTRICT_NAMES } from '@/data/districts';

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-green-500/10 text-green-400 border-green-500/20',
  ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BUSY: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  OUT_OF_SERVICE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const TYPE_ICONS: Record<string, string> = {
  RESCUE_TEAM: '👷',
  BOAT: '⛵',
  AMBULANCE: '🚑',
  SHELTER: '🏠',
  MEDICAL_TEAM: '⚕️',
  FOOD_WATER: '📦',
};

export default function ResourcesPage() {
  const { hasPermission } = useAuth();
  const [resources, setResources] = useState(MOCK_RESOURCES);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');

  const filtered = resources.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.resourceId.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (districtFilter !== 'ALL' && r.district !== districtFilter) return false;
    return true;
  });

  const availableCount = resources.filter(r => r.status === ResourceStatus.AVAILABLE).length;
  const assignedCount = resources.filter(r => r.status === ResourceStatus.ASSIGNED || r.status === ResourceStatus.BUSY).length;

  const handleStatusUpdate = (id: string, newStatus: ResourceStatus) => {
    setResources(prev => prev.map(r => r.resourceId === id ? { ...r, status: newStatus, lastUpdated: new Date().toISOString() } : r));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Resource Tracking</h1>
            <p className="text-sm text-slate-400 flex items-center gap-4">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-400" /> {availableCount} Available</span>
              <span className="flex items-center gap-1.5"><Activity size={14} className="text-blue-400" /> {assignedCount} Assigned/Busy</span>
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-4 flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input type="text" placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none min-w-[150px]">
            <option value="ALL">All Types</option>
            {Object.values(ResourceType).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none min-w-[150px]">
            <option value="ALL">All Statuses</option>
            {Object.values(ResourceStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none min-w-[150px]">
            <option value="ALL">All Districts</option>
            {DISTRICT_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/80 bg-[#0a0f16]/50 text-[9px] font-bold text-slate-500 tracking-widest uppercase">
                <th className="px-6 py-4">RESOURCE ID / NAME</th>
                <th className="px-6 py-4">TYPE & LOCATION</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4">ASSIGNMENT</th>
                {hasPermission('update:resource-status') && <th className="px-6 py-4 text-right">ACTIONS</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(r => (
                <tr key={r.resourceId} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-sm border border-slate-700">
                        {TYPE_ICONS[r.type]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200">{r.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.resourceId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-semibold text-slate-300 mb-1">{r.type.replace('_', ' ')}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin size={10} /> {r.district}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[9px] font-bold tracking-widest border ${STATUS_STYLES[r.status]}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {r.assignedIncident ? (
                      <div>
                        <p className="text-xs font-semibold text-blue-400 mb-0.5">{r.assignedIncident}</p>
                        <p className="text-[10px] text-slate-500 max-w-[200px] truncate">{r.assignedIncidentTitle}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">-</span>
                    )}
                  </td>
                  {hasPermission('update:resource-status') && (
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block group">
                        <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors flex items-center gap-1">
                          Update <ChevronDown size={12} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-36 bg-[#181f2c] border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 p-1">
                          {Object.values(ResourceStatus).map(s => (
                            <button key={s} onClick={() => handleStatusUpdate(r.resourceId, s as ResourceStatus)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white rounded transition-colors">
                              {s.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                    No resources found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
