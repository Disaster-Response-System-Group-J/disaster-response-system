'use client';

import { useState, useEffect } from 'react';
import { 
  Truck, Search, MapPin, Activity, CheckCircle2, 
  XCircle, ChevronDown, Home, X 
} from 'lucide-react';
import { ResourceType, ResourceStatus, IncidentStatus, UserRole } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DISTRICT_NAMES } from '@/data/districts';
import { useSocket } from '@/context/SocketContext';

interface ApiAsset {
  asset_id: number | string;
  name?: string;
  type?: string;
  status?: string;
  base_location?: string;
  current_latitude?: number;
  current_longitude?: number;
}

interface ApiShelterRow {
  shelter_id: number | string;
  name?: string;
  status?: string;
  max_capacity?: number;
  current_occupancy?: number;
  updated_at?: string;
}

interface ApiIncidentRow {
  incident_id: number | string;
  status?: string;
  title?: string;
}

interface MappedResource {
  resourceId: string;
  dbId: number | string;
  name: string;
  type: string;
  status: string;
  district: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  currentLoad?: number;
  lastUpdated?: string;
}

interface SocketResourceUpdate {
  resourceId: string;
  status: string;
  lastUpdated: string;
  capacity?: number;
  currentLoad?: number;
}

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

  const [resources, setResources] = useState<MappedResource[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<ApiIncidentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  
  const enforcedDistrict = (user?.role === UserRole.SYSTEM_ADMIN || user?.role.includes('NATIONAL')) ? 'ALL' : (user as { assignedDistrict?: string })?.assignedDistrict || 'ALL';

  // State for modals
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [shelterModal, setShelterModal] = useState<string | null>(null);
  const [shelterForm, setShelterForm] = useState({ capacity: 0, currentLoad: 0 });

  useEffect(() => {
  const fetchAllData = async () => {
    try {
      const [assetsData, sheltersRes, incidentsRes] = await Promise.all([
        fetch('/api/resources/list').then(res => res.json()),
        fetch('/api/relief/shelter').then(res => res.json()),
        fetch('/api/incidents').then(res => res.json())
      ]);

      // Access the .resources array from the API response
      const assetsArray = assetsData.resources || []; 

      // Map Assets
      const mappedAssets: MappedResource[] = (assetsArray as ApiAsset[]).map((a) => ({
        resourceId: `ASSET-${a.asset_id}`,
        dbId: a.asset_id,
        name: a.name ?? 'Unknown',
        type: a.type ?? 'UNKNOWN',
        status: a.status ?? 'UNKNOWN',
        district: a.base_location || 'Unassigned',
        latitude: a.current_latitude,
        longitude: a.current_longitude,
        lastUpdated: new Date().toISOString(),
      }));

      // Map Shelters (Ensure sheltersRes is handled as an array)
      const mappedShelters: MappedResource[] = (Array.isArray(sheltersRes) ? sheltersRes as ApiShelterRow[] : []).map((s) => ({
        resourceId: `SHELTER-${s.shelter_id}`,
        dbId: s.shelter_id ?? 0,
        name: s.name ?? 'Unknown Shelter',
        type: ResourceType.SHELTER,
        status: s.status === 'OPEN' ? ResourceStatus.AVAILABLE : ResourceStatus.OUT_OF_SERVICE,
        district: 'Unassigned',
        capacity: s.max_capacity,
        currentLoad: s.current_occupancy,
        lastUpdated: s.updated_at,
      }));

      setResources([...mappedAssets, ...mappedShelters]);

      // Ensure incidentsRes is handled as an array before filtering
      const incidentsArray = (Array.isArray(incidentsRes) ? incidentsRes : []) as ApiIncidentRow[];
      setActiveIncidents(incidentsArray.filter((i) => i.status === 'ACTIVE'));
      
    } catch (err) {
      console.error('Error loading resources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  fetchAllData();
}, []);

  useEffect(() => {
    if (!socket) return;
    const handleResourceUpdated = (data: SocketResourceUpdate) => {
      setResources(prev => prev.map(r => 
        r.resourceId === data.resourceId 
          ? { ...r, status: data.status, lastUpdated: data.lastUpdated,
              ...(data.capacity !== undefined && { capacity: data.capacity, currentLoad: data.currentLoad }) } 
          : r
      ));
    };
    socket.on('dashboard:resource-updated', handleResourceUpdated);
    return () => { socket.off('dashboard:resource-updated', handleResourceUpdated); };
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
    setResources(prev => prev.map(r => r.resourceId === id ? { ...r, status: newStatus, lastUpdated: timestamp } : r));
    if (socket) {
      socket.emit('client:update-resource-status', { resourceId: id, status: newStatus, lastUpdated: timestamp });
    }
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal || !selectedIncidentId) return;
    const incident = activeIncidents.find(i => i.incident_id.toString() === selectedIncidentId);
    if (!incident) return;
    handleStatusUpdate(assignModal, ResourceStatus.ASSIGNED);
    setAssignModal(null);
    setSelectedIncidentId('');
  };

  const openShelterModal = (resource: MappedResource) => {
    setShelterModal(resource.resourceId);
    setShelterForm({ capacity: resource.capacity || 0, currentLoad: resource.currentLoad || 0 });
  };

  const handleShelterUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!shelterModal) return;

  // Extract the raw numeric ID from "SHELTER-123"
  const dbId = shelterModal.split('-')[1];
  const timestamp = new Date().toISOString();

  try {
    // 1. PERSIST TO DATABASE
    const response = await fetch('/api/relief/shelter', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        shelterId: dbId, 
        max_capacity: shelterForm.capacity,      // Matches API key
        current_occupancy: shelterForm.currentLoad // Matches API key
      }),
    });

    if (!response.ok) throw new Error('Failed to update database');

    // 2. UPDATE LOCAL UI[cite: 5]
    setResources(prev => prev.map(r => r.resourceId === shelterModal ? {
      ...r,
      capacity: shelterForm.capacity,
      currentLoad: shelterForm.currentLoad,
      lastUpdated: timestamp
    } : r));

    // 3. BROADCAST VIA SOCKET[cite: 5]
    if (socket) {
      socket.emit('client:update-resource-status', {
        resourceId: shelterModal,
        capacity: shelterForm.capacity,
        currentLoad: shelterForm.currentLoad,
        lastUpdated: timestamp
      });
    }

    setShelterModal(null);
  } catch (err) {
    console.error(err);
    alert('Critical Error: Could not save shelter data to database.');
  }
};

  if (isLoading) {
    return <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>;
  }

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

        <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-4 flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input type="text" placeholder="Search resources..." value={search} onChange={e => setSearch(e.target.value)}
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
        </div>

        <div className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/80 bg-[#0a0f16]/50 text-[9px] font-bold text-slate-500 tracking-widest uppercase">
                <th className="px-6 py-4">RESOURCE ID / NAME</th>
                <th className="px-6 py-4">TYPE & LOCATION</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(r => (
                <tr key={r.resourceId} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-sm border border-slate-700">
                        {TYPE_ICONS[r.type] || '📦'}
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
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block group">
                      <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-1">
                        Update <ChevronDown size={12} />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-48 bg-[#181f2c] border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 p-1">
                        {Object.values(ResourceStatus).map(s => (
                          <button key={s} onClick={() => handleStatusUpdate(r.resourceId, s as ResourceStatus)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white rounded transition-colors">
                            Mark {s.replace('_', ' ')}
                          </button>
                        ))}
                        {hasPermission('dispatch:resources') && r.status === ResourceStatus.AVAILABLE && (
                          <button onClick={() => setAssignModal(r.resourceId)} className="w-full text-left px-3 py-2 text-xs font-bold text-blue-400 hover:bg-slate-800 border-t border-slate-700 mt-1 rounded transition-colors">
                            Dispatch to Incident...
                          </button>
                        )}
                        {r.type === ResourceType.SHELTER && (
                          <button onClick={() => openShelterModal(r)} className="w-full text-left px-3 py-2 text-xs font-bold text-teal-400 hover:bg-slate-800 border-t border-slate-700 mt-1 rounded transition-colors">
                            Manage Shelter...
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
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
              <p className="text-xs text-slate-400 mb-4">Select an active incident for <span className="font-bold text-blue-400">{assignModal}</span>.</p>
              <select required value={selectedIncidentId} onChange={e => setSelectedIncidentId(e.target.value)} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-blue-500 text-white mb-6">
                <option value="" disabled>Select an incident...</option>
                {activeIncidents.map(inc => <option key={inc.incident_id} value={inc.incident_id}>{inc.title}</option>)}
              </select>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAssignModal(null)} className="flex-1 py-2.5 bg-slate-800 rounded-lg text-xs font-bold text-slate-300">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 rounded-lg text-xs font-bold text-white">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shelter Modal */}
      {shelterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131924] border border-slate-700 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between mb-6">
              <h3 className="font-bold text-white">Manage Shelter Data</h3>
              <button onClick={() => setShelterModal(null)} className="text-slate-400"><X size={18}/></button>
            </div>
            <form onSubmit={handleShelterUpdate}>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Max Capacity</label>
                  <input type="number" value={shelterForm.capacity} onChange={e => setShelterForm({...shelterForm, capacity: parseInt(e.target.value)})} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Current Occupancy</label>
                  <input type="number" value={shelterForm.currentLoad} onChange={e => setShelterForm({...shelterForm, currentLoad: parseInt(e.target.value)})} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-teal-600 rounded-lg text-xs font-bold text-white">Save Updates</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}