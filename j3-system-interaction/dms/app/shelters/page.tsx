'use client';

import Link from 'next/link';
import { Shield, ArrowLeft, Home, Users, MapPin, Phone } from 'lucide-react';
import { MOCK_SHELTERS } from '@/data/mock-data';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-green-500/10 text-green-400 border-green-500/20',
  FULL: 'bg-red-500/10 text-red-400 border-red-500/20',
  CLOSED: 'bg-slate-800 text-slate-400 border-slate-700',
};

export default function SheltersPage() {
  return (
    <div className="min-h-screen bg-[#0a0f16] text-white font-sans">
      <header className="border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Shield size={24} className="text-blue-400 fill-blue-400" />
            <span className="text-sm font-bold tracking-wide">DMC SRI LANKA</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"><ArrowLeft size={14} /> Back</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center border border-teal-500/20">
            <Home size={20} className="text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Emergency Shelters</h1>
            <p className="text-xs text-slate-400">Active shelters with real-time capacity information.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_SHELTERS.map(s => {
            const pct = Math.min((s.currentOccupancy / s.capacity) * 100, 100);
            return (
              <div key={s.shelterId} className={`bg-[#131924] border rounded-xl p-6 ${s.status === 'FULL' ? 'border-red-500/30' : 'border-slate-800/80'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">{s.name}</h3>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin size={10} /> {s.district} — {s.address}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-[8px] font-bold tracking-widest border ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-[10px] font-bold mb-2">
                    <span className="text-slate-400">Occupancy</span>
                    <span className={pct > 90 ? 'text-red-400' : 'text-white'}>
                      {s.currentOccupancy} <span className="text-slate-500">/ {s.capacity}</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-orange-400' : 'bg-teal-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {s.facilities.map(f => (
                    <span key={f} className="px-2 py-0.5 bg-[#0a0f16] border border-slate-800 rounded text-[9px] font-bold text-slate-400 tracking-wider">{f}</span>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Phone size={12} /> <span>{s.contactNumber}</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
