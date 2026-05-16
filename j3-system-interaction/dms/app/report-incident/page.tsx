'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Shield, AlertTriangle, Upload, MapPin, X, CheckCircle2, ArrowLeft, Camera, Video } from 'lucide-react';
import { DISASTER_TYPES } from '@/types';
import { DISTRICT_NAMES } from '@/data/districts';

export default function ReportIncidentPage() {
  const [form, setForm] = useState({ disasterType: '', district: '', description: '', contact: '', latitude: '', longitude: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => {
        const isImage = f.type.startsWith('image/');
        const isVideo = f.type.startsWith('video/');
        const sizeOk = f.size <= 10 * 1024 * 1024; // 10MB
        return (isImage || isVideo) && sizeOk;
      });
      setFiles(prev => [...prev, ...newFiles].slice(0, 5));
    }
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          source: 'J3_PUBLIC_PORTAL',
          eventId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to submit report'}`);
      }
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0f16] text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Report Submitted</h1>
          <p className="text-slate-400 text-sm mb-2">Your incident report has been received and saved with status <span className="text-orange-400 font-bold">PENDING REVIEW</span>.</p>
          <p className="text-slate-500 text-xs mb-8">An officer will review your report shortly. It will not appear publicly until verified.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="px-6 py-3 bg-[#131924] border border-slate-700/50 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors">Back to Home</Link>
            <button onClick={() => { setSubmitted(false); setForm({ disasterType: '', district: '', description: '', contact: '', latitude: '', longitude: '' }); setFiles([]); }}
              className="px-6 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors">
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white font-sans">
      {/* Header */}
      <header className="border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Shield size={24} className="text-blue-400 fill-blue-400" />
            <span className="text-sm font-bold tracking-wide">DMC SRI LANKA</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Report an Incident</h1>
              <p className="text-xs text-slate-400">Your report will be reviewed by an officer before publishing.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Disaster Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">DISASTER TYPE *</label>
              <select value={form.disasterType} onChange={e => setForm({ ...form, disasterType: e.target.value })} required
                className="w-full bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer">
                <option value="">Select type...</option>
                <option value={DISASTER_TYPES.FLOOD}>🌊 Flood</option>
                <option value={DISASTER_TYPES.LANDSLIDE}>⛰️ Landslide</option>
                <option value={DISASTER_TYPES.OTHER}>⚠️ Other</option>
              </select>
            </div>

            {/* District */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">DISTRICT *</label>
              <select value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} required
                className="w-full bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer">
                <option value="">Select district...</option>
                {DISTRICT_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">LATITUDE</label>
              <input type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })}
                placeholder="e.g. 6.9271" className="w-full bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">LONGITUDE</label>
              <input type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })}
                placeholder="e.g. 79.8612" className="w-full bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">DESCRIPTION *</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={4}
              placeholder="Describe the incident in detail — what happened, current situation, people affected..."
              className="w-full bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none" />
          </div>

          {/* Contact */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">CONTACT NUMBER</label>
            <input type="tel" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })}
              placeholder="+94 7X XXX XXXX" className="w-full bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all" />
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">PHOTOS / VIDEOS (max 5 files, 10MB each)</label>
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-slate-600 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" multiple accept="image/*,video/*" onChange={handleFile} className="hidden" />
              <Upload size={24} className="text-slate-500 mx-auto mb-3" />
              <p className="text-sm text-slate-400 mb-1">Click to upload or drag and drop</p>
              <p className="text-[10px] text-slate-500 flex items-center justify-center gap-3">
                <span className="flex items-center gap-1"><Camera size={12} /> Images</span>
                <span className="flex items-center gap-1"><Video size={12} /> Short videos</span>
              </p>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-4">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#131924] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300">
                    {f.type.startsWith('video/') ? <Video size={14} className="text-blue-400" /> : <Camera size={14} className="text-teal-400" />}
                    <span className="max-w-[150px] truncate">{f.name}</span>
                    <span className="text-slate-500">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-slate-500 hover:text-red-400 transition-colors"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting || !form.disasterType || !form.district || !form.description}
            className="w-full bg-gradient-to-r from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-semibold py-4 rounded-lg transition-all text-sm tracking-wide">
            {submitting ? 'SUBMITTING REPORT...' : 'SUBMIT INCIDENT REPORT'}
          </button>
        </form>
      </main>
    </div>
  );
}
