"use client";

import { Printer, Download, Clock, Truck, Users, TrendingUp, ExternalLink } from "lucide-react";

export default function Analytics() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold mb-1">Situation Summary</h1>
            <p className="text-[11px] font-bold text-slate-500 tracking-widest uppercase">
              LIVE OPERATIONS DATA • LAST 30 DAYS
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#131924] hover:bg-slate-800 border border-slate-700/50 rounded-lg text-xs font-semibold transition-colors">
              <Printer size={14} className="text-slate-400" />
              Print Report
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-100 hover:bg-white text-blue-900 rounded-lg text-xs font-bold transition-colors">
              <Download size={14} />
              Export PDF
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Card 1 */}
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase w-32 leading-relaxed">AVERAGE RESPONSE TIME</span>
              <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
                <Clock size={14} className="text-slate-300" />
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <h3 className="text-5xl font-bold tracking-tight">14</h3>
              <span className="text-sm text-slate-400 font-medium">min</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-400">
              <TrendingUp size={12} />
              <span>+2.4% vs last week</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase w-32 leading-relaxed">TOTAL RELIEF DISPATCHED</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Truck size={14} className="text-emerald-400" />
              </div>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <h3 className="text-5xl font-bold tracking-tight">84.2</h3>
              <span className="text-sm text-slate-400 font-medium">tons</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400">
              <TrendingUp size={12} />
              <span>+15% vs last week</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full"></div>
            <div className="flex items-start justify-between mb-4">
              <span className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">TOTAL RESCUED</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Users size={14} className="text-blue-400" />
              </div>
            </div>
            <h3 className="text-5xl font-bold tracking-tight text-blue-50 mb-3">1,248</h3>
            <p className="text-[11px] font-medium text-slate-400">Across 14 districts</p>
          </div>
        </div>

        {/* Charts Grid - Middle Row */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Rainfall vs Incident Frequency */}
          <div className="col-span-2 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-[10px] font-bold text-white tracking-widest uppercase mb-1">RAINFALL VS. INCIDENT FREQUENCY</h2>
                <p className="text-[11px] text-slate-500">30 Day Historical Overlay</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]"></span>
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">INCIDENTS</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]"></span>
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">RAINFALL (MM)</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 bg-[#0a0f16]/50 rounded-lg relative overflow-hidden border border-slate-800/50 mt-2 min-h-[200px]">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between py-6">
                <div className="border-b border-slate-800/30 w-full"></div>
                <div className="border-b border-slate-800/30 w-full"></div>
                <div className="border-b border-slate-800/30 w-full"></div>
              </div>
              
              {/* Chart Visualization */}
              <svg viewBox="0 0 400 150" className="w-full h-full absolute inset-0 preserve-3d" preserveAspectRatio="none">
                {/* Teal Area & Line */}
                <path d="M0,120 L40,110 L80,130 L120,90 L160,110 L200,80 L240,120 L280,100 L320,135 L360,115 L400,90 L400,150 L0,150 Z" fill="rgba(45,212,191,0.05)" />
                <polyline points="0,120 40,110 80,130 120,90 160,110 200,80 240,120 280,100 320,135 360,115 400,90" fill="none" stroke="#2dd4bf" strokeWidth="1.5" />
                <circle cx="120" cy="90" r="2.5" fill="#2dd4bf" />
                <circle cx="200" cy="80" r="2.5" fill="#2dd4bf" />
                <circle cx="280" cy="100" r="2.5" fill="#2dd4bf" />

                {/* Indigo Area & Line */}
                <path d="M0,135 L40,125 L80,145 L120,105 L160,125 L200,95 L240,135 L280,115 L320,150 L360,130 L400,105 L400,150 L0,150 Z" fill="rgba(129,140,248,0.1)" />
                <polyline points="0,135 40,125 80,145 120,105 160,125 200,95 240,135 280,115 320,150 360,130 400,105" fill="none" stroke="#818cf8" strokeWidth="2" />
                <circle cx="120" cy="105" r="3" fill="#818cf8" />
                <circle cx="200" cy="95" r="3" fill="#818cf8" />
                <circle cx="280" cy="115" r="3" fill="#818cf8" />
              </svg>

              {/* X Axis Labels */}
              <div className="absolute bottom-2 w-full flex justify-between px-6">
                <span className="text-[9px] font-bold text-slate-600 tracking-widest">01 OCT</span>
                <span className="text-[9px] font-bold text-slate-600 tracking-widest">08 OCT</span>
                <span className="text-[9px] font-bold text-slate-600 tracking-widest">15 OCT</span>
                <span className="text-[9px] font-bold text-slate-600 tracking-widest">22 OCT</span>
                <span className="text-[9px] font-bold text-slate-600 tracking-widest">30 OCT</span>
              </div>
            </div>
          </div>

          {/* Incident Severity */}
          <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col">
            <h2 className="text-[10px] font-bold text-white tracking-widest uppercase mb-6">INCIDENT SEVERITY</h2>
            
            <div className="flex-1 flex flex-col justify-center items-center relative mb-6">
              {/* Abstract overlay from original mockup */}
              <div className="absolute inset-0 pointer-events-none flex justify-center items-center opacity-80 z-10">
                <div className="w-[120px] h-[120px] relative">
                  <div className="absolute top-0 right-0 w-20 h-2 bg-red-400 rotate-45 transform origin-top-right"></div>
                  <div className="absolute top-2 right-4 w-24 h-2 bg-teal-300 rotate-[65deg] transform origin-top-right"></div>
                </div>
              </div>

              {/* Donut Chart Simulation */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                {/* SVG Donut */}
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#1e293b" strokeWidth="12" />
                  {/* Minor 34% (Purple) */}
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#818cf8" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * 0.34)} />
                  {/* Moderate 42% (Teal) */}
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#2dd4bf" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * 0.42)} strokeDashoffset-start={251.2 * 0.34} className="rotate-[122deg] origin-center" />
                  {/* Critical 24% (Red) */}
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ef4444" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * 0.24)} className="rotate-[273deg] origin-center" />
                </svg>

                <div className="absolute inset-0 flex flex-col justify-center items-center z-0 bg-[#131924] m-[14px] rounded-full">
                  <span className="text-3xl font-bold text-white">342</span>
                  <span className="text-[8px] font-bold text-slate-500 tracking-widest uppercase mt-0.5">TOTAL ACTIVE</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <SeverityLegend label="CRITICAL" percent="24%" dotColor="bg-red-400" />
              <SeverityLegend label="MODERATE" percent="42%" dotColor="bg-teal-400" />
              <SeverityLegend label="MINOR" percent="34%" dotColor="bg-indigo-400" />
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-6">
          {/* Incidents by District (Bar Chart) */}
          <div className="col-span-2 bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <h2 className="text-[10px] font-bold text-white tracking-widest uppercase mb-10">INCIDENTS BY DISTRICT</h2>
            
            <div className="h-48 flex items-end justify-between px-8 relative pb-6 border-b border-slate-800/50">
              <BarItem label="COL" value={45} max={200} />
              <BarItem label="GAM" value={60} max={200} />
              <BarItem label="RAT" value={185} max={200} active valueDisplay="185" />
              <BarItem label="KAL" value={40} max={200} />
              <BarItem label="GAL" value={30} max={200} />
              <BarItem label="MAT" value={25} max={200} />
              <BarItem label="KAG" value={15} max={200} />
            </div>
          </div>

          {/* Vulnerability Index */}
          <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold text-white tracking-widest uppercase">VULNERABILITY INDEX</h2>
              <ExternalLink size={14} className="text-slate-500 hover:text-white cursor-pointer transition-colors" />
            </div>

            <div className="grid grid-cols-[30px_1fr_40px] gap-4 mb-3 px-2">
              <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">RNK</span>
              <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">AREA / DIVISION</span>
              <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase text-right leading-tight">RISK<br/>SCORE</span>
            </div>

            <div className="space-y-2 flex-1">
              <VulnerabilityRow rank="01" area="Ratnapura Town" riskType="FLOOD WARNING" score="9.8" isHighest />
              <VulnerabilityRow rank="02" area="Bulathsinhala" riskType="LANDSLIDE RISK" score="8.5" />
              <VulnerabilityRow rank="03" area="Kaduwela" riskType="RIVER OVERFLOW" score="7.9" />
              <VulnerabilityRow rank="04" area="Gampaha MC" riskType="FLASH FLOODS" score="7.2" />
              <VulnerabilityRow rank="05" area="Agalawatta" riskType="LANDSLIDE RISK" score="6.8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents

function SeverityLegend({ label, percent, dotColor }: { label: string; percent: string; dotColor: string }) {
  return (
    <div className="bg-[#0a0f16]/50 border border-slate-800/50 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shadow-[0_0_8px_currentColor] opacity-90`}></span>
        <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">{label}</span>
      </div>
      <span className="text-xs font-bold text-slate-200">{percent}</span>
    </div>
  );
}

function BarItem({ label, value, max, active, valueDisplay }: { label: string; value: number; max: number; active?: boolean; valueDisplay?: string }) {
  const heightPercent = Math.max((value / max) * 100, 5); // min 5% height
  
  return (
    <div className="flex flex-col items-center justify-end h-full w-8 group relative">
      {active && valueDisplay && (
        <span className="absolute -top-6 text-[10px] font-bold text-blue-300 tracking-widest">
          {valueDisplay}
        </span>
      )}
      <div 
        className={`w-full rounded-t-sm transition-all duration-500 ${active ? 'bg-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.4)]' : 'bg-slate-800/40 group-hover:bg-slate-700/50'}`}
        style={{ height: `${heightPercent}%` }}
      ></div>
      <span className={`absolute -bottom-6 text-[9px] font-bold tracking-widest uppercase ${active ? 'text-white' : 'text-slate-600'}`}>
        {label}
      </span>
    </div>
  );
}

function VulnerabilityRow({ rank, area, riskType, score, isHighest }: { rank: string; area: string; riskType: string; score: string; isHighest?: boolean }) {
  return (
    <div className={`grid grid-cols-[30px_1fr_40px] gap-4 items-center p-3 rounded-lg border ${isHighest ? 'bg-red-900/10 border-red-900/40' : 'bg-[#0a0f16]/30 border-transparent hover:bg-[#0a0f16]/80 transition-colors'}`}>
      <span className={`text-[11px] font-bold ${isHighest ? 'text-red-400' : 'text-slate-500'}`}>{rank}</span>
      <div>
        <h4 className="text-xs font-bold text-slate-200 mb-0.5">{area}</h4>
        <p className={`text-[8px] font-bold tracking-widest uppercase ${isHighest ? 'text-red-400/80' : 'text-slate-500'}`}>{riskType}</p>
      </div>
      <span className={`text-right text-xs font-bold ${isHighest ? 'text-red-400' : 'text-slate-300'}`}>{score}</span>
    </div>
  );
}