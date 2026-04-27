"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Wind, 
  Plane, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  Search as SearchIcon,
  Circle,
  Search
} from "lucide-react";
import { apiRequest } from "@/lib/api-client"; // Using general apiRequest since activityAPI is new

interface ActivityEvent {
  id: string;
  time: string;
  date: string;
  category: string;
  type: "weather" | "dispatch" | "status" | "incident" | "logistics";
  source: string;
  description: string;
  tags?: string[];
  incidentId?: string;
}

export default function ActivityFeed() {
  const [filter, setFilter] = useState("ALL EVENTS");
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      // Ensure your backend at /api/activity matches the structure in the previous step
      const data = await apiRequest("/activity"); 
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity feed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const filters = [
    "ALL EVENTS",
    "NEW INCIDENTS",
    "RESOURCE DISPATCH",
    "STATUS CHANGES",
    "WEATHER WARNINGS"
  ];

  const filteredActivities = activities.filter((event) => {
    if (filter === "ALL EVENTS") return true;
    const typeMap: Record<string, string> = {
      "NEW INCIDENTS": "incident",
      "RESOURCE DISPATCH": "dispatch",
      "STATUS CHANGES": "status",
      "WEATHER WARNINGS": "weather"
    };
    return event.type === typeMap[filter];
  });

  const groupedActivities = filteredActivities.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = [];
    acc[curr.date].push(curr);
    return acc;
  }, {} as Record<string, ActivityEvent[]>);

  return (
    <main className="flex-1 flex flex-col bg-[#0a0f16] text-slate-200 overflow-hidden">
      {/* Header Section */}
      <div className="p-8 pb-4">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">ACTIVITY FEED</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500">
                <Circle size={8} className="fill-red-500 animate-pulse" /> LIVE
              </span>
            </div>
            <p className="text-sm text-slate-400">Real-time operational updates across all sectors.</p>
          </div>

          {/* Search Bar - Matching Search Box in Image */}
          <div className="relative">
            <div className="flex items-center bg-[#111823] border border-slate-800 rounded-lg overflow-hidden w-80">
                <div className="pl-3 text-slate-500">
                    <Search size={16} />
                </div>
                <input 
                    type="text" 
                    placeholder="Search districts, resources, or keywords..."
                    className="w-full bg-transparent py-2.5 px-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none"
                />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-[11px] font-bold tracking-wider transition-all border ${
                filter === f 
                  ? "bg-[#1e293b] border-slate-700 text-white shadow-lg" 
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Feed Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
             <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-xs font-bold tracking-widest">SYNCHRONIZING FEED...</p>
          </div>
        ) : (
          Object.entries(groupedActivities).map(([date, events]) => (
            <div key={date} className="mb-10">
              <h3 className="text-[10px] font-bold text-slate-600 tracking-[0.2em] mb-6 uppercase border-b border-slate-800/50 pb-2">
                {date}
              </h3>
              <div className="space-y-4">
                {events.map((event) => (
                  <ActivityCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

function ActivityCard({ event }: { event: ActivityEvent }) {
  const typeStyles = {
    weather: {
      border: "border-l-red-500",
      bg: "bg-[#131924]",
      icon: <Wind size={18} className="text-red-500" />,
      categoryColor: "text-red-500"
    },
    dispatch: {
      border: "border-l-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.05)]",
      bg: "bg-[#1a2333] border border-blue-500/20",
      icon: <Plane size={18} className="text-blue-400" />,
      categoryColor: "text-blue-400"
    },
    status: {
      border: "border-l-teal-500/30",
      bg: "bg-[#131924]",
      icon: <CheckCircle2 size={18} className="text-teal-400/70" />,
      categoryColor: "text-slate-400"
    },
    incident: {
      border: "border-l-red-500",
      bg: "bg-[#131924]",
      icon: <AlertCircle size={18} className="text-red-500" />,
      categoryColor: "text-red-500"
    },
    logistics: {
      border: "border-l-slate-600",
      bg: "bg-[#131924]",
      icon: <Truck size={18} className="text-slate-500" />,
      categoryColor: "text-slate-400"
    }
  };

  const style = typeStyles[event.type];

  return (
    <div className="flex gap-8 group">
      {/* Timeline Time Column */}
      <div className="w-12 pt-4 text-xs font-bold text-slate-600 tabular-nums text-right">
        {event.time}
      </div>

      {/* Card Content Container */}
      <div className={`flex-1 rounded-xl p-6 border-l-4 ${style.border} ${style.bg} transition-all hover:bg-slate-800/40 relative border border-slate-800/50`}>
        {/* Incident ID Badge */}
        {event.incidentId && (
          <span className="absolute top-4 right-5 text-[9px] font-bold text-slate-600 tracking-widest bg-black/40 px-2.5 py-1 rounded border border-slate-800/80">
            ID: {event.incidentId}
          </span>
        )}
        
        <div className="flex gap-5">
          <div className="mt-1 shrink-0">{style.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-bold tracking-widest uppercase ${style.categoryColor}`}>
                {event.category}
              </span>
            </div>
            <h4 className="text-base font-bold text-white mb-2">{event.source}</h4>
            <p className="text-sm text-slate-400 leading-relaxed max-w-4xl">
              {event.description}
            </p>
            
            {/* Tag Buttons */}
            {event.tags && (
              <div className="flex gap-2 mt-4">
                {event.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 rounded bg-[#242d3d] border border-slate-700/50 text-[9px] font-bold text-slate-400 tracking-wider uppercase hover:text-white transition-colors cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}