'use client';

import { useState, useEffect } from 'react';
import {
  Truck, Search, MapPin, Activity, CheckCircle2,
  XCircle, ChevronDown, Home, X, Inbox, Clock, AlertTriangle, Package, BrainCircuit, RefreshCcw, Loader2
} from 'lucide-react';
import { ResourceType, ResourceStatus, UserRole } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { DISTRICT_NAMES } from '@/data/districts';
import { useSocket } from '@/context/SocketContext';
import ResourcePlanView from './ResourcePlanView';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/20', // New
  STANDBY: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
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

  const [resources, setResources] = useState<any[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ASSETS' | 'SHELTERS' | 'REQUESTS' | 'AI_PLAN'>('ASSETS');

  // AI Plan state
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Resource Requests inbox
  const [resourceRequests, setResourceRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestFilter, setRequestFilter] = useState<string>('ALL');

  const enforcedDistrict = (user?.role === UserRole.SYSTEM_ADMIN || user?.role.includes('NATIONAL')) ? 'ALL' : (user as any)?.assignedDistrict || 'ALL';
  const hasDisplayablePlan = Boolean(
    currentPlan?.plan_data ||
    currentPlan?.plan_json ||
    currentPlan?.allocation_plan ||
    ['READY', 'DRAFT', 'APPROVED', 'EXECUTED'].includes(currentPlan?.status)
  );

  // State for modals
  const [assignModal, setAssignModal] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [shelterModal, setShelterModal] = useState<string | null>(null);
  const [shelterForm, setShelterForm] = useState({ capacity: 0, currentLoad: 0, status: 'STANDBY' });

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [assetsData, sheltersRes, incidentsRes] = await Promise.all([
          fetch('/api/resources/list').then(res => res.json()),
          fetch('/api/relief/shelter').then(res => res.json()),
          fetch('/api/incidents').then(res => res.json())
        ]);

        const assetsArray = assetsData.resources || [];
        const mappedAssets = assetsArray.map((a: any) => ({
          resourceId: `ASSET-${a.asset_id}`,
          dbId: a.asset_id,
          name: a.name,
          type: a.type as ResourceType,
          status: a.status as ResourceStatus,
          district: a.base_location || 'Unassigned',
          latitude: a.current_latitude,
          longitude: a.current_longitude,
          lastUpdated: new Date().toISOString()
        }));

        const mappedShelters = (Array.isArray(sheltersRes) ? sheltersRes : []).map((s: any) => ({
          resourceId: `SHELTER-${s.shelter_id}`,
          dbId: s.shelter_id,
          name: s.name,
          type: ResourceType.SHELTER,
          status: s.status,
          district: 'Unassigned',
          capacity: s.max_capacity,
          currentLoad: s.current_occupancy,
          lastUpdated: s.updated_at
        }));

        setResources([...mappedAssets, ...mappedShelters]);
        const incidentsArray = Array.isArray(incidentsRes) ? incidentsRes : [];
        setActiveIncidents(incidentsArray.filter((i: any) => i.status === 'ACTIVE'));
      } catch (err) {
        console.error('Error loading resources:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Fetch latest AI plan when the AI_PLAN tab is activated
  useEffect(() => {
    if (activeTab !== 'AI_PLAN') return;
    const fetchPlan = async () => {
      setPlanLoading(true);
      setPlanError(null);
      try {
        const res = await fetch('/api/resource-plan');
        if (!res.ok) throw new Error('Failed to load latest resource plan');
        setCurrentPlan(await res.json());
      } catch (err) {
        console.error('Error loading resource plan:', err);
        setPlanError('Could not load the latest AI resource plan.');
      } finally {
        setPlanLoading(false);
      }
    };
    fetchPlan();
  }, [activeTab]);

  const handleGeneratePlan = async () => {
    setPlanGenerating(true);
    setPlanError(null);
    try {
      const res = await fetch('/api/resource-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate resource plan');
      }
      setCurrentPlan(data);
    } catch (err) {
      console.error('Failed to generate plan:', err);
      setPlanError(err instanceof Error ? err.message : 'Failed to generate resource plan.');
    } finally {
      setPlanGenerating(false);
    }
  };

  // Fetch resource requests when the REQUESTS tab is activated
  useEffect(() => {
    if (activeTab !== 'REQUESTS') return;
    const fetchRequests = async () => {
      setRequestsLoading(true);
      try {
        const res = await fetch('/api/resources/requests');
        if (res.ok) setResourceRequests(await res.json());
      } catch (err) {
        console.error('Error loading resource requests:', err);
      } finally {
        setRequestsLoading(false);
      }
    };
    fetchRequests();
  }, [activeTab]);

  useEffect(() => {
    if (!socket) return;
    const handleResourceUpdated = (data: any) => {
      setResources(prev => prev.map(r =>
        r.resourceId === data.resourceId
          ? {
            ...r, status: data.status, lastUpdated: data.lastUpdated,
            ...(data.capacity !== undefined && { capacity: data.capacity, currentLoad: data.currentLoad })
          }
          : r
      ));
    };
    socket.on('dashboard:resource-updated', handleResourceUpdated);
    return () => { socket.off('dashboard:resource-updated', handleResourceUpdated); };
  }, [socket]);

  const filtered = resources.filter(r => {
    if (activeTab === 'ASSETS' && r.type === ResourceType.SHELTER) return false;
    if (activeTab === 'SHELTERS' && r.type !== ResourceType.SHELTER) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.resourceId.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (districtFilter !== 'ALL' && r.district !== districtFilter) return false;
    if (enforcedDistrict !== 'ALL' && r.district !== enforcedDistrict) return false;
    return true;
  });

  const availableCount = filtered.filter(r => r.status === ResourceStatus.AVAILABLE).length;
  const assignedCount = filtered.filter(r => r.status === ResourceStatus.ASSIGNED || r.status === ResourceStatus.BUSY).length;

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    const timestamp = new Date().toISOString();
    const dbId = id.split('-')[1];
    const isAsset = id.startsWith('ASSET-');

    try {
      if (isAsset) {
        await fetch('/api/resources/list', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId: dbId, status: newStatus }),
        });
      } else {
        // Logic for Shelter status updates
        await fetch('/api/relief/shelter', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shelterId: dbId,
            status: newStatus
          }),
        });
      }

      // Update local UI state
      setResources(prev => prev.map(r =>
        r.resourceId === id ? { ...r, status: newStatus, lastUpdated: timestamp } : r
      ));

      // Broadcast update via WebSockets
      if (socket) {
        socket.emit('client:update-resource-status', {
          resourceId: id,
          status: newStatus,
          lastUpdated: timestamp
        });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
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

  const openShelterModal = (resource: any) => {
    setShelterModal(resource.resourceId);
    setShelterForm({
      capacity: resource.capacity || 0,
      currentLoad: resource.currentLoad || 0,
      status: resource.status || 'OPEN'
    });
  };

  const handleShelterUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelterModal) return;

    const dbId = shelterModal.split('-')[1];
    const timestamp = new Date().toISOString();

    try {
      const response = await fetch('/api/relief/shelter', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shelterId: dbId,
          max_capacity: shelterForm.capacity,
          current_occupancy: shelterForm.currentLoad,
          status: shelterForm.status // Included status in update
        }),
      });

      if (!response.ok) throw new Error('Failed to update database');

      setResources(prev => prev.map(r => r.resourceId === shelterModal ? {
        ...r,
        capacity: shelterForm.capacity,
        currentLoad: shelterForm.currentLoad,
        status: shelterForm.status, // Update local UI
        lastUpdated: timestamp
      } : r));

      if (socket) {
        socket.emit('client:update-resource-status', {
          resourceId: shelterModal,
          status: shelterForm.status, // Broadcast via socket
          capacity: shelterForm.capacity,
          currentLoad: shelterForm.currentLoad,
          lastUpdated: timestamp
        });
      }

      setShelterModal(null);
    } catch (err) {
      console.error(err);
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

        <div className="flex gap-6 border-b border-slate-800/80 mb-6">
          <button
            onClick={() => setActiveTab('ASSETS')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'ASSETS' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
            Deployable Assets
          </button>
          <button
            onClick={() => setActiveTab('SHELTERS')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'SHELTERS' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
            Relief Shelters
          </button>
          {hasPermission('dispatch:resources') && (
            <button
              onClick={() => setActiveTab('REQUESTS')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'REQUESTS' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
              <Inbox size={14} />
              Resource Requests
              {resourceRequests.filter(r => r.status === 'PENDING').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {resourceRequests.filter(r => r.status === 'PENDING').length}
                </span>
              )}
            </button>
          )}
          {hasPermission('dispatch:resources') && (
            <button
              onClick={() => setActiveTab('AI_PLAN')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'AI_PLAN' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}>
              <BrainCircuit size={14} />
              AI Resource Plan
            </button>
          )}
        </div>

        {/* ── AI Resource Plan Tab ─────────────────────────────── */}
        {activeTab === 'AI_PLAN' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <BrainCircuit size={18} className="text-purple-400" /> AI Resource Allocation Plan
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Generated by J2 AI engine · Advisory only — review before dispatching
                </p>
              </div>
              <button
                onClick={handleGeneratePlan}
                disabled={planGenerating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-bold text-white transition-colors"
              >
                {planGenerating
                  ? <><Loader2 size={14} className="animate-spin" /> Requesting…</>
                  : <><RefreshCcw size={14} /> Generate New Plan</>}
              </button>
            </div>

            {planLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
              </div>
            ) : planError ? (
              <div className="text-center py-20 bg-[#131924] border border-red-500/20 rounded-xl">
                <AlertTriangle size={32} className="mx-auto mb-4 text-red-400" />
                <p className="text-sm font-semibold text-red-300 mb-2">AI plan unavailable</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">{planError}</p>
              </div>
            ) : !currentPlan ? (
              <div className="text-center py-24 bg-[#131924] border border-slate-800/80 rounded-xl">
                <BrainCircuit size={32} className="mx-auto mb-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-400 mb-2">No plan generated yet</p>
                <p className="text-xs text-slate-500 mb-6">Click Generate New Plan to request an AI allocation plan from the J2 engine.</p>
              </div>
            ) : currentPlan.status === 'PENDING' ? (
              <div className="text-center py-24 bg-[#131924] border border-purple-500/20 rounded-xl">
                <Loader2 size={32} className="mx-auto mb-4 text-purple-400 animate-spin" />
                <p className="text-sm font-semibold text-slate-300 mb-2">Plan generation in progress</p>
                <p className="text-xs text-slate-500">Waiting for J2 AI engine response via Kafka. This may take a moment.</p>
              </div>
            ) : hasDisplayablePlan ? (
              <ResourcePlanView plan={currentPlan} />
            ) : null}
          </div>
        )}

        <div className={`bg-[#131924] border border-slate-800/80 rounded-xl p-4 flex gap-4 mb-6 ${activeTab === 'AI_PLAN' ? 'hidden' : ''}`}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input type="text" placeholder={`Search ${activeTab.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" />
          </div>
          {activeTab === 'ASSETS' && (
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none min-w-[150px]">
              <option value="ALL">All Types</option>
              {Object.values(ResourceType).filter(t => t !== ResourceType.SHELTER).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          )}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none min-w-[150px]"
          >
            <option value="ALL">All Statuses</option>
            {/* Standard Asset Statuses */}
            {Object.values(ResourceStatus).map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
            {/* Add Shelter-specific statuses to the filter */}
            <option value="ACTIVE">ACTIVE</option>
            <option value="STANDBY">STANDBY</option>
          </select>
        </div>

        <div className={`bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden ${activeTab === 'AI_PLAN' ? 'hidden' : ''}`}>
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
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {r.resourceId}
                          {r.type === ResourceType.SHELTER && r.capacity !== undefined && (
                            <span className="ml-2 text-blue-400">({r.currentLoad}/{r.capacity} full)</span>
                          )}
                        </p>
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
                        {r.type === ResourceType.SHELTER ? (
                          <>
                            {/* Shelter specific actions */}
                            <button onClick={() => handleStatusUpdate(r.resourceId, 'ACTIVE')}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white rounded transition-colors">
                              Mark ACTIVE
                            </button>
                            <button onClick={() => handleStatusUpdate(r.resourceId, 'STANDBY')}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white rounded transition-colors">
                              Mark STANDBY
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Asset specific actions */}
                            {Object.values(ResourceStatus).map(s => (
                              <button key={s} onClick={() => handleStatusUpdate(r.resourceId, s)}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white rounded transition-colors">
                                Mark {s.replace('_', ' ')}
                              </button>
                            ))}
                          </>
                        )}

                        {/* Common specialized actions */}
                        {hasPermission('dispatch:resources') && r.status === 'AVAILABLE' && (
                          <button onClick={() => setAssignModal(r.resourceId)} className="w-full text-left px-3 py-2 text-xs font-bold text-blue-400 hover:bg-slate-800 border-t border-slate-700 mt-1 rounded transition-colors">
                            Dispatch to Incident...
                          </button>
                        )}
                        {r.type === ResourceType.SHELTER && (
                          <button onClick={() => openShelterModal(r)} className="w-full text-left px-3 py-2 text-xs font-bold text-teal-400 hover:bg-slate-800 border-t border-slate-700 mt-1 rounded transition-colors">
                            Manage Capacity...
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

        {/* ── Resource Requests Tab ─────────────────────────────── */}
        {activeTab === 'REQUESTS' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400">Incoming resource requests from field response teams.</p>
              <select
                value={requestFilter}
                onChange={e => setRequestFilter(e.target.value)}
                className="bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none">
                <option value="ALL">All Statuses</option>
                {['PENDING', 'APPROVED', 'DISPATCHED', 'FULFILLED', 'REJECTED'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {requestsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
              </div>
            ) : resourceRequests.filter(r => requestFilter === 'ALL' || r.status === requestFilter).length === 0 ? (
              <div className="text-center py-16 bg-[#131924] rounded-xl border border-slate-800/80">
                <Inbox size={28} className="mx-auto mb-3 text-slate-600" />
                <p className="text-sm text-slate-500">No resource requests found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {resourceRequests
                  .filter(r => requestFilter === 'ALL' || r.status === requestFilter)
                  .map((req: any) => (
                    <ResourceRequestCard
                      key={req.request_id}
                      req={req}
                      user={user}
                      onAction={async (requestId, status) => {
                        try {
                          const res = await fetch('/api/resources/requests', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ requestId, status, reviewedBy: user?.id }),
                          });
                          if (res.ok) {
                            setResourceRequests(prev =>
                              prev.map(r => r.request_id === requestId ? { ...r, status } : r)
                            );
                          }
                        } catch (err) {
                          console.error('Failed to update request', err);
                        }
                      }}
                    />
                  ))
                }
              </div>
            )}
          </div>
        )}
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

      {/* Shelter Modal Update */}
      {shelterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131924] border border-slate-700 rounded-xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between mb-6">
              <h3 className="font-bold text-white">Manage Shelter Data</h3>
              <button onClick={() => setShelterModal(null)} className="text-slate-400"><X size={18} /></button>
            </div>
            <form onSubmit={handleShelterUpdate}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Max Capacity</label>
                  <input type="number" value={shelterForm.capacity} onChange={e => setShelterForm({ ...shelterForm, capacity: parseInt(e.target.value) })} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Current Occupancy</label>
                  <input type="number" value={shelterForm.currentLoad} onChange={e => setShelterForm({ ...shelterForm, currentLoad: parseInt(e.target.value) })} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>

              {/* New Status Selection Field */}
              <div className="mb-6">
                <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Operational Status</label>
                <select
                  value={shelterForm.status}
                  onChange={e => setShelterForm({ ...shelterForm, status: e.target.value })}
                  className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="ACTIVE">ACTIVE (Operational)</option>
                  <option value="STANDBY">STANDBY (Offline/Ready)</option>
                </select>
              </div>

              <button type="submit" className="w-full py-2.5 bg-teal-600 rounded-lg text-xs font-bold text-white">Save Updates</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resource Request Card ─────────────────────────────────────────────────────

const REQUEST_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  APPROVED: 'bg-green-500/10 text-green-400 border-green-500/30',
  DISPATCHED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  FULFILLED: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const URGENCY_STYLES: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/20',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  MEDIUM: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  LOW: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

function ResourceRequestCard({
  req,
  user,
  onAction,
}: {
  req: any;
  user: any;
  onAction: (requestId: string, status: string) => Promise<void>;
}) {
  const items: any[] = typeof req.items === 'string' ? JSON.parse(req.items) : (req.items ?? []);

  return (
    <div className={`bg-[#131924] border rounded-xl p-5 transition-all ${req.status === 'PENDING' ? 'border-amber-500/20' : 'border-slate-800/80'
      }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-amber-400" />
            <span className="text-sm font-bold text-slate-100">
              {req.incident_title ?? 'Unlinked Request'}
            </span>
            {req.incident_district && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <MapPin size={9} /> {req.incident_district}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span>From: <span className="text-slate-300 font-semibold">{req.requester_name ?? 'Unknown'}</span></span>
            <span className="flex items-center gap-1">
              <Clock size={9} /> {new Date(req.created_at).toLocaleString()}
            </span>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${REQUEST_STATUS_STYLES[req.status] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
          {req.status}
        </span>
      </div>

      {/* Items breakdown */}
      {items.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Requested Items</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <div>
                  <p className="text-[10px] font-semibold text-slate-300">{item.resource_type?.replace(/_/g, ' ')}</p>
                  <p className="text-xs font-bold text-white">{item.quantity} {item.unit}</p>
                </div>
                {item.urgency && (
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${URGENCY_STYLES[item.urgency] ?? ''}`}>
                    {item.urgency}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {req.notes && (
        <p className="text-xs text-slate-400 italic mb-4 border-l-2 border-slate-700 pl-3">{req.notes}</p>
      )}

      {/* Actions — only shown for PENDING requests to resource managers */}
      {req.status === 'PENDING' && (
        <div className="flex gap-2 pt-3 border-t border-slate-800/50">
          <button
            onClick={() => onAction(req.request_id, 'APPROVED')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors">
            <CheckCircle2 size={12} /> Approve
          </button>
          <button
            onClick={() => onAction(req.request_id, 'DISPATCHED')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 transition-colors">
            <Truck size={12} /> Dispatch
          </button>
          <button
            onClick={() => onAction(req.request_id, 'REJECTED')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800/50 hover:bg-red-500/10 border border-slate-700/50 hover:border-red-500/20 text-slate-400 hover:text-red-400 transition-colors ml-auto">
            <XCircle size={12} /> Reject
          </button>
        </div>
      )}

      {req.status === 'APPROVED' && (
        <div className="flex gap-2 pt-3 border-t border-slate-800/50">
          <button
            onClick={() => onAction(req.request_id, 'DISPATCHED')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 transition-colors">
            <Truck size={12} /> Mark Dispatched
          </button>
        </div>
      )}

      {req.status === 'DISPATCHED' && (
        <div className="flex gap-2 pt-3 border-t border-slate-800/50">
          <button
            onClick={() => onAction(req.request_id, 'FULFILLED')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 transition-colors">
            <CheckCircle2 size={12} /> Mark Fulfilled
          </button>
        </div>
      )}
    </div>
  );
}
