"use client";

import { useState } from "react";
import {
  Shield,
  BellRing,
  LayoutGrid,
  Map as MapIcon,
  Radio,
  Truck,
  AlertTriangle,
  History,
  BarChart2,
  Server,
  HelpCircle,
  Bell,
  Settings,
  UserCircle,
} from "lucide-react";
import Dashboard from "@/components/Dashboard";
import IncidentMap from "@/components/IncidentMap";
import ResponseDetails from "@/components/ResponseDetails";
import Analytics from "@/components/Analytics";
import RelieveOperations from "@/components/RelieveOperations";
import ResourceTracking from "@/components/ResourceTracking";
import ActivityFeed from "@/components/ActivityFeed";
import Login from "@/components/Login";
import { useApp } from "@/context/AppContext";

export default function App() {
  const { isAuthenticated, user } = useApp();
  const [currentPage, setCurrentPage] = useState("dashboard");

  if (!isAuthenticated || !user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-[#0a0f16] text-white font-sans overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-[280px] bg-[#0a0f16] border-r border-slate-800/50 flex flex-col z-20 shrink-0">
        {/* Sidebar Header */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <Shield size={24} className="text-blue-400 fill-blue-400" />
            <h1 className="text-sm font-bold tracking-wide text-slate-100">DMC SRI LANKA</h1>
          </div>
          <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase ml-9">OPERATIONAL COMMAND</p>
        </div>

        {/* Report Incident Button */}
        <div className="px-6 pb-6">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg font-bold text-blue-400 text-xs transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <BellRing size={16} />
            Report Incident
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
          <div className="space-y-1">
            <NavItem
              icon={<LayoutGrid size={18} />}
              label="COMMAND CENTER"
              active={currentPage === "dashboard"}
              onClick={() => setCurrentPage("dashboard")}
            />
            <NavItem
              icon={<MapIcon size={18} />}
              label="INCIDENT MAP"
              active={currentPage === "map"}
              onClick={() => setCurrentPage("map")}
            />
            <NavItem
              icon={<Radio size={18} />}
              label="RESPONSE DETAILS"
              active={currentPage === "response"}
              onClick={() => setCurrentPage("response")}
            />
            <NavItem
              icon={<Truck size={18} />}
              label="RESOURCE TRACKING"
              active={currentPage === "resources"}
              onClick={() => setCurrentPage("resources")}
            />
            <NavItem
              icon={<AlertTriangle size={18} />}
              label="RELIEF OPERATIONS"
              active={currentPage === "relief"}
              onClick={() => setCurrentPage("relief")}
            />
            <NavItem
              icon={<History size={18} />}
              label="ACTIVITY FEED"
              active={currentPage === "activity"}
              onClick={() => setCurrentPage("activity")}
            />
            <NavItem
              icon={<BarChart2 size={18} />}
              label="ANALYTICS"
              active={currentPage === "analytics"}
              onClick={() => setCurrentPage("analytics")}
            />
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto py-4 space-y-1 border-t border-slate-800/50">
          <NavItem
            icon={<Server size={18} />}
            label="SYSTEM STATUS"
            active={false}
            onClick={() => {}}
            isFooter
          />
          <NavItem
            icon={<HelpCircle size={18} />}
            label="SUPPORT"
            active={false}
            onClick={() => {}}
            isFooter
          />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0a0f16]">
        {/* Top Header */}
        <header className="h-16 bg-[#0a0f16] border-b border-slate-800/50 flex items-center justify-end px-8 shrink-0 z-10">
          <div className="flex items-center gap-6 text-[11px] font-bold text-slate-400 tracking-wider">
            <div className="flex items-center gap-6 border-r border-slate-800/50 pr-6">
              <span className="text-blue-400 cursor-pointer border-b border-blue-400 pb-1">District: Colombo</span>
              <span className="cursor-pointer hover:text-slate-300 transition-colors pb-1 border-b border-transparent">Language: EN</span>
            </div>
            <div className="flex items-center gap-5">
              <button className="relative hover:text-white transition-colors">
                <Bell size={16} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0a0f16]"></span>
              </button>
              <button className="hover:text-white transition-colors">
                <Settings size={16} />
              </button>
              <button className="hover:text-white transition-colors">
                <UserCircle size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {currentPage === "dashboard" && <Dashboard />}
          {currentPage === "map" && <IncidentMap />}
          {currentPage === "response" && <ResponseDetails />}
          {currentPage === "analytics" && <Analytics />}
          {currentPage === "relief" && <RelieveOperations />}
          {currentPage === "activity" && <ActivityFeed />}
          {currentPage === "resources" && <ResourceTracking />}
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  isFooter = false
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  isFooter?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-8 py-3.5 transition-all relative group ${
        active
          ? "text-slate-200 bg-slate-800/30"
          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/10"
      } ${isFooter ? "py-3" : ""}`}
    >
      {active && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
      )}
      <div className={`${active ? "text-blue-400" : "group-hover:text-slate-400 transition-colors"}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold tracking-widest uppercase mt-0.5">{label}</span>
    </button>
  );
}