'use client';

import { useState } from 'react';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronRight,
  Flag, Package, ShieldAlert, Truck, Zap,
} from 'lucide-react';

interface ResourcePlanViewProps {
  plan: any;
}

const RESOURCE_LABELS: Record<string, string> = {
  food_stock_tons: 'Food Stock',
  ambulance_count: 'Ambulances',
  hospital_bed_capacity: 'Hospital Beds',
  emergency_shelters: 'Shelters',
  clean_water_capacity_liters: 'Clean Water',
  power_grid_resilience: 'Power Grid',
};

const RISK_STYLES: Record<string, string> = {
  Severe: 'bg-red-500/10 text-red-400 border-red-500/30',
  Moderate: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export default function ResourcePlanView({ plan }: ResourcePlanViewProps) {
  const data = plan.plan_json?.allocation_plan ?? plan.plan_json ?? plan.plan_data?.allocation_plan ?? plan.plan_data;
  const [activeSection, setActiveSection] = useState<string>('summary');
  const [expandedTier1, setExpandedTier1] = useState<string | null>(null);

  if (!data) return (
    <div className="text-center py-12 text-slate-500">Plan data unavailable.</div>
  );

  const tier1 = data.tier1_immediate ?? [];
  const tier2 = data.tier2_monitoring ?? [];
  const tier3Surplus = (data.tier3_stable ?? []).filter((d: any) => d.surplus_resources?.length > 0);
  const reallocation = data.reallocation_plan ?? [];
  const flags = data.escalation_flags ?? [];
  const directives = data.administrative_directives ?? [];
  const summary = data.executive_summary ?? {};

  const tabs = [
    { id: 'summary', label: 'Summary', count: null },
    { id: 'tier1', label: 'Immediate', count: tier1.length },
    { id: 'tier2', label: 'Monitoring', count: tier2.length },
    { id: 'reallocation', label: 'Reallocation', count: reallocation.length },
    { id: 'flags', label: 'Escalations', count: flags.length },
    { id: 'surplus', label: 'Surplus', count: tier3Surplus.length },
  ];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<ShieldAlert size={14} className="text-red-400" />} label="Immediate" value={tier1.length} color="red" />
        <StatCard icon={<AlertTriangle size={14} className="text-orange-400" />} label="Monitoring" value={tier2.length} color="orange" />
        <StatCard icon={<Truck size={14} className="text-blue-400" />} label="Reallocations" value={reallocation.length} color="blue" />
        <StatCard icon={<Flag size={14} className="text-yellow-400" />} label="Escalations" value={flags.length} color="yellow" />
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-[#0a0f16] border border-slate-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeSection === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                activeSection === tab.id ? 'bg-white/20' : 'bg-slate-700 text-slate-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Summary ───────────────────────────────────────────── */}
      {activeSection === 'summary' && (
        <div className="space-y-4">
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-3">Situation Overview</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{summary.situation_overview}</p>
          </div>
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-3">Top Priorities</h3>
            <ol className="space-y-2">
              {(summary.top_priorities ?? []).map((p: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300">
                  <span className="text-red-400 font-bold shrink-0">{i + 1}.</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </div>
          {directives.length > 0 && (
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
              <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-3">Administrative Directives</h3>
              <div className="space-y-3">
                {directives.map((d: any, i: number) => (
                  <div key={i} className="border-l-2 border-blue-500/40 pl-4">
                    <p className="text-xs font-bold text-blue-300 mb-1">{d.directive}</p>
                    <p className="text-xs text-slate-400">{d.application}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tier 1: Immediate ─────────────────────────────────── */}
      {activeSection === 'tier1' && (
        <div className="space-y-3">
          {tier1.map((div: any) => (
            <div key={div.division} className="bg-[#131924] border border-red-500/20 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedTier1(expandedTier1 === div.division ? null : div.division)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <div className="flex items-center gap-3">
                  <ShieldAlert size={16} className="text-red-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-slate-100">{div.division}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {div.resource_gaps?.length ?? 0} critical gaps · {div.deployments?.length ?? 0} deployments
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${RISK_STYLES[div.risk_level] ?? RISK_STYLES.Severe}`}>
                    {div.risk_level}
                  </span>
                  {expandedTier1 === div.division ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                </div>
              </button>

              {expandedTier1 === div.division && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-800/60">
                  {div.resource_gaps?.length > 0 && (
                    <div className="pt-4">
                      <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-2">Resource Gaps</p>
                      <div className="grid grid-cols-2 gap-2">
                        {div.resource_gaps.map((gap: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                            <span className="text-xs text-slate-300">{RESOURCE_LABELS[gap.resource] ?? gap.resource}</span>
                            <span className="text-[10px] font-bold text-red-400 uppercase">{gap.assessment}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {div.deployments?.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-2">Planned Deployments</p>
                      <div className="space-y-2">
                        {div.deployments.map((dep: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2.5">
                            <Truck size={12} className="text-blue-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-slate-200">
                                {dep.quantity} of {RESOURCE_LABELS[dep.resource] ?? dep.resource}
                                <span className="text-slate-500"> from </span>
                                {dep.from_division}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{dep.rationale}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tier 2: Monitoring ────────────────────────────────── */}
      {activeSection === 'tier2' && (
        <div className="space-y-3">
          {tier2.map((div: any) => (
            <div key={div.division} className="bg-[#131924] border border-orange-500/15 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-200">{div.division}</p>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${RISK_STYLES[div.risk_level] ?? RISK_STYLES.Moderate}`}>
                  {div.risk_level}
                </span>
              </div>
              <ul className="space-y-1.5">
                {(div.recommended_actions ?? []).map((action: string, i: number) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-400">
                    <ChevronRight size={12} className="text-orange-400 shrink-0 mt-0.5" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ── Reallocation Plan ─────────────────────────────────── */}
      {activeSection === 'reallocation' && (
        <div className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0a0f16]/50 text-[9px] font-bold text-slate-500 tracking-widest uppercase">
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {reallocation.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold text-slate-300">{r.from_division}</td>
                  <td className="px-2 py-3"><ArrowRight size={12} className="text-blue-400" /></td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-300">{r.to_division}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{RESOURCE_LABELS[r.resource] ?? r.resource}</td>
                  <td className="px-4 py-3 text-xs font-bold text-blue-300">{r.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Escalation Flags ──────────────────────────────────── */}
      {activeSection === 'flags' && (
        <div className="space-y-3">
          {flags.map((flag: any, i: number) => (
            <div key={i} className="bg-[#131924] border border-yellow-500/20 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-2">
                <Zap size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-slate-200">{flag.division}</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 uppercase">
                      {flag.level}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-1">
                    <span className="text-slate-300 font-semibold">{RESOURCE_LABELS[flag.resource] ?? flag.resource}: </span>
                    {flag.reason}
                  </p>
                  <p className="text-xs text-blue-300">→ {flag.recommended_action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Surplus Resources ─────────────────────────────────── */}
      {activeSection === 'surplus' && (
        <div className="space-y-3">
          {tier3Surplus.map((div: any) => (
            <div key={div.division} className="bg-[#131924] border border-green-500/15 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-green-400" />
                <p className="text-sm font-bold text-slate-200">{div.division}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {div.surplus_resources.map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-300">{RESOURCE_LABELS[s.resource] ?? s.resource}</span>
                    <span className="text-xs font-bold text-green-400">{s.transferable_quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    red: 'border-red-500/20 bg-red-500/5',
    orange: 'border-orange-500/20 bg-orange-500/5',
    blue: 'border-blue-500/20 bg-blue-500/5',
    yellow: 'border-yellow-500/20 bg-yellow-500/5',
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span></div>
      <span className="text-3xl font-bold text-slate-100">{value}</span>
    </div>
  );
}
