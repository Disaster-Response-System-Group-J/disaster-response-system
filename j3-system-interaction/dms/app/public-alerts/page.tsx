'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';
import Link from 'next/link';
import { Shield, AlertTriangle, ArrowLeft, Waves, Mountain, Clock, MapPin } from 'lucide-react';
import { IncidentSeverity } from '@/types';

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 border-red-500/30 text-red-400',
  HIGH: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  MEDIUM: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  LOW: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

export default function PublicAlertsPage() {
  const socket = useSocket();
  const [publicAlerts, setPublicAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/alerts');
        if (!response.ok) throw new Error('Failed to fetch alerts');
        const data = await response.json();
        // The API returns only ACTIVE alerts, we just need to filter for public ones
        setPublicAlerts(data.filter((a: any) => a.isPublic));
      } catch (err) {
        console.error('Error fetching alerts:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (newAlert: any) => {
      if (newAlert.isPublic) {
        setPublicAlerts(prev => [newAlert, ...prev]);
      }
    };

    socket.on('dashboard:risk-alert', handleNewAlert);

    return () => {
      socket.off('dashboard:risk-alert', handleNewAlert);
    };
  }, [socket]);

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white font-sans">
      <header className="border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Shield size={24} className="text-blue-400 fill-blue-400" />
            <span className="text-sm font-bold tracking-wide">DMC SRI LANKA</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Public Alerts</h1>
            <p className="text-xs text-slate-400">Verified alerts from disaster management authorities.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : publicAlerts.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <AlertTriangle size={32} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium">No active public alerts at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {publicAlerts.map(alert => (
              <div key={alert.alertId} className={`bg-[#131924] border rounded-xl p-6 ${alert.severity === IncidentSeverity.CRITICAL ? 'border-red-500/30' : 'border-slate-800/80'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${alert.severity === IncidentSeverity.CRITICAL ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                      {alert.title.toLowerCase().includes('flood') || alert.title.toLowerCase().includes('rain') ?
                        <Waves size={18} className={alert.severity === IncidentSeverity.CRITICAL ? 'text-red-400' : 'text-blue-400'} /> :
                        <Mountain size={18} className="text-orange-400" />
                      }
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{alert.title}</h3>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><MapPin size={10} /> {alert.district}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${SEVERITY_STYLES[alert.severity]}`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{alert.description}</p>
                {alert.source && <p className="text-[10px] text-slate-500 mt-3">Source: {alert.source}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
