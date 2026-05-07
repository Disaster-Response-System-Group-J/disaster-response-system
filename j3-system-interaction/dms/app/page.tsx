'use client';

import Link from 'next/link';
import { Shield, Home, Phone, ArrowRight, Waves, Mountain } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0f16] text-white font-sans">
      {/* Header */}
      <header className="border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-blue-400 fill-blue-400" />
            <span className="text-sm font-bold tracking-wide">DMC SRI LANKA</span>
          </div>
          <nav className="flex items-center gap-3 sm:gap-6">
            <Link href="/public-alerts" className="hidden sm:block text-xs font-semibold text-slate-400 hover:text-white transition-colors tracking-wider uppercase">Alerts</Link>
            <Link href="/shelters" className="hidden sm:block text-xs font-semibold text-slate-400 hover:text-white transition-colors tracking-wider uppercase">Shelters</Link>
            <Link href="/emergency-contacts" className="hidden sm:block text-xs font-semibold text-slate-400 hover:text-white transition-colors tracking-wider uppercase">Emergency</Link>
            <Link href="/login" className="px-3 sm:px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs font-bold text-blue-400 transition-all whitespace-nowrap">
              Official Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20 lg:py-32 relative">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="text-[10px] font-bold text-red-400 tracking-widest uppercase">ACTIVE DISASTER RESPONSE</span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Sri Lanka Disaster<br />Response System
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-xl">
              Real-time flood and landslide monitoring and emergency coordination platform for authorized response personnel. Find shelters, emergency contacts, and stay informed on active alerts.
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Link href="/login"
                className="flex items-center gap-2 px-6 py-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-sm font-bold text-blue-400 transition-all group">
                Official Login
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/public-alerts"
                className="flex items-center gap-2 px-6 py-4 bg-[#131924] hover:bg-slate-800 border border-slate-700/50 rounded-xl text-sm font-bold text-slate-300 transition-all">
                View Active Alerts
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <QuickCard href="/public-alerts" icon={<Waves size={24} />} iconBg="bg-blue-500/10 border-blue-500/20" iconColor="text-blue-400"
            title="Public Alerts" desc="View verified flood and landslide warnings across Sri Lanka." />
          <QuickCard href="/shelters" icon={<Home size={24} />} iconBg="bg-teal-500/10 border-teal-500/20" iconColor="text-teal-400"
            title="Find Shelters" desc="Locate emergency shelters with real-time capacity status." />
          <QuickCard href="/emergency-contacts" icon={<Phone size={24} />} iconBg="bg-indigo-500/10 border-indigo-500/20" iconColor="text-indigo-400"
            title="Emergency Contacts" desc="Quick access to emergency hotlines and rescue services." />
        </div>

        {/* Disaster Focus */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#131924] border border-blue-500/20 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                <Waves size={24} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Flood Response</h3>
                <p className="text-xs text-slate-400">Kelani, Kalu Ganga, Nilwala basins</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">Monitoring major river basins during SW monsoon season. Real-time water level tracking and evacuation coordination.</p>
          </div>
          <div className="bg-[#131924] border border-orange-500/20 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
                <Mountain size={24} className="text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Landslide Monitoring</h3>
                <p className="text-xs text-slate-400">Central Highlands & Sabaragamuwa</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">Active monitoring of high-risk hillside areas. Early warning systems and soil stability assessment in progress.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-slate-600" />
            <span>Disaster Management Centre — Sri Lanka</span>
          </div>
          <span>System v4.2.1 • Group J3</span>
        </div>
      </footer>
    </div>
  );
}

function QuickCard({ href, icon, iconBg, iconColor, title, desc }: {
  href: string; icon: React.ReactNode; iconBg: string; iconColor: string; title: string; desc: string;
}) {
  return (
    <Link href={href} className="bg-[#131924] border border-slate-800/80 hover:border-slate-700 rounded-xl p-6 transition-all group hover:shadow-lg hover:shadow-black/20">
      <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center border mb-4 ${iconColor}`}>{icon}</div>
      <h3 className="text-base font-bold mb-2 group-hover:text-blue-400 transition-colors">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </Link>
  );
}