"use client";

import { useState } from "react";
import { Shield, Eye, EyeOff, User, Lock, Contact, ArrowRight } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [passkey, setPasskey] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, passkey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setPasskey("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setEmail("");
    setPasskey("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#0a0f16] flex flex-col md:flex-row text-white font-sans">
      {/* Left Column - Branding */}
      <div className="flex-1 flex flex-col justify-between p-12 lg:p-24 relative z-10 border-r border-slate-800/50">
        <div>
          <div className="flex items-center gap-3 mb-24">
            <Shield size={28} className="text-blue-400 fill-blue-400" />
            <span className="text-xl font-bold tracking-wide">SOVEREIGN PRECISION</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            OPERATIONAL<br />
            COMMAND<br />
            CENTER
          </h1>
          
          <p className="text-slate-400 text-lg max-w-md leading-relaxed">
            Real-Time Flood and Landslide Emergency Coordination Platform.
          </p>
        </div>

        <div>
          <div className="inline-flex items-center gap-3 bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3 mb-6">
            <Shield size={16} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-300 tracking-wider">
              RESTRICTED ACCESS. AUTHORIZED PERSONNEL ONLY.
            </span>
          </div>
          <div className="text-xs font-medium text-slate-500 tracking-wider flex items-center gap-4">
            <span>DMC SRI LANKA</span>
            <span className="w-1 h-1 rounded-full bg-slate-500"></span>
            <span>SYSTEM v4.2.1</span>
          </div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24 relative bg-[#0a0f16]">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-blue-900/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="w-full max-w-[440px] relative">
          {/* Card */}
          <div className="bg-[#111620] border border-slate-800/80 rounded-xl overflow-hidden relative shadow-2xl shadow-black/50">
            {/* Top Blue Glow Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-80"></div>

            <div className="p-10">
              <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">Secure Authentication</h2>
              <p className="text-slate-400 text-sm mb-8">Enter your credentials to access the command grid.</p>

              <form onSubmit={handleLogin} className="space-y-6">
                {/* Operational Role Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">
                    OPERATIONAL ROLE
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Contact size={18} />
                    </div>
                    <select className="w-full bg-[#0a0f16] border border-slate-800/80 rounded-lg pl-12 pr-10 py-3.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer font-medium">
                      <option value="administrator">Incident Commander</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>

                {/* Service ID / Email */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">
                    SERVICE ID / EMAIL
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <User size={18} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ID-0000"
                      className="w-full bg-[#0a0f16] border border-slate-800/80 rounded-lg pl-12 pr-4 py-3.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/50 transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Passkey */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                      PASSKEY
                    </label>
                    <button
                      type="button"
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      onClick={handleReset}
                    >
                      Reset Access
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPasskey ? "text" : "password"}
                      value={passkey}
                      onChange={(e) => setPasskey(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0a0f16] border border-slate-800/80 rounded-lg pl-12 pr-12 py-3.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/50 transition-all tracking-widest"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasskey(!showPasskey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPasskey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-900/20 border border-red-900/50 rounded-lg px-4 py-3">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                {/* MFA Checkbox */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      id="mfa"
                      className="peer appearance-none w-4 h-4 border border-slate-700 bg-[#0a0f16] rounded-[4px] checked:bg-blue-600 checked:border-blue-600 cursor-pointer transition-colors"
                      defaultChecked
                    />
                    <svg className="absolute w-3 h-3 pointer-events-none hidden peer-checked:block text-white" viewBox="0 0 14 10" fill="none">
                      <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <label htmlFor="mfa" className="text-sm font-medium text-slate-400 cursor-pointer select-none">
                    Require Bio-metric MFA Token
                  </label>
                </div>

                {/* Initialize Button */}
                <button
                  type="submit"
                  disabled={isLoading || !email || !passkey}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-semibold py-4 rounded-lg transition-all mt-8 text-sm tracking-wide flex items-center justify-center gap-2 group"
                >
                  {isLoading ? "INITIALIZING SESSION..." : "INITIALIZE SESSION"}
                  {!isLoading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform opacity-70" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}