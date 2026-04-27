// components/MapIcons.tsx
"use client";

export function DropletMarker() {
  return (
    <div className="relative group cursor-pointer">
      {/* Outer Glow */}
      <div className="absolute inset-0 bg-red-500 blur-xl opacity-30 group-hover:opacity-50 transition-opacity rounded-xl"></div>
      <div className="absolute inset-0 bg-red-400 blur-md opacity-40 rounded-xl animate-pulse"></div>
      
      {/* Marker Box */}
      <div className="relative w-8 h-8 bg-red-400/90 rounded-[10px] border border-red-300 shadow-[0_0_15px_rgba(248,113,113,0.5)] flex items-center justify-center backdrop-blur-sm transform transition-transform group-hover:scale-110">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0f16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path>
        </svg>
      </div>
    </div>
  );
}

export function MountainMarker() {
  return (
    <div className="relative group cursor-pointer">
      {/* Outer Glow */}
      <div className="absolute inset-0 bg-teal-500 blur-xl opacity-30 group-hover:opacity-50 transition-opacity rounded-full"></div>
      <div className="absolute inset-0 bg-teal-400 blur-md opacity-40 rounded-full animate-pulse"></div>
      
      {/* Marker Circle */}
      <div className="relative w-7 h-7 bg-teal-400/90 rounded-full border border-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.5)] flex items-center justify-center backdrop-blur-sm transform transition-transform group-hover:scale-110">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0f16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z"></path>
        </svg>
      </div>
    </div>
  );
}

export function ShelterIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );
}