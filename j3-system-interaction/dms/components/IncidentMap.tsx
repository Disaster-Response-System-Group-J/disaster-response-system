"use client";

import { useState } from "react";
import Map, { Marker, ViewStateChangeEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { DropletMarker, MountainMarker, ShelterIcon } from "./MapIcons";

export default function IncidentMap() {
  const [filters, setFilters] = useState({
    flashFloods: true,
    landslides: true,
    infrastructure: false,
  });

  const [viewState, setViewState] = useState({
    longitude: 80.65, // Centered near Sigiriya/Kandalama
    latitude: 7.9,
    zoom: 9.5,
    pitch: 0,
    bearing: 0
  });

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="relative w-full h-full bg-[#0a0f16] overflow-hidden flex-1 flex flex-col">
      {/* Interactive Map Base */}
      <div className="absolute inset-0">
        <Map
          {...viewState}
          onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          minZoom={6}
          maxZoom={18}
        >
          {/* Flash Flood Marker */}
          {filters.flashFloods && (
            <Marker longitude={80.7} latitude={7.95} anchor="center">
              <DropletMarker />
            </Marker>
          )}

          {/* Landslide Marker */}
          {filters.landslides && (
            <Marker longitude={80.6} latitude={7.85} anchor="center">
              <MountainMarker />
            </Marker>
          )}
        </Map>
      </div>

      {/* Top Left: Live Grid Status */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h3 className="text-[10px] font-bold text-blue-400 tracking-widest uppercase mb-2 drop-shadow-md">
          LIVE GRID
        </h3>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>
          <span className="text-[10px] font-semibold text-slate-400 tracking-wider">
            SRI LANKA OPERATIONS SERVER ACTIVE
          </span>
        </div>
      </div>

      {/* Top Right: Operational Filters */}
      <div className="absolute top-8 right-8 z-10 w-72 bg-[#131924]/90 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-2xl">
        <h3 className="text-[10px] font-bold text-white tracking-widest uppercase mb-5">
          OPERATIONAL FILTERS
        </h3>
        
        <div className="mb-6">
          <h4 className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-3">
            INCIDENT TYPE
          </h4>
          <div className="space-y-3">
            <CheckboxItem
              label="Flash Floods"
              checked={filters.flashFloods}
              onClick={() => toggleFilter("flashFloods")}
            />
            <CheckboxItem
              label="Landslides"
              checked={filters.landslides}
              onClick={() => toggleFilter("landslides")}
            />
            <CheckboxItem
              label="Infrastructure Failure"
              checked={filters.infrastructure}
              onClick={() => toggleFilter("infrastructure")}
            />
          </div>
        </div>

        <div>
          <h4 className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-3">
            SEVERITY THRESHOLD
          </h4>
          <div className="flex bg-[#0a0f16]/80 rounded-lg border border-slate-800/50 p-1">
            <button className="flex-1 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
              Low
            </button>
            <button className="flex-1 py-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
              Med
            </button>
            <button className="flex-1 py-1.5 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded shadow-[0_0_10px_rgba(239,68,68,0.1)] transition-colors">
              Critical
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Right: Legend Matrix */}
      <div className="absolute bottom-8 right-8 z-10 bg-[#131924]/90 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-2xl min-w-[220px]">
        <h3 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-4">
          LEGEND MATRIX
        </h3>
        <div className="space-y-3.5">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]"></span>
            <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">CRITICAL PRIORITY</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]"></span>
            <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">EVACUATION ADVISORY</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShelterIcon className="text-slate-500 w-3 h-3" />
            <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">ACTIVE SHELTER</span>
          </div>
        </div>
      </div>

      {/* Bottom Center: T-24 Hours Slider */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-[500px] bg-[#131924]/90 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-2xl pointer-events-auto">
        <h3 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-4">
          T-24 HOURS
        </h3>
        <div className="relative h-2 bg-[#0a0f16] rounded-full mb-3 border border-slate-800/80 overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-[85%] bg-gradient-to-r from-blue-900 via-blue-500 to-blue-200 rounded-full"></div>
          <div className="absolute top-1/2 -translate-y-1/2 left-[85%] w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)] cursor-pointer hover:scale-110 transition-transform"></div>
        </div>
        <div className="flex justify-between text-[9px] font-bold text-slate-500">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
        </div>
      </div>
    </div>
  );
}

function CheckboxItem({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group pointer-events-auto" onClick={onClick}>
      <div className="relative flex items-center justify-center">
        <div className={`w-3.5 h-3.5 border rounded-[3px] transition-colors ${checked ? 'bg-slate-200 border-slate-200' : 'bg-[#0a0f16] border-slate-600 group-hover:border-slate-500'}`}></div>
        {checked && (
          <div className="absolute w-1.5 h-1.5 bg-[#0a0f16] rounded-sm"></div>
        )}
      </div>
      <span className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors">
        {label}
      </span>
    </label>
  );
}