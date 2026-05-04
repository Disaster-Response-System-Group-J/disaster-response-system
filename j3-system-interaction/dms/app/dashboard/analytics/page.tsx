'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Shield, TrendingUp, Users, Activity, MapPin } from 'lucide-react';
import { MOCK_DASHBOARD_SUMMARY, MOCK_CONFIRMED_INCIDENTS } from '@/data/mock-data';
import { DISTRICT_NAMES } from '@/data/districts';
import { IncidentSeverity } from '@/types';

// Process mock data for charts
const severityData = Object.values(IncidentSeverity).map(sev => ({
  name: sev,
  value: MOCK_CONFIRMED_INCIDENTS.filter(i => i.severity === sev).length
}));

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
};

const districtData = DISTRICT_NAMES
  .map(d => ({
    name: d,
    incidents: MOCK_CONFIRMED_INCIDENTS.filter(i => i.district === d).length
  }))
  .filter(d => d.incidents > 0)
  .sort((a, b) => b.incidents - a.incidents);

const trendData = [
  { day: 'Mon', floods: 2, landslides: 0 },
  { day: 'Tue', floods: 3, landslides: 1 },
  { day: 'Wed', floods: 5, landslides: 1 },
  { day: 'Thu', floods: 4, landslides: 2 },
  { day: 'Fri', floods: 6, landslides: 2 },
  { day: 'Sat', floods: 8, landslides: 3 },
  { day: 'Sun', floods: 5, landslides: 2 },
];

export default function AnalyticsPage() {
  const data = MOCK_DASHBOARD_SUMMARY;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Analytics & Reporting</h1>
            <p className="text-sm text-slate-400">Data-driven insights for disaster response coordination.</p>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Affected" value={data.peopleAffected.toLocaleString()} icon={<Users />} trend={`+${data.peopleAffectedChange}%`} />
          <StatCard title="Avg Response Time" value="14.2m" icon={<Activity />} trend="-2.4m" />
          <StatCard title="Shelter Utilization" value="84%" icon={<Shield />} trend="+5%" />
          <StatCard title="Active Incidents" value={data.activeIncidents.toString()} icon={<AlertTriangle />} trend={`+${data.activeIncidentsChange}`} />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Incidents by Severity */}
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6">INCIDENTS BY SEVERITY</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#131924', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4 text-[10px] font-bold text-slate-400">
              {severityData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[d.name as keyof typeof SEVERITY_COLORS] }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </div>

          {/* Incidents by District */}
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6 flex items-center gap-2"><MapPin size={12} /> INCIDENTS BY DISTRICT</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: '#1e293b' }}
                    contentStyle={{ backgroundColor: '#131924', borderColor: '#1e293b', borderRadius: '8px' }}
                  />
                  <Bar dataKey="incidents" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 7-Day Trend */}
        <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
          <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6 flex items-center gap-2"><TrendingUp size={12} /> 7-DAY DISASTER TREND</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#131924', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="floods" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} name="Floods" />
                <Line type="monotone" dataKey="landslides" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316' }} name="Landslides" />
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
// Using generic lucide icon wrapper for the Alert icon to prevent conflicts
function AlertTriangle() { return <TrendingUp />; } // Placeholder just for the stat card
