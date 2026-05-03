'use client';

import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, XCircle, Copy, Eye, MapPin, Clock, Camera, AlertTriangle, ShieldAlert } from 'lucide-react';
import { MOCK_INCOMING_REPORTS } from '@/data/mock-data';
import { VerificationStatus, ReportSource, IncomingReport, UserRole } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  J1_SOS_APP: { label: 'J1 SOS', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  J3_PUBLIC_PORTAL: { label: 'PUBLIC', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  J1_SENSOR_SYSTEM: { label: 'SENSOR', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  WEATHER_API: { label: 'WEATHER', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  OFFICER_CREATED: { label: 'OFFICER', color: 'bg-slate-800 text-slate-300 border-slate-700' },
};

const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  VERIFIED: 'bg-green-500/10 text-green-400 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  DUPLICATE: 'bg-slate-800 text-slate-400 border-slate-700',
  CONVERTED_TO_INCIDENT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function IncomingReportsPage() {
  const { user, hasPermission } = useAuth();
  const socket = useSocket();
  const [reports, setReports] = useState<IncomingReport[]>(MOCK_INCOMING_REPORTS);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [selectedReport, setSelectedReport] = useState<IncomingReport | null>(null);

const enforcedDistrict = (user?.role === UserRole.SYSTEM_ADMIN || user?.role.includes('NATIONAL')) ? 'ALL' : (user as any)?.assignedDistrict || 'ALL';
  // WebSocket Integration for Real-Time Updates
  useEffect(() => {
    if (!socket) return;

    const handleNewReport = (newReport: IncomingReport) => {
      setReports((prevReports) => [newReport, ...prevReports]);
    };
    const handleReportUpdated = (data: { reportId: string, verificationStatus: VerificationStatus, reviewedAt: string }) => {
      setReports(prev => prev.map(r => 
        r.reportId === data.reportId 
          ? { ...r, verificationStatus: data.verificationStatus, reviewedAt: data.reviewedAt } 
          : r
      ));
      setSelectedReport(current => current?.reportId === data.reportId ? null : current);
    };

    socket.on('dashboard:new-report', handleNewReport);
    socket.on('dashboard:report-updated', handleReportUpdated);

    return () => {
      socket.off('dashboard:new-report', handleNewReport);
      socket.off('dashboard:report-updated', handleReportUpdated);
    };
  }, [socket]);

  const filtered = reports.filter(r => {
    if (statusFilter !== 'ALL' && r.verificationStatus !== statusFilter) return false;
    if (sourceFilter !== 'ALL' && r.source !== sourceFilter) return false;
    if (enforcedDistrict !== 'ALL' && r.district !== enforcedDistrict) return false;
    return true;
  });

  const pendingCount = reports.filter(r => r.verificationStatus === VerificationStatus.PENDING_REVIEW).length;

  const handleAction = (reportId: string, action: 'verify' | 'reject' | 'duplicate') => {
    const statusMap = { verify: VerificationStatus.VERIFIED, reject: VerificationStatus.REJECTED, duplicate: VerificationStatus.DUPLICATE };
    const newStatus = statusMap[action];
    setReports(prev => prev.map(r => {
      if (r.reportId !== reportId) return r;
      return { ...r, verificationStatus: newStatus, reviewedAt: new Date().toISOString() };
    }));
    setSelectedReport(null);
    if (socket) {
      socket.emit('client:update-report-status', { reportId, status: newStatus });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold tracking-tight">Incoming Reports</h1>
              {/* Show a restriction badge for non-admins */}
              {enforcedDistrict !== 'ALL' && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-400">
                  <MapPin size={12} /> {enforcedDistrict} Zone Only
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">
              <span className="text-orange-400 font-bold">{pendingCount}</span> reports pending review in your jurisdiction
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-2.5 text-xs font-semibold text-slate-300 focus:outline-none">
              <option value="ALL">All Statuses</option>
              {Object.values(VerificationStatus).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className="bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-2.5 text-xs font-semibold text-slate-300 focus:outline-none">
              <option value="ALL">All Sources</option>
              {Object.values(ReportSource).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Reports List */}
          <div className="col-span-2 space-y-3">
            {filtered.map((report, index) => (
                <div key={report.reportId || `new-report-${index}`}
                onClick={() => setSelectedReport(report)}
                className={`bg-[#131924] border rounded-xl p-5 cursor-pointer transition-all hover:border-slate-700 ${
                  selectedReport?.reportId === report.reportId ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-800/80'
                } ${report.verificationStatus === VerificationStatus.PENDING_REVIEW ? 'border-l-4 border-l-orange-500' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300">{report.reportId}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-widest border ${SOURCE_LABELS[report.source]?.color}`}>
                      {SOURCE_LABELS[report.source]?.label}
                    </span>
                    {report.mediaUrls && report.mediaUrls.length > 0 && <Camera size={12} className="text-teal-400" />}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-widest border ${STATUS_STYLES[report.verificationStatus]}`}>
                    {(report.verificationStatus || 'UNKNOWN').replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-3 line-clamp-2">{report.description}</p>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><AlertTriangle size={10} /> {report.disasterType}</span>
                  <span className="flex items-center gap-1"><MapPin size={10} /> {report.district}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {new Date(report.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="col-span-1">
            {selectedReport ? (
              <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6 sticky top-8">
                <h3 className="text-base font-bold mb-4">Report Details</h3>
                <div className="space-y-4 text-sm">
                  <Field label="Report ID" value={selectedReport.reportId} />
                  <Field label="Source" value={SOURCE_LABELS[selectedReport.source]?.label} />
                  <Field label="Type" value={selectedReport.disasterType} />
                  <Field label="District" value={selectedReport.district} />
                  <Field label="Location" value={`${selectedReport.latitude}, ${selectedReport.longitude}`} />
                  <Field label="Contact" value={selectedReport.contact || 'N/A'} />
                  <Field label="Time" value={new Date(selectedReport.createdAt).toLocaleString()} />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">DESCRIPTION</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{selectedReport.description}</p>
                  </div>
                  {selectedReport.mediaUrls && selectedReport.mediaUrls.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2">MEDIA ({selectedReport.mediaUrls.length})</p>
                      <div className="flex gap-2">
                        {selectedReport.mediaUrls.map((url, i) => (
                          <div key={i} className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                            <Camera size={16} className="text-slate-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedReport.officerNotes && <Field label="Officer Notes" value={selectedReport.officerNotes} />}

                  {/* Actions */}
                  {selectedReport.verificationStatus === VerificationStatus.PENDING_REVIEW && hasPermission('verify:reports') && (
                    <div className="pt-4 border-t border-slate-800/50 space-y-2">
                      <button onClick={() => handleAction(selectedReport.reportId, 'verify')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-xs font-bold text-green-400 transition-colors">
                        <CheckCircle2 size={14} /> Verify Report
                      </button>
                      <button onClick={() => handleAction(selectedReport.reportId, 'reject')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-colors">
                        <XCircle size={14} /> Reject Report
                      </button>
                      <button onClick={() => handleAction(selectedReport.reportId, 'duplicate')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg text-xs font-bold text-slate-300 transition-colors">
                        <Copy size={14} /> Mark Duplicate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6 text-center py-20">
                <Eye size={24} className="text-slate-600 mx-auto mb-3" />
                <p className="text-xs text-slate-500">Select a report to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">{label}</p>
      <p className="text-xs text-slate-300">{value}</p>
    </div>
  );
}