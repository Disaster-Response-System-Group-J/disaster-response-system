'use client';

import Link from 'next/link';
import { Shield, ArrowLeft, Phone, Clock } from 'lucide-react';
import { MOCK_EMERGENCY_CONTACTS } from '@/data/mock-data';

const CAT_COLORS: Record<string, string> = {
  Emergency: 'bg-red-500/10 text-red-400 border-red-500/20',
  Disaster: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Medical: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Relief: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Weather: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Rescue: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

export default function EmergencyContactsPage() {
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
          <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
            <Phone size={20} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Emergency Contacts</h1>
            <p className="text-xs text-slate-400">Important hotlines and rescue service numbers.</p>
          </div>
        </div>

        {/* Priority Contacts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {MOCK_EMERGENCY_CONTACTS.filter(c => c.category === 'Emergency' || c.number === '117' || c.number === '1990').map(c => (
            <div key={c.id} className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 text-center">
              <h3 className="text-sm font-bold text-white mb-2">{c.name}</h3>
              <p className="text-3xl font-bold text-red-400 mb-2">{c.number}</p>
              {c.description && <p className="text-[10px] text-slate-400">{c.description}</p>}
              {c.available24x7 && (
                <div className="flex items-center justify-center gap-1 mt-3 text-[9px] font-bold text-green-400 tracking-widest">
                  <Clock size={10} /> 24/7
                </div>
              )}
            </div>
          ))}
        </div>

        {/* All Contacts */}
        <div className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/80 text-[9px] font-bold text-slate-500 tracking-widest uppercase">
                <th className="px-6 py-4">SERVICE</th>
                <th className="px-6 py-4">NUMBER</th>
                <th className="px-6 py-4">CATEGORY</th>
                <th className="px-6 py-4">AVAILABILITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {MOCK_EMERGENCY_CONTACTS.map(c => (
                <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-200">{c.name}</p>
                    {c.description && <p className="text-[10px] text-slate-500 mt-0.5">{c.description}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-400">{c.number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[9px] font-bold tracking-widest border ${CAT_COLORS[c.category] ?? 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                      {c.category.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {c.available24x7 ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-400"><Clock size={10} /> 24/7</span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Business hours</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
