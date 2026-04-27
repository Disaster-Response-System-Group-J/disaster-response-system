"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ChevronDown, 
  ListFilter, 
  Ambulance, 
  Ship, 
  Users, 
  Truck, 
  Plus, 
  Minus, 
  Focus, 
  ExternalLink 
} from "lucide-react";
import Map, { Marker, ViewStateChangeEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { resourcesListAPI } from "@/lib/api-client";

export default function ResourceTracking() {
  const [resourceData, setResourceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewState, setViewState] = useState({
    longitude: 79.8612, // Colombo North
    latitude: 6.9271,
    zoom: 11,
    pitch: 0,
    bearing: 0
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await resourcesListAPI.getList();
      setResourceData(data);
    } catch (error) {
      console.error("Failed to sync resources:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Resource Tracking</h1>
            <p className="text-sm text-slate-400 font-medium">Live deployment overview across operational zones.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-[#131924] border border-slate-800/80 rounded-lg p-1">
              <button className="px-4 py-1.5 bg-slate-700/50 text-white rounded text-xs font-bold shadow-sm">All Units</button>
              <button className="px-4 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors">Available</button>
              <button className="px-4 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors">Deployed</button>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#131924] hover:bg-slate-800 border border-slate-700/50 rounded-lg text-xs font-semibold text-slate-300">
              <ListFilter size={14} /> Filters
            </button>
          </div>
        </div>

        {/* Active Parameters Controls */}
        <div className="mb-6">
          <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-3">ACTIVE PARAMETERS</p>
          <div className="flex items-center gap-3">
            <FilterButton label="All Resource Types" />
            <FilterButton label="All Districts" />
            <FilterButton label="Any Status" />
            <div className="ml-4 flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-slate-400">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]"></span>
              Live Sync Active
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          
          {/* Resources Table */}
          <div className="col-span-2">
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[9px] font-bold text-slate-500 tracking-widest uppercase">
                    <th className="px-6 py-4">UNIT ID <ChevronDown size={10} className="inline ml-1"/></th>
                    <th className="px-6 py-4">TYPE</th>
                    <th className="px-6 py-4">DISTRICT</th>
                    <th className="px-6 py-4">STATUS</th>
                    <th className="px-6 py-4">CURRENT INCIDENT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {resourceData?.resources.map((res: any) => (
                    <tr key={res.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-5 text-xs font-bold text-blue-400">{res.id}</td>
                      <td className="px-6 py-5 text-xs font-semibold text-slate-300">
                        <span className="mr-2">{res.icon}</span> {res.type}
                      </td>
                      <td className="px-6 py-5 text-xs font-medium text-slate-400">{res.district}</td>
                      <td className="px-6 py-5"><StatusPill status={res.status} /></td>
                      <td className="px-6 py-5 text-xs font-medium text-slate-400 truncate max-w-[150px]">{res.incident}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Widgets & Map */}
          <div className="col-span-1 space-y-6">
            
            {/* Resource Deployment Stats */}
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
              <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-6">RESOURCE DEPLOYMENT</h3>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="48" cy="48" r="40" fill="transparent" stroke="#1e293b" strokeWidth="8" />
                    <circle cx="48" cy="48" r="40" fill="transparent" stroke="#3b82f6" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="40" strokeLinecap="round" />
                  </svg>
                  <div className="absolute text-center">
                    <span className="block text-2xl font-bold text-white">84%</span>
                    <span className="block text-[8px] font-bold text-slate-500 tracking-widest uppercase">ACTIVE</span>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <DeploymentStat label="Ambulances" current={resourceData?.deployment.ambulances.deployed} total={resourceData?.deployment.ambulances.total} color="bg-red-500" />
                  <DeploymentStat label="Rescue Boats" current={resourceData?.deployment.rescue.deployed} total={resourceData?.deployment.rescue.total} color="bg-teal-400" />
                  <DeploymentStat label="Ground Teams" current={resourceData?.deployment.groundTeams.deployed} total={resourceData?.deployment.groundTeams.total} color="bg-blue-500" />
                </div>
              </div>
            </div>

            {/* Live Deployment Map */}
            <div className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden relative h-[380px] flex flex-col">
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
                <MapControlButton icon={<Plus size={14} />} />
                <MapControlButton icon={<Minus size={14} />} className="mb-2" />
                <MapControlButton icon={<Focus size={14} />} active />
              </div>

              <div className="flex-1 relative">
                <Map
                  {...viewState}
                  onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
                  mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                  interactive={true}
                >
                  {/* Simulated Deployment Markers */}
                  <ResourceMarker lng={79.86} lat={6.94} color="bg-red-400" />
                  <ResourceMarker lng={79.88} lat={6.91} color="bg-blue-400" />
                  <ResourceMarker lng={79.85} lat={6.92} color="bg-teal-400" />
                </Map>
              </div>

              <div className="bg-[#181f2c] border-t border-slate-800/80 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-bold text-slate-500 tracking-widest uppercase mb-1">FOCUS SECTOR</p>
                  <p className="text-xs font-bold text-slate-200">Colombo North - S3</p>
                </div>
                <button className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-widest transition-colors">
                  Expand Map <ExternalLink size={12} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// Internal Helper Components

function ResourceMarker({ lng, lat, color }: { lng: number, lat: number, color: string }) {
  return (
    <Marker longitude={lng} latitude={lat} anchor="center">
      <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_12px_currentColor] border border-white/20`}></div>
    </Marker>
  );
}

function MapControlButton({ icon, className = "", active = false }: { icon: React.ReactNode, className?: string, active?: boolean }) {
  return (
    <button className={`w-8 h-8 bg-[#131924]/80 backdrop-blur border border-slate-700 rounded flex items-center justify-center transition-colors hover:bg-slate-700 ${active ? 'text-blue-400' : 'text-slate-300'} ${className}`}>
      {icon}
    </button>
  );
}

function FilterButton({ label }: { label: string }) {
  return (
    <button className="flex items-center justify-between w-40 px-3 py-2 bg-[#131924] border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
      {label} <ChevronDown size={14} className="text-slate-500" />
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: any = {
    "Assigned": "bg-red-500/10 text-red-400 border-red-500/20",
    "In Transit": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "Available": "bg-slate-800/50 text-slate-300 border-slate-700/50"
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] font-bold tracking-widest uppercase ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Assigned' ? 'bg-red-500' : status === 'In Transit' ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
      {status}
    </span>
  );
}

function DeploymentStat({ label, current, total, color }: { label: string; current: number; total: number; color: string }) {
  const percentage = (current / total) * 100;
  return (
    <div className="text-xs font-semibold">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-300">{label}</span>
        <span className="text-white">{current}<span className="text-slate-500">/{total}</span></span>
      </div>
      <div className="w-full bg-slate-800/80 h-1 rounded-full overflow-hidden">
        <div className={`${color} h-full rounded-full`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}