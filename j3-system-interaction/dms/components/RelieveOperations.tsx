// components/RelieveOperations.tsx
"use client";

import { useState } from "react";
import { 
  Home, 
  Users, 
  AlertTriangle, 
  ChevronDown, 
  Maximize2, 
  Package, 
  Droplet, 
  Tent, 
  Map as MapIcon,
  Filter,
  ArrowDownUp
} from "lucide-react";
import Map, { Marker, ViewStateChangeEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export default function RelieveOperations() {
  const [viewState, setViewState] = useState({
    longitude: 80.2170, // Galle
    latitude: 6.0535,
    zoom: 12,
    pitch: 0,
    bearing: 0
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-1">OPERATIONAL MATRIX</p>
            <h1 className="text-3xl font-extrabold tracking-tight">SHELTER & RELIEF ALLOCATION</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-3 px-4 py-2.5 bg-[#131924] hover:bg-slate-800 border border-slate-700/50 rounded-lg text-xs font-semibold text-slate-300 transition-colors">
              <ListFilterIcon className="w-3.5 h-3.5 text-slate-500" />
              DISTRICT FILTER: <span className="text-white">GALLE</span>
              <ChevronDown size={14} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">ACTIVE SHELTERS</span>
              <Home size={14} className="text-blue-400" />
            </div>
            <div className="flex items-baseline gap-3">
              <h3 className="text-4xl font-bold tracking-tight text-white">142</h3>
              <span className="text-xs font-semibold text-slate-400">+12 in 24h</span>
            </div>
          </div>

          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-300"></div>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">TOTAL OCCUPANCY</span>
              <Users size={14} className="text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-3">
              <h3 className="text-4xl font-bold tracking-tight text-white">38.4k</h3>
              <span className="text-xs font-bold text-orange-400 flex items-center gap-1">
                <TrendingDownIcon className="w-3 h-3" /> ~18%
              </span>
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 relative">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-bold text-red-400/80 tracking-widest uppercase">REMAINING CAPACITY</span>
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <div className="flex items-baseline gap-3">
              <h3 className="text-4xl font-bold tracking-tight text-red-400">12%</h3>
              <span className="text-xs font-medium text-slate-400">Critical Threshold</span>
            </div>
          </div>
        </div>

        {/* Middle Grid: Map & Stock Matrix */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          
          {/* Map Area */}
          <div className="col-span-2 bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden relative flex flex-col min-h-[400px]">
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
              <span className="px-3 py-1.5 bg-[#0a0f16]/80 backdrop-blur border border-slate-800 rounded text-[10px] font-bold tracking-widest uppercase text-white">
                GALLE DISTRICT GRID
              </span>
            </div>
            <div className="absolute top-6 right-6 z-10 pointer-events-auto">
              <button className="p-2 bg-[#0a0f16]/80 backdrop-blur border border-slate-800 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <Maximize2 size={14} />
              </button>
            </div>

            <div className="flex-1 relative">
              <Map
                {...viewState}
                onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json"
                minZoom={10}
                maxZoom={16}
                interactive={false} // Disable interaction to match the "grid" feel
              >
                {/* Simulated Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

                {/* Markers */}
                <Marker longitude={80.21} latitude={6.06} anchor="center">
                  <div className="w-2.5 h-2.5 bg-blue-300 rounded-full shadow-[0_0_15px_rgba(147,197,253,0.8)]"></div>
                </Marker>
                
                <Marker longitude={80.20} latitude={6.04} anchor="center">
                  <div className="w-2.5 h-2.5 bg-blue-300 rounded-full shadow-[0_0_15px_rgba(147,197,253,0.8)]"></div>
                </Marker>

                <Marker longitude={80.225} latitude={6.05} anchor="center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-60"></div>
                    <div className="w-2.5 h-2.5 bg-red-400 rounded-full shadow-[0_0_15px_rgba(248,113,113,1)]"></div>
                  </div>
                </Marker>
              </Map>
            </div>

            {/* Critical Alerts Panel Overlay */}
            <div className="absolute bottom-6 right-6 z-10 w-72 bg-[#181f2c]/95 backdrop-blur-md border border-slate-700/60 rounded-xl p-4 shadow-2xl">
              <h4 className="flex items-center gap-2 text-[10px] font-bold text-red-400 tracking-widest uppercase mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                CRITICAL ALERTS (2)
              </h4>
              
              <div className="space-y-2">
                <div className="bg-[#0a0f16]/60 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-200 mb-0.5">Galle Central School</h5>
                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">OCCUPANCY: 115%</p>
                  </div>
                  <AlertTriangle size={14} className="text-red-400" />
                </div>
                
                <div className="bg-[#0a0f16]/60 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-200 mb-0.5">Karapitiya Temple</h5>
                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">SUPPLY: LOW MEDS</p>
                  </div>
                  <Package size={14} className="text-red-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Relief Stock Matrix */}
          <div className="col-span-1 bg-[#131924] border border-slate-800/80 rounded-xl p-6 flex flex-col">
            <h3 className="flex items-center gap-2 text-xs font-bold text-white mb-8">
              <Package size={16} className="text-slate-400" />
              RELIEF STOCK MATRIX
            </h3>

            <div className="space-y-8 flex-1">
              <StockItem 
                label="DRY RATIONS" 
                value="45,000 Pks" 
                percentage={75} 
                status="Est. 4 Days Remaining" 
                color="bg-indigo-400" 
              />
              <StockItem 
                label="POTABLE WATER" 
                value="120,000 L" 
                percentage={15} 
                status="Critical Replenishment Req." 
                color="bg-red-500" 
                isWarning 
              />
              <StockItem 
                label="BLANKETS/TENTS" 
                value="18,500 Units" 
                percentage={60} 
                status="Sufficient Status" 
                color="bg-indigo-400" 
              />
            </div>

            <button className="w-full py-3.5 bg-[#0a0f16] hover:bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-slate-300 transition-colors tracking-widest uppercase mt-6">
              DISPATCH REQUEST
            </button>
          </div>
        </div>

        {/* Bottom Section: Deployed Shelters */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-[11px] font-bold text-white tracking-widest uppercase">
              <MapIcon size={14} className="text-slate-500" />
              DEPLOYED SHELTERS (GALLE ZONE)
            </h3>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-[#131924] border border-slate-800 rounded text-[9px] font-bold text-slate-400 tracking-widest uppercase hover:text-white transition-colors">
                SORT: SEVERITY <ArrowDownUp size={10} />
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-[#131924] border border-slate-800 rounded text-[9px] font-bold text-slate-400 tracking-widest uppercase hover:text-white transition-colors">
                FILTER <Filter size={10} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <ShelterCard 
              name="Galle Central College"
              id="SH-GL-001 • Galle Fort"
              occupancy={1250}
              capacity={1000}
              status="OVER CAPACITY"
              statusColor="bg-red-500/20 text-red-400"
              barColor="bg-red-500"
              tags={[{ icon: <Package size={10}/>, label: "Med Unit", isWarning: false }, { icon: <AlertTriangle size={10}/>, label: "Low Rations", isWarning: true }]}
              isCritical
            />
            <ShelterCard 
              name="Karapitiya Base Camp"
              id="SH-GL-045 • Karapitiya"
              occupancy={640}
              capacity={800}
              status="ACTIVE"
              statusColor="bg-[#0a0f16] text-slate-300"
              barColor="bg-indigo-400"
              tags={[{ icon: <Package size={10}/>, label: "Med Unit", isWarning: false }, { icon: <Package size={10}/>, label: "Stable", isWarning: false }]}
            />
            <ShelterCard 
              name="Ruhunu University Hall"
              id="SH-MT-012 • Matara Border"
              occupancy={210}
              capacity={500}
              status="ACTIVE"
              statusColor="bg-[#0a0f16] text-slate-300"
              barColor="bg-indigo-400"
              tags={[{ icon: <Package size={10}/>, label: "No Med", isWarning: false }, { icon: <Package size={10}/>, label: "Stable", isWarning: false }]}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// Subcomponents

function StockItem({ label, value, percentage, status, color, isWarning }: { label: string; value: string; percentage: number; status: string; color: string; isWarning?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{label}</span>
        <span className="text-xs font-bold text-white">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden mb-2">
        <div className={`${color} h-full rounded-full`} style={{ width: `${percentage}%` }}></div>
      </div>
      <p className={`text-[9px] font-semibold text-right ${isWarning ? 'text-red-400' : 'text-slate-500'}`}>
        {status}
      </p>
    </div>
  );
}

function ShelterCard({ name, id, occupancy, capacity, status, statusColor, barColor, tags, isCritical }: { name: string; id: string; occupancy: number; capacity: number; status: string; statusColor: string; barColor: string; tags: any[]; isCritical?: boolean }) {
  const percentage = Math.min((occupancy / capacity) * 100, 100);
  
  return (
    <div className={`bg-[#131924] rounded-xl p-5 border ${isCritical ? 'border-red-500/30 bg-red-900/5' : 'border-slate-800/80'}`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-sm font-bold text-white mb-1">{name}</h4>
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">{id}</p>
        </div>
        <span className={`px-2 py-1 rounded text-[8px] font-bold tracking-widest uppercase ${statusColor}`}>
          {status}
        </span>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-[10px] font-bold mb-2">
          <span className="text-slate-500">Occupancy</span>
          <span className={isCritical ? 'text-red-400' : 'text-white'}>
            {occupancy.toLocaleString()} <span className="text-slate-500">/ {capacity.toLocaleString()}</span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
          <div className={`${barColor} h-full rounded-full`} style={{ width: `${percentage}%` }}></div>
        </div>
      </div>

      <div className="flex gap-2">
        {tags.map((tag, idx) => (
          <span key={idx} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold tracking-widest uppercase border ${tag.isWarning ? 'bg-[#0a0f16] border-red-900/30 text-red-400' : 'bg-[#0a0f16] border-slate-800/50 text-slate-400'}`}>
            {tag.icon} {tag.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Icons
function ListFilterIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="14" y2="4"></line>
      <line x1="10" y1="4" x2="3" y2="4"></line>
      <line x1="21" y1="12" x2="12" y2="12"></line>
      <line x1="8" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="20" x2="16" y2="20"></line>
      <line x1="12" y1="20" x2="3" y2="20"></line>
      <line x1="14" y1="2" x2="14" y2="6"></line>
      <line x1="8" y1="10" x2="8" y2="14"></line>
      <line x1="16" y1="18" x2="16" y2="22"></line>
    </svg>
  );
}

function TrendingDownIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline>
      <polyline points="16 17 22 17 22 11"></polyline>
    </svg>
  );
}