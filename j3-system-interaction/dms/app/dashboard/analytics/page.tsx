'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Shield, TrendingUp, Users, Activity, MapPin, AlertTriangle } from 'lucide-react';
import { DISTRICT_NAMES } from '@/data/districts';
import { IncidentSeverity } from '@/types';

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
};

export default function AnalyticsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [shelterStats, setShelterStats] = useState({ utilization: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch live analytics data
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const [incidentsRes, sheltersRes] = await Promise.all([
          fetch('/api/incidents').then(res => res.json()),
          fetch('/api/relief/shelter').then(res => res.json())
        ]);

        setIncidents(incidentsRes);

        const totalCapacity = sheltersRes.reduce((sum: number, s: any) => sum + (s.max_capacity || 0), 0);
        const totalOccupancy = sheltersRes.reduce((sum: number, s: any) => sum + (s.current_occupancy || 0), 0);
        setShelterStats({ 
          utilization: totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0 
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, []);

  const severityData = useMemo(() => 
    Object.values(IncidentSeverity).map(sev => ({
      name: sev,
      value: incidents.filter(i => i.severity === sev).length
    })), [incidents]);

  const districtData = useMemo(() => 
    DISTRICT_NAMES
      .map(d => ({
        name: d,
        incidents: incidents.filter(i => i.district === d || i.location === d).length
      }))
      .filter(d => d.incidents > 0)
      .sort((a, b) => b.incidents - a.incidents), 
  [incidents]);

  const trendData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const dayIncidents = incidents.filter(inc => inc.created_at?.startsWith(dateStr));
      
      return { 
        day: days[d.getDay()],
        floods: dayIncidents.filter(inc => inc.title?.toUpperCase().includes('FLOOD')).length,
        landslides: dayIncidents.filter(inc => inc.title?.toUpperCase().includes('LANDSLIDE')).length,
        droughts: dayIncidents.filter(inc => inc.title?.toUpperCase().includes('DROUGHT')).length,
        other: dayIncidents.length 
      };
    });
  }, [incidents]);

  const totalAffected = incidents.reduce((sum, i) => sum + (i.affected_population || 0), 0);

  if (isLoading) return <div className="flex-1 bg-[#0a0f16] flex items-center justify-center text-blue-500">Loading Analytics...</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Analytics & Reporting</h1>
        <p className="text-sm text-slate-400 mb-8">Data-driven insights for disaster response coordination[cite: 6].</p>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Affected" value={totalAffected.toLocaleString()} icon={<Users />} trend="+12%" />
          <StatCard title="Avg Response Time" value="14.2m" icon={<Activity />} trend="-2.4m" />
          <StatCard title="Shelter Utilization" value={`${shelterStats.utilization}%`} icon={<Shield />} trend="+5%" />
          <StatCard title="Active Incidents" value={incidents.filter(i => i.status === 'ACTIVE').length.toString()} icon={<AlertTriangle size={18} />} trend="+3" />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6">INCIDENTS BY SEVERITY[cite: 6]</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#131924', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6 flex items-center gap-2"><MapPin size={12} /> INCIDENTS BY DISTRICT[cite: 6]</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#131924', border: 'none' }} />
                  <Bar dataKey="incidents" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
          <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6 flex items-center gap-2"><TrendingUp size={12} /> 7-DAY DISASTER TREND[cite: 6]</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#131924', border: 'none' }} />
                <Line type="monotone" dataKey="floods" stroke="#3b82f6" strokeWidth={3} name="Floods" />
                <Line type="monotone" dataKey="landslides" stroke="#f97316" strokeWidth={3} name="Landslides" />
                <Line type="monotone" dataKey="droughts" stroke="#eab308" strokeWidth={3} name="Droughts" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string; value: string; icon: React.ReactNode; trend: string }) {
  const isPositive = trend.startsWith('+');
  return (
    <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{title}</span>
        <div className="text-slate-500">{icon}</div>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}