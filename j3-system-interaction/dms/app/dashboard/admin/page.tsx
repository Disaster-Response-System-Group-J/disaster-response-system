'use client';

import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Shield, Mail, Key, Edit2,
  UserX, UserCheck, CheckCircle2, Search, X,
  AlertTriangle, Plus, Trash2, Settings, List, Save, Activity
} from 'lucide-react';
import { AdminAuditDashboard } from '@/components/admin/admin-audit-dashboard';
import { UserRole, DISASTER_TYPES, User } from '@/types';
import { createClient } from '@supabase/supabase-js';

type AdminUser = User & { status: 'ACTIVE' | 'SUSPENDED' };
type AdminTab = 'users' | 'disasters' | 'config' | 'audit';

const INITIAL_USERS: AdminUser[] = [];
const CORE_DISASTER_TYPES = new Set<string>(Object.values(DISASTER_TYPES));
const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: typeof Users }> = [
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'disasters', label: 'Disaster Types', icon: AlertTriangle },
  { id: 'config', label: 'System Config', icon: Settings },
  { id: 'audit', label: 'Audit Logs', icon: List }
];

const ROLE_STYLES: Record<string, string> = {
  [UserRole.SYSTEM_ADMIN]: 'bg-red-500/10 text-red-400 border-red-500/20',
  [UserRole.INCIDENT_COMMANDER_NATIONAL]: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  [UserRole.INCIDENT_COMMANDER_ZONAL]: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  [UserRole.OPERATIONS_OFFICER_NATIONAL]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [UserRole.OPERATIONS_OFFICER_ZONAL]: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  [UserRole.RESOURCE_MANAGER_NATIONAL]: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  [UserRole.RESOURCE_MANAGER_ZONAL]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  [UserRole.PUBLIC_USER]: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  [UserRole.FIELD_OFFICER]: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  [UserRole.LOGISTICS_STAFF]: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  [UserRole.RESPONSE_TEAM_MEMBER]: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function AdminPanelPage() {
  const [users, setUsers] = useState<AdminUser[]>(INITIAL_USERS);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [formData, setFormData] = useState({ name: '', email: '', role: UserRole.OPERATIONS_OFFICER_ZONAL });
  const [actionMessage, setActionMessage] = useState('');

  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase.from('User').select('*');
      if (data && !error) {
        setUsers(data.map((u: any) => ({ ...u, status: 'ACTIVE' })));
      }
    };

    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, supabase]);

  const [disasterTypes, setDisasterTypes] = useState<string[]>([
    DISASTER_TYPES.FLOOD, DISASTER_TYPES.LANDSLIDE, DISASTER_TYPES.DROUGHT, DISASTER_TYPES.OTHER, 'CYCLONE'
  ]);
  const [newDisasterType, setNewDisasterType] = useState('');

  const [sysConfig, setSysConfig] = useState({
    floodWarningThreshold: 4.5,
    autoAlertsEnabled: true,
    maintenanceMode: false,
    maxUploadSizeMB: 10
  });

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3000);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      const newUser = {
        id: `USR-${Math.floor(Math.random() * 1000)}`,
        name: formData.name,
        email: formData.email,
        role: formData.role as UserRole,
        status: 'ACTIVE' as const
      } as AdminUser;

      setUsers([...users, newUser]);
      showMessage('User created successfully');
    } else if (selectedUser) {
      const { error } = await supabase
        .from('User')
        .update({ name: formData.name, role: formData.role })
        .eq('id', selectedUser.id);

      if (!error) {
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...formData } : u));
        setSelectedUser({ ...selectedUser, ...formData });
        showMessage('User updated successfully');
      } else {
        showMessage('Failed to update user');
      }
    }
    setIsCreating(false); setIsEditing(false);
  };

  const toggleStatus = () => {
    if (!selectedUser) return;
    const newStatus = selectedUser.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setUsers(users.map(u => u.id === selectedUser.id ? { ...u, status: newStatus } : u));
    setSelectedUser({ ...selectedUser, status: newStatus });
    showMessage(`User account ${newStatus.toLowerCase()}`);
  };

  const resetPassword = () => showMessage('Password reset link sent to user email');

  const addDisasterType = () => {
    if (newDisasterType.trim() && !disasterTypes.includes(newDisasterType.trim())) {
      setDisasterTypes([...disasterTypes, newDisasterType.trim()]);
      setNewDisasterType('');
      showMessage('Disaster type added successfully');
    }
  };

  const removeDisasterType = (type: string) => {
    if (CORE_DISASTER_TYPES.has(type)) return showMessage('Cannot remove core disaster types');
    setDisasterTypes(disasterTypes.filter(t => t !== type));
    showMessage('Disaster type removed successfully');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    showMessage('System configuration updated successfully');
  };

  const startCreate = () => {
    setFormData({ name: '', email: '', role: UserRole.OPERATIONS_OFFICER_ZONAL });
    setSelectedUser(null); setIsCreating(true); setIsEditing(false);
  };

  const startEdit = () => {
    if (!selectedUser) return;
    setFormData({ name: selectedUser.name, email: selectedUser.email, role: selectedUser.role });
    setIsEditing(true); setIsCreating(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">System Administration</h1>
            <p className="text-sm text-slate-400">Manage users, roles, system configuration, and audit logs.</p>
          </div>
          {activeTab === 'users' && (
            <button onClick={startCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs font-bold text-blue-400 transition-colors">
              <UserPlus size={16} /> Add New User
            </button>
          )}
        </div>

        <div className="flex gap-1 mb-6 bg-[#131924] border border-slate-800/80 rounded-lg p-1 overflow-x-auto">
          {ADMIN_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === tab.id
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'text-slate-400 hover:text-slate-300'
                }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {actionMessage && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm font-semibold text-green-400">
            <CheckCircle2 size={16} /> {actionMessage}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#131924] border border-slate-800 rounded-lg pl-9 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="space-y-3">
                {filteredUsers.map(u => (
                  <div key={u.id} onClick={() => { setSelectedUser(u); setIsCreating(false); setIsEditing(false); }}
                    className={`bg-[#131924] border rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all hover:border-slate-700 ${selectedUser?.id === u.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800/80'} ${u.status === 'SUSPENDED' ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          {u.name}
                          {u.status === 'SUSPENDED' && <span className="px-1.5 py-0.5 text-[8px] bg-red-500/20 text-red-400 rounded border border-red-500/20">SUSPENDED</span>}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">{u.email}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[9px] font-bold tracking-widest border ${ROLE_STYLES[u.role] || 'bg-slate-800 text-slate-300'}`}>
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6 sticky top-8">
                {(isCreating || isEditing) ? (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base font-bold">{isCreating ? 'Create New User' : 'Edit User Profile'}</h3>
                      <button onClick={() => { setIsCreating(false); setIsEditing(false); }} className="text-slate-500 hover:text-white"><X size={16} /></button>
                    </div>
                    <form onSubmit={handleSaveUser} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1.5 tracking-widest uppercase">Full Name</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1.5 tracking-widest uppercase">Email Address</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1.5 tracking-widest uppercase">System Role</label>
                        <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                          <optgroup label="Command Roles">
                            <option value={UserRole.SYSTEM_ADMIN}>System Administrator</option>
                            <option value={UserRole.INCIDENT_COMMANDER_NATIONAL}>National Incident Commander</option>
                            <option value={UserRole.INCIDENT_COMMANDER_ZONAL}>Zonal Incident Commander</option>
                            <option value={UserRole.OPERATIONS_OFFICER_NATIONAL}>National Operations Officer</option>
                            <option value={UserRole.OPERATIONS_OFFICER_ZONAL}>Zonal Operations Officer</option>
                            <option value={UserRole.RESOURCE_MANAGER_NATIONAL}>National Resource Manager</option>
                            <option value={UserRole.RESOURCE_MANAGER_ZONAL}>Zonal Resource Manager</option>
                          </optgroup>
                          <optgroup label="Mobile App Roles">
                            <option value={UserRole.FIELD_OFFICER}>Field Officer</option>
                            <option value={UserRole.LOGISTICS_STAFF}>Logistics Staff</option>
                            <option value={UserRole.RESPONSE_TEAM_MEMBER}>Response Team Member</option>
                          </optgroup>
                        </select>
                      </div>
                      <div className="pt-4 mt-4 border-t border-slate-800">
                        <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition-colors">
                          {isCreating ? 'Create Account' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : selectedUser ? (
                  <div>
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-800">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl text-slate-300 font-bold border border-slate-700">
                        {selectedUser.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{selectedUser.name}</h3>
                        <p className="text-[10px] font-mono text-slate-500">{selectedUser.id}</p>
                      </div>
                    </div>
                    <div className="space-y-5 mb-8">
                      <div><p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1 flex items-center gap-1.5"><Mail size={12} /> EMAIL</p><p className="text-sm text-slate-200">{selectedUser.email}</p></div>
                      <div><p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1 flex items-center gap-1.5"><Shield size={12} /> ROLE</p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${ROLE_STYLES[selectedUser.role]}`}>{selectedUser.role.replace(/_/g, ' ')}</span>
                      </div>
                      <div><p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">ACCOUNT STATUS</p>
                        <span className={`text-xs font-bold ${selectedUser.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}`}>{selectedUser.status}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <button onClick={startEdit} className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 transition-colors"><Edit2 size={14} /> Edit Profile</button>
                      <button onClick={resetPassword} className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 transition-colors"><Key size={14} /> Send Password Reset</button>
                      <button onClick={toggleStatus} className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors ${selectedUser.status === 'ACTIVE' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>
                        {selectedUser.status === 'ACTIVE' ? <><UserX size={14} /> Suspend Account</> : <><UserCheck size={14} /> Activate Account</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-slate-500"><Users size={32} className="mx-auto mb-4 opacity-50" /><p className="text-sm font-medium">Select a user to view details</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'disasters' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-orange-400" /> Configured Disaster Types</h3>
                <div className="space-y-3">
                  {disasterTypes.map(type => (
                    <div key={type} className="flex items-center justify-between bg-[#0a0f16] border border-slate-700 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${type === DISASTER_TYPES.FLOOD ? 'bg-blue-400' : type === DISASTER_TYPES.LANDSLIDE ? 'bg-orange-400' : type === DISASTER_TYPES.DROUGHT ? 'bg-yellow-400' : 'bg-purple-400'}`} />
                        <span className="text-sm font-semibold text-slate-200">{type}</span>
                        {CORE_DISASTER_TYPES.has(type) && <span className="px-1.5 py-0.5 text-[8px] bg-blue-500/20 text-blue-400 rounded border border-blue-500/20">CORE</span>}
                      </div>
                      {!CORE_DISASTER_TYPES.has(type) && <button onClick={() => removeDisasterType(type)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6 sticky top-8">
                <h3 className="text-base font-bold mb-6 flex items-center gap-2"><Plus size={16} className="text-green-400" /> Add Disaster Type</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 tracking-widest uppercase">Disaster Name</label>
                    <input type="text" value={newDisasterType} onChange={e => setNewDisasterType(e.target.value)} placeholder="e.g., Earthquake, Tsunami" className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                  </div>
                  <button onClick={addDisasterType} disabled={!newDisasterType.trim()} className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-xs font-bold text-white transition-colors">Add Disaster Type</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-800/50 bg-slate-800/20">
                <h2 className="text-lg font-bold flex items-center gap-2"><Settings size={20} className="text-blue-400" /> Global System Parameters</h2>
                <p className="text-xs text-slate-400 mt-1">Changes made here affect the core logic of the J2 Risk Engine and J3 Dashboard.</p>
              </div>

              <form onSubmit={handleSaveConfig} className="p-6 space-y-8">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-4 flex items-center gap-2"><Activity size={12} /> J2 Risk Engine Thresholds</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">River Flood Danger Threshold (m)</label>
                      <p className="text-[10px] text-slate-500 mb-2">Triggers automatic alerts if telemetry exceeds this average level.</p>
                      <input type="number" step="0.1" value={sysConfig.floodWarningThreshold} onChange={e => setSysConfig({ ...sysConfig, floodWarningThreshold: parseFloat(e.target.value) })}
                        className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800/50">
                  <h3 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-4">Automation & Triage</h3>
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center mt-0.5">
                        <input type="checkbox" checked={sysConfig.autoAlertsEnabled} onChange={e => setSysConfig({ ...sysConfig, autoAlertsEnabled: e.target.checked })} className="sr-only" />
                        <div className={`w-10 h-5 rounded-full transition-colors ${sysConfig.autoAlertsEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                        <div className={`absolute w-3.5 h-3.5 bg-white rounded-full transition-transform ${sysConfig.autoAlertsEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors">Enable Automated Public Risk Alerts</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Allow J2 Engine to bypass Incident Commander approval for CRITICAL telemetry spikes.</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800/50">
                  <h3 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-4">System Operations</h3>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">Max Media Upload Size (MB)</label>
                      <input type="number" value={sysConfig.maxUploadSizeMB} onChange={e => setSysConfig({ ...sysConfig, maxUploadSizeMB: parseInt(e.target.value) })}
                        className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer group p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                    <div className="relative flex items-center mt-0.5">
                      <input type="checkbox" checked={sysConfig.maintenanceMode} onChange={e => setSysConfig({ ...sysConfig, maintenanceMode: e.target.checked })} className="sr-only" />
                      <div className={`w-10 h-5 rounded-full transition-colors ${sysConfig.maintenanceMode ? 'bg-orange-500' : 'bg-slate-700'}`}></div>
                      <div className={`absolute w-3.5 h-3.5 bg-white rounded-full transition-transform ${sysConfig.maintenanceMode ? 'translate-x-5' : 'translate-x-1'}`}></div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-orange-400">System Maintenance Mode</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Suspends public portal reporting and displays a maintenance screen.</p>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold text-white transition-colors">
                    <Save size={16} /> Save Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <AdminAuditDashboard />
        )}
      </div>
    </div>
  );
}