'use client';

import { useState, useEffect } from 'react';
import { 
  Truck, Search, MapPin, Activity, CheckCircle2, 
  XCircle, ChevronDown, Home 
} from 'lucide-react';
import { MOCK_RESOURCES, MOCK_CONFIRMED_INCIDENTS } from '@/data/mock-data';
import { ResourceType, ResourceStatus, IncidentStatus, UserRole } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DISTRICT_NAMES } from '@/data/districts';
import { useSocket } from '@/context/SocketContext';

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-green-500/10 text-green-400 border-green-500/20',
  ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BUSY: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  OUT_OF_SERVICE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const TYPE_ICONS: Record<string, string> = {
  RESCUE_TEAM: '🚁',
  BOAT: '🚤',
  AMBULANCE: '🚑',
  SHELTER: '⛺',
  MEDICAL_TEAM: '⚕️',
  FOOD_WATER: '📦',
};

export default function ResourcesPage() {
  const { hasPermission, user } = useAuth();
  const socket = useSocket();

  const [resources, setResources] = useState(MOCK_RESOURCES);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  
  const enforcedDistrict = (user?.role === UserRole.SYSTEM_ADMIN || user?.role.includes('NATIONAL')) ? 'ALL' : (user as any)?.assignedDistrict || 'ALL';

  // State for the dispatch modal
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');

  // State for Shelter Management Modal
  const [shelterModal, setShelterModal] = useState<string | null>(null);
  const [shelterForm, setShelterForm] = useState({ capacity: 0, currentLoad: 0 });

  const activeIncidents = MOCK_CONFIRMED_INCIDENTS.filter(
    i => i.status === IncidentStatus.ACTIVE || i.status === IncidentStatus.UNDER_RESPONSE
  );

  useEffect(() => {
    if (!socket) return;
    const handleResourceUpdated = (data: any) => {
      setResources(prev => prev.map(r => 
        r.resourceId === data.resourceId 
          ? { 
              ...r, 
              status: data.status, 
              lastUpdated: data.lastUpdated,
              ...(data.clearAssignment && { assignedIncident: undefined, assignedIncidentTitle: undefined }),
              ...(data.assignedIncident && { assignedIncident: data.assignedIncident, assignedIncidentTitle: data.assignedIncidentTitle }),
              ...(data.capacity !== undefined && { capacity: data.capacity, currentLoad: data.currentLoad })
            } 
          : r
      ));
    };

    socket.on('dashboard:resource-updated', handleResourceUpdated);
    return () => {
      socket.off('dashboard:resource-updated', handleResourceUpdated);
    };
  }, [socket]);

  const filtered = resources.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.resourceId.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (districtFilter !== 'ALL' && r.district !== districtFilter) return false;
    if (enforcedDistrict !== 'ALL' && r.district !== enforcedDistrict) return false;
    return true;
  });

  const availableCount = filtered.filter(r => r.status === ResourceStatus.AVAILABLE).length;
  const assignedCount = filtered.filter(r => r.status === ResourceStatus.ASSIGNED || r.status === ResourceStatus.BUSY).length;

  const handleStatusUpdate = (id: string, newStatus: ResourceStatus) => {
    const timestamp = new Date().toISOString();
    const clearAssignment = newStatus === ResourceStatus.AVAILABLE || newStatus === ResourceStatus.OUT_OF_SERVICE;
    
    setResources(prev => prev.map(r => r.resourceId === id ? { 
      ...r, 
      status: newStatus, 
      lastUpdated: timestamp,
      ...(clearAssignment && { assignedIncident: undefined, assignedIncidentTitle: undefined })
    } : r));
    
    if (socket) {
      socket.emit('client:update-resource-status', { 
        resourceId: id, 
        status: newStatus, 
        lastUpdated: timestamp,
        ...(clearAssignment && { clearAssignment: true })
      });
    }
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal || !selectedIncidentId) return;

    const incident = activeIncidents.find(i => i.incidentId === selectedIncidentId);
    if (!incident) return;

    const timestamp = new Date().toISOString();

    setResources(prev => prev.map(r => r.resourceId === assignModal ? { 
      ...r, 
      status: ResourceStatus.ASSIGNED, 
      assignedIncident: incident.incidentId, 
      assignedIncidentTitle: incident.title,
      lastUpdated: timestamp 
    } : r));

    if (socket) {
      socket.emit('client:update-resource-status', {
        resourceId: assignModal,
        status: ResourceStatus.ASSIGNED,
        assignedIncident: incident.incidentId,
        assignedIncidentTitle: incident.title,
        lastUpdated: timestamp
      });
    }

    setAssignModal(null);
    setSelectedIncidentId('');
  };

  const openShelterModal = (resource: any) => {
    setShelterModal(resource.resourceId);
    setShelterForm({ 
      capacity: resource.capacity || 0, 
      currentLoad: resource.currentLoad || 0 
    });
  };

  const handleShelterUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelterModal) return;

    const timestamp = new Date().toISOString();

    setResources(prev => prev.map(r => r.resourceId === shelterModal ? {
      ...r,
      capacity: shelterForm.capacity,
      currentLoad: shelterForm.currentLoad,
      lastUpdated: timestamp
    } : r));

    if (socket) {
      socket.emit('client:update-resource-status', {
        resourceId: shelterModal,
        capacity: shelterForm.capacity,
        currentLoad: shelterForm.currentLoad,
        lastUpdated: timestamp
      });
    }

    setShelterModal(null);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold tracking-tight">Resource Tracking</h1>
              {enforcedDistrict !== 'ALL' && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-400">
                  <MapPin size={12} /> {enforcedDistrict} Zone Only
                </span>
              )}
            </div>
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
                        <div className="absolute right-0 top-full mt-1 w-40 bg-[#181f2c] border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 p-1">
                          {Object.values(ResourceStatus).map(s => (
                            <button key={s} onClick={() => handleStatusUpdate(r.resourceId, s as ResourceStatus)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white rounded transition-colors">
                              Mark {s.replace('_', ' ')}
                            </button>
                          ))}
                          
                          {/* Dispatch Button */}
                          {hasPermission('dispatch:resources') && r.status !== ResourceStatus.ASSIGNED && r.status !== ResourceStatus.OUT_OF_SERVICE && (
                            <div className="pt-1 mt-1 border-t border-slate-700">
                              <button onClick={() => setAssignModal(r.resourceId)}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-blue-400 hover:bg-slate-800 rounded transition-colors">
                                Dispatch to Incident...
                              </button>
                            </div>
                          )}

                          {/* Manage Shelter Button */}
                          {hasPermission('manage:shelters') && r.type === ResourceType.SHELTER && (
                            <div className="pt-1 mt-1 border-t border-slate-700">
                              <button onClick={() => openShelterModal(r)}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-teal-400 hover:bg-slate-800 rounded transition-colors">
                                Manage Shelter Data...
                              </button>
                            </div>
                          )}
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

      {/* Dispatch Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131924] border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white">Dispatch Resource</h3>
              <button onClick={() => setAssignModal(null)} className="text-slate-400 hover:text-white"><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleDispatch} className="p-6">
              <p className="text-xs text-slate-400 mb-4">
                Select an active incident to dispatch resource <span className="font-bold text-blue-400">{assignModal}</span>.
              </p>
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2">Target Incident</label>
                <select 
                  required
                  value={selectedIncidentId} 
                  onChange={e => setSelectedIncidentId(e.target.value)}
                  className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="" disabled>Select an incident...</option>
                  {activeIncidents.map(inc => (
                    <option key={inc.incidentId} value={inc.incidentId}>
                      {inc.district} - {inc.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAssignModal(null)} className="flex-1 py-2.5 bg-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
                <button type="submit" disabled={!selectedIncidentId} className="flex-1 py-2.5 bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-xs font-bold text-white hover:bg-blue-500 transition-colors">Confirm Dispatch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shelter Management Modal */}
      {shelterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131924] border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2"><Home size={18} className="text-teal-400" /> Manage Shelter</h3>
              <button onClick={() => setShelterModal(null)} className="text-slate-400 hover:text-white"><XCircle size={18} /></button>
            </div>
            <form onSubmit={handleShelterUpdate} className="p-6">
              <p className="text-xs text-slate-400 mb-6">
                Update capacity and current occupancy for shelter <span className="font-bold text-teal-400">{shelterModal}</span>.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2">Max Capacity</label>
                  <input 
                    type="number" required min="1"
                    value={shelterForm.capacity} 
                    onChange={e => setShelterForm({...shelterForm, capacity: parseInt(e.target.value) || 0})}
                    className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2">Current Occupancy</label>
                  <input 
                    type="number" required min="0" max={shelterForm.capacity}
                    value={shelterForm.currentLoad} 
                    onChange={e => setShelterForm({...shelterForm, currentLoad: parseInt(e.target.value) || 0})}
                    className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 text-white"
                  />
                </div>
              </div>

              {/* Visual Indicator */}
              <div className="mb-8">
                <div className="flex justify-between text-[10px] font-bold mb-2">
                  <span className="text-slate-500">Occupancy Level</span>
                  <span className={shelterForm.currentLoad / (shelterForm.capacity || 1) > 0.9 ? 'text-red-400' : 'text-teal-400'}>
                    {Math.round((shelterForm.currentLoad / (shelterForm.capacity || 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${shelterForm.currentLoad / (shelterForm.capacity || 1) > 0.9 ? 'bg-red-500' : 'bg-teal-500'}`} 
                    style={{ width: `${Math.min((shelterForm.currentLoad / (shelterForm.capacity || 1)) * 100, 100)}%` }} 
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShelterModal(null)} className="flex-1 py-2.5 bg-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-teal-600 rounded-lg text-xs font-bold text-white hover:bg-teal-500 transition-colors">Save Updates</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}