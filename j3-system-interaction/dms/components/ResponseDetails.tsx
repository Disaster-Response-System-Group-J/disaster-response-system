// components/ResponseDetails.tsx
"use client";

import { 
  AlertTriangle, 
  MapPin, 
  CheckCircle2, 
  Users, 
  Waves, 
  CloudRain, 
  Video, 
  Plus, 
  Ship, 
  PlusSquare, 
  UploadCloud 
} from "lucide-react";

export default function ResponseDetails() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        
        {/* Header Section */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 bg-red-500/10 text-red-400 text-[10px] font-bold tracking-widest uppercase rounded border border-red-500/20">
                CRITICAL SEVERITY
              </span>
              <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">
                ID: FL-RAT-094
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Severe Flooding in Ratnapura</h1>
            <div className="flex items-center gap-2 text-slate-400">
              <MapPin size={14} className="text-slate-500" />
              <span className="text-xs font-semibold">Ratnapura District, Sabaragamuwa Province</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-transparent border border-slate-700 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
              <CheckCircle2 size={16} className="text-slate-400" />
              Mark Resolved
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg text-xs font-bold transition-colors">
              <AlertTriangle size={16} />
              Escalate
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Population */}
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">ESTIMATED AFFECTED POPULATION</p>
            </div>
            <div className="flex items-baseline gap-3">
              <h3 className="text-5xl font-bold tracking-tight text-blue-50">12,450</h3>
              <span className="text-xs font-semibold text-slate-400">+15% since last hour</span>
            </div>
          </div>

          {/* Primary Hazard */}
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
              <Waves size={120} />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">PRIMARY HAZARD</p>
            </div>
            <h3 className="text-3xl font-bold mb-1">Flash Flood</h3>
            <p className="text-xs font-bold text-red-400 tracking-wide">Level 4 Warning</p>
          </div>

          {/* Weather */}
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CloudRain size={14} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">LOCAL WEATHER OUTLOOK</p>
            </div>
            <h3 className="text-2xl font-bold mb-3">Heavy Rain <span className="text-teal-400">145mm</span></h3>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
              <div className="bg-teal-400 h-full rounded-full" style={{ width: '95%' }}></div>
            </div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Precipitation probability: 95%</p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-3 gap-8">
          
          {/* Left Column (Timeline & Units) */}
          <div className="col-span-2 space-y-8">
            
            {/* Timeline */}
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-8">
              <h2 className="text-base font-bold mb-8">Operational Timeline</h2>
              <div className="space-y-6">
                <TimelineItem
                  time="08:45 AM - TODAY"
                  title="Initial Report Logged"
                  description="Multiple civilian reports via 119 emergency hotline regarding rapid water level rise in Kalu Ganga."
                  status="completed"
                />
                <TimelineItem
                  time="09:15 AM - TODAY"
                  title="Severity Evaluated"
                  description="Satellite imagery confirmed widespread inundation. Upgraded to Critical Severity (Level 4)."
                  status="completed"
                />
                <TimelineItem
                  time="10:30 AM - TODAY"
                  title="Response Teams Dispatched"
                  description="Navy swift water rescue units and local DMC coordinators deployed to sector alpha."
                  status="active"
                />
                <TimelineItem
                  time="PENDING"
                  title="Containment & Relief Ongoing"
                  description=""
                  status="pending"
                />
              </div>
            </div>

            {/* Deployed Units */}
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold">Deployed Units</h2>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded text-[10px] font-bold tracking-widest uppercase transition-colors">
                  <Plus size={12} /> Assign Unit
                </button>
              </div>

              <div className="space-y-3">
                <UnitRow 
                  name="SLN Rapid Rescue Unit 4" 
                  eta="ETA: On Site" 
                  status="ACTIVE SEARCH" 
                  statusColor="bg-teal-500/10 text-teal-400 border-teal-500/20"
                  icon={<Ship size={16} className="text-blue-400" />}
                  iconBg="bg-blue-500/20"
                />
                <UnitRow 
                  name="Medical Corps Detachment" 
                  eta="ETA: 15 mins" 
                  status="IN TRANSIT" 
                  statusColor="bg-slate-800 text-slate-300 border-slate-700"
                  icon={<PlusSquare size={16} className="text-slate-300" />}
                  iconBg="bg-slate-800"
                />
              </div>
            </div>

          </div>

          {/* Right Column (Media) */}
          <div className="col-span-1">
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-base font-bold mb-6">Field Reports & Media</h2>
              
              <div className="space-y-4">
                {/* Main Image */}
                <div className="relative rounded-lg overflow-hidden border border-slate-700 group cursor-pointer">
                  <img 
                    src="https://unsplash.com/photos/flood-in-rio-grande-do-sul-animal-rescue-in-the-city-of-novo-hamburgo-many-dead-animals-and-people-left-behind-8KaCHW9waFw" 
                    alt="Flood Aerial View" 
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs font-semibold text-white">
                    <Video size={14} /> Drone Feed_01
                  </div>
                </div>

                {/* Grid Thumbnails */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative rounded-lg overflow-hidden border border-slate-700 group cursor-pointer h-24">
                    <img 
                      src="https://unsplash.com/photos/flood-in-rio-grande-do-sul-animal-rescue-in-the-city-of-novo-hamburgo-many-dead-animals-and-people-left-behind-8KaCHW9waFw" 
                      alt="Water level" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  
                  {/* Upload Box */}
                  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 flex flex-col items-center justify-center cursor-pointer transition-colors h-24">
                    <UploadCloud size={18} className="text-slate-400 mb-2" />
                    <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">UPLOAD INTEL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Subcomponents

function TimelineItem({ time, title, description, status }: { time: string; title: string; description: string; status: 'completed' | 'active' | 'pending' }) {
  return (
    <div className="flex gap-6 relative group">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full flex items-center justify-center shrink-0 z-10 
          ${status === 'completed' ? 'bg-[#131924] border-[3px] border-slate-500' : 
            status === 'active' ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]' : 
            'bg-[#131924] border-[3px] border-slate-800'}`}
        ></div>
        <div className={`w-[2px] h-full mt-2 ${status === 'pending' ? 'bg-slate-800' : 'bg-slate-700'} group-last:hidden`}></div>
      </div>
      <div className={`pb-8 ${status === 'pending' ? 'opacity-50' : ''}`}>
        <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1.5">{time}</p>
        <p className={`text-sm font-bold mb-1.5 ${status === 'active' ? 'text-white' : 'text-slate-200'}`}>{title}</p>
        {description && <p className="text-xs text-slate-400 leading-relaxed max-w-xl">{description}</p>}
      </div>
    </div>
  );
}

function UnitRow({ name, eta, status, statusColor, icon, iconBg }: { name: string; eta: string; status: string; statusColor: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-[#0a0f16]/50 rounded-lg border border-slate-800/50 hover:bg-slate-800/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-200 mb-0.5">{name}</h4>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{eta}</p>
        </div>
      </div>
      <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${statusColor}`}>
        {status}
      </span>
    </div>
  );
}