'use client';

import { useState } from 'react';
import { 
  Users, UserPlus, Shield, Mail, Key, Edit2, 
  UserX, UserCheck, CheckCircle2, Search, X 
} from 'lucide-react';
import { MOCK_USERS } from '@/data/mock-data';
import { UserRole } from '@/types';

// Extended local type to include status for the demo
type AdminUser = typeof MOCK_USERS[0] & { status: 'ACTIVE' | 'SUSPENDED' };

const INITIAL_USERS: AdminUser[] = MOCK_USERS.map(u => ({ ...u, status: 'ACTIVE' }));

const ROLE_STYLES: Record<string, string> = {
  [UserRole.ADMIN]: 'bg-red-500/10 text-red-400 border-red-500/20',
  [UserRole.OFFICER]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [UserRole.RESOURCE_MANAGER]: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
};

export default function AdminPanelPage() {
  const [users, setUsers] = useState<AdminUser[]>(INITIAL_USERS);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ name: '', email: '', role: UserRole.OFFICER });
  const [actionMessage, setActionMessage] = useState('');

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const showMessage = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 3000);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) {
      const newUser: AdminUser = {
        id: `USR-${Math.floor(Math.random() * 1000)}`,
        name: formData.name,
        email: formData.email,
        role: formData.role as UserRole,
        password: 'temp_password',
        status: 'ACTIVE'
      };
      setUsers([...users, newUser]);
      showMessage('User created successfully');
    } else if (selectedUser) {
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...formData } : u));
      setSelectedUser({ ...selectedUser, ...formData });
      showMessage('User updated successfully');
    }
    setIsCreating(false);
    setIsEditing(false);
  };

  const toggleStatus = () => {
    if (!selectedUser) return;
    const newStatus = selectedUser.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setUsers(users.map(u => u.id === selectedUser.id ? { ...u, status: newStatus } : u));
    setSelectedUser({ ...selectedUser, status: newStatus });
    showMessage(`User account ${newStatus.toLowerCase()}`);
  };

  const resetPassword = () => {
    showMessage('Password reset link sent to user email');
  };

  const startCreate = () => {
    setFormData({ name: '', email: '', role: UserRole.OFFICER });
    setSelectedUser(null);
    setIsCreating(true);
    setIsEditing(false);
  };

  const startEdit = () => {
    if (!selectedUser) return;
    setFormData({ name: selectedUser.name, email: selectedUser.email, role: selectedUser.role });
    setIsEditing(true);
    setIsCreating(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">User Management</h1>
            <p className="text-sm text-slate-400">Manage system access, roles, and security credentials.</p>
          </div>
          <button 
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs font-bold text-blue-400 transition-colors"
          >
            <UserPlus size={16} /> Add New User
          </button>
        </div>

        {actionMessage && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm font-semibold text-green-400">
            <CheckCircle2 size={16} /> {actionMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: User List */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#131924] border border-slate-800 rounded-lg pl-9 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" 
              />
            </div>

            <div className="space-y-3">
              {filteredUsers.map(u => (
                <div 
                  key={u.id}
                  onClick={() => { setSelectedUser(u); setIsCreating(false); setIsEditing(false); }}
                  className={`bg-[#131924] border rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all hover:border-slate-700 ${selectedUser?.id === u.id ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800/80'} ${u.status === 'SUSPENDED' ? 'opacity-60' : ''}`}
                >
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
                    {u.role.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Details / Form Panel */}
          <div className="lg:col-span-1">
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6 sticky top-8">
              {(isCreating || isEditing) ? (
                // Add / Edit Form
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-bold">{isCreating ? 'Create New User' : 'Edit User Profile'}</h3>
                    <button onClick={() => { setIsCreating(false); setIsEditing(false); }} className="text-slate-500 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                  <form onSubmit={handleSaveUser} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1.5 tracking-widest uppercase">Full Name</label>
                      <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1.5 tracking-widest uppercase">Email Address</label>
                      <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1.5 tracking-widest uppercase">System Role</label>
                      <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                        <option value={UserRole.ADMIN}>Administrator</option>
                        <option value={UserRole.OFFICER}>Incident Officer</option>
                        <option value={UserRole.RESOURCE_MANAGER}>Resource Manager</option>
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
                // View Mode
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
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1 flex items-center gap-1.5"><Mail size={12}/> EMAIL</p>
                      <p className="text-sm text-slate-200">{selectedUser.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1 flex items-center gap-1.5"><Shield size={12}/> ROLE</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${ROLE_STYLES[selectedUser.role]}`}>
                        {selectedUser.role.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">ACCOUNT STATUS</p>
                      <span className={`text-xs font-bold ${selectedUser.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedUser.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button onClick={startEdit} className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 transition-colors">
                      <Edit2 size={14} /> Edit Profile
                    </button>
                    <button onClick={resetPassword} className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 transition-colors">
                      <Key size={14} /> Send Password Reset
                    </button>
                    <button onClick={toggleStatus} className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors ${selectedUser.status === 'ACTIVE' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}>
                      {selectedUser.status === 'ACTIVE' ? <><UserX size={14} /> Suspend Account</> : <><UserCheck size={14} /> Activate Account</>}
                    </button>
                  </div>
                </div>
              ) : (
                // Empty State
                <div className="text-center py-20 text-slate-500">
                  <Users size={32} className="mx-auto mb-4 opacity-50" />
                  <p className="text-sm font-medium">Select a user to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}