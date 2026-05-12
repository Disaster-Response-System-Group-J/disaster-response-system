'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin, AlertTriangle, Users, Clock, ChevronLeft,
  Shield, Activity, Phone, Mail, User, Info,
  CheckCircle2, AlertCircle, Calendar
} from 'lucide-react';
import Link from 'next/link';

interface Personnel {
  id: string;
  name: string;
  role: string;
  email: string;
  assigned_role: string;
  assignment_status: string;
}

interface IncidentDetail {
  incident_id: string;
  title: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  affected_population: number;
  disasterType: string;
  district: string;
  description: string;
  created_at: string;
  updated_at: string;
  personnel: Personnel[];
}

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIncident = async () => {
      try {
        const res = await fetch(`/api/incidents/${id}`);
        if (!res.ok) throw new Error('Incident not found');
        const data = await res.json();
        setIncident(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIncident();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16] text-white items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-slate-400 font-medium">Loading Incident Details...</p>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0f16] text-white items-center justify-center p-6">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Error Loading Incident</h1>
        <p className="text-slate-400 mb-6">{error || 'Incident details could not be found.'}</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: 'text-red-400 bg-red-400/10 border-red-500/30',
    HIGH: 'text-orange-400 bg-orange-400/10 border-orange-500/30',
    MEDIUM: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
    LOW: 'text-blue-400 bg-blue-400/10 border-blue-500/30',
  };

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: 'text-green-400 bg-green-400/10 border-green-500/30',
    RESOLVED: 'text-slate-400 bg-slate-400/10 border-slate-500/30',
    PENDING: 'text-purple-400 bg-purple-400/10 border-purple-500/30',
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f16] text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-[#0a0f16]/80 backdrop-blur-md border-b border-slate-800/50 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-widest border ${SEVERITY_COLORS[incident.severity]}`}>
                  {incident.severity}
                </span>
                <span className="text-slate-500 text-xs font-medium">Incident #{incident.incident_id}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">{incident.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${STATUS_COLORS[incident.status]}`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${incident.status === 'ACTIVE' ? 'bg-green-400' : 'bg-slate-400'}`} />
              {incident.status}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-12 gap-8">

            {/* Left Column: Core Info */}
            <div className="col-span-8 space-y-8">

              {/* Overview Section */}
              <section className="bg-[#131924] border border-slate-800/80 rounded-2xl p-8">
                <div className="flex items-center gap-2 mb-6">
                  <Info size={18} className="text-blue-400" />
                  <h2 className="text-lg font-bold">Incident Overview</h2>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2 block">DISASTER TYPE</label>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                          <Activity size={20} className="text-blue-400" />
                        </div>
                        <span className="text-lg font-semibold">{incident.disasterType}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2 block">LOCATION & DISTRICT</label>
                      <div className="flex items-center gap-3 text-slate-200">
                        <MapPin size={18} className="text-slate-400" />
                        <span className="font-medium">{incident.district} Zone</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 font-medium ml-7">
                        Coordinates: {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2 block">AFFECTED POPULATION</label>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                          <Users size={20} className="text-orange-400" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">{incident.affected_population.toLocaleString()}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2 block">REPORTED TIME</label>
                      <div className="flex items-center gap-3 text-slate-200">
                        <Clock size={18} className="text-slate-400" />
                        <span className="font-medium">{new Date(incident.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-800/50">
                  <label className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-3 block">DETAILED DESCRIPTION</label>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-[#0a0f16]/50 p-4 rounded-xl border border-slate-800/50">
                    {incident.description || 'No detailed description provided for this incident.'}
                  </p>
                </div>
              </section>

              {/* Personnel Section */}
              <section className="bg-[#131924] border border-slate-800/80 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <Shield size={18} className="text-purple-400" />
                    <h2 className="text-lg font-bold">Dispatched Personnel</h2>
                  </div>
                  <span className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-bold text-slate-400 border border-slate-700/50">
                    {incident.personnel.length} Assigned
                  </span>
                </div>

                {incident.personnel.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-800/50 rounded-xl bg-slate-900/20">
                    <User size={32} className="text-slate-700 mb-3" />
                    <p className="text-sm text-slate-500 font-medium">No personnel dispatched to this incident yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {incident.personnel.map((p) => (
                      <div key={`${p.id}-${p.assigned_role}`} className="group relative bg-[#0a0f16] border border-slate-800 hover:border-blue-500/50 rounded-xl p-5 transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-blue-500/30">
                              <User size={18} className="text-slate-400 group-hover:text-blue-400" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-200">{p.name}</h4>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{p.role.replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                          <div className="px-2 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {p.assignment_status}
                          </div>
                        </div>

                        <div className="flex items-center gap-6 pt-4 border-t border-slate-800/50">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <Mail size={12} className="text-slate-500" />
                            <span className="font-medium truncate max-w-[150px]">{p.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <Activity size={12} className="text-slate-500" />
                            <span className="font-medium">Role: {p.assigned_role.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Actions & Sidebar */}
            <div className="col-span-4 space-y-8">

              {/* Status Update Card */}
              <section className="bg-[#131924] border border-slate-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-slate-200 mb-4 uppercase tracking-widest">Update Status</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center justify-between p-4 bg-[#0a0f16] border border-slate-800 hover:border-green-500/50 rounded-xl transition-all group">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-green-500" />
                      <span className="text-sm font-bold">Mark as Resolved</span>
                    </div>
                  </button>
                  <button className="w-full flex items-center justify-between p-4 bg-[#0a0f16] border border-slate-800 hover:border-red-500/50 rounded-xl transition-all group">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={18} className="text-red-500" />
                      <span className="text-sm font-bold">Escalate Severity</span>
                    </div>
                  </button>
                </div>
              </section>

              {/* Timeline/Audit */}
              <section className="bg-[#131924] border border-slate-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-slate-200 mb-6 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} className="text-slate-500" /> Activity Log
                </h3>
                <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full bg-[#131924] border-2 border-blue-500 z-10" />
                    <p className="text-[10px] text-slate-500 font-bold mb-1">{new Date(incident.created_at).toLocaleTimeString()}</p>
                    <p className="text-xs font-semibold text-slate-300">Incident created and tagged as {incident.severity}</p>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full bg-[#131924] border-2 border-slate-700 z-10" />
                    <p className="text-[10px] text-slate-500 font-bold mb-1">System Audit</p>
                    <p className="text-xs font-semibold text-slate-400 italic">No further updates recorded.</p>
                  </div>
                </div>
              </section>

              {/* Quick Actions */}
              <div className="flex gap-4">
                <button className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20">
                  Assign More
                </button>
                <button className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold transition-all border border-slate-700">
                  Export Report
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
