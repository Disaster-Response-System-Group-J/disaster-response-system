'use client';

import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, XCircle, Copy, Eye, MapPin, Clock, Camera, AlertTriangle, Link2 } from 'lucide-react';
import { VerificationStatus, ReportSource, IncomingReport, UserRole, IncidentSeverity } from '@/types';
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

  const [reports, setReports] = useState<IncomingReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIncidents, setActiveIncidents] = useState<any[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [selectedReport, setSelectedReport] = useState<IncomingReport | null>(null);
  const [isElevating, setIsElevating] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    title: '',
    severity: IncidentSeverity.HIGH,
    affectedPeople: 0,
  });

  const [duplicateModal, setDuplicateModal] = useState<IncomingReport | null>(null);
  const [selectedDuplicateIncidentId, setSelectedDuplicateIncidentId] = useState('');

  const enforcedDistrict =
    user?.role === UserRole.SYSTEM_ADMIN || user?.role.includes('NATIONAL')
      ? 'ALL'
      : (user as any)?.assignedDistrict || 'ALL';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportsRes, incidentsRes] = await Promise.all([
          fetch('/api/reports'),
          fetch('/api/incidents'),
        ]);

        if (!reportsRes.ok) throw new Error('Failed to fetch reports');
        const data = await reportsRes.json();

        const mappedReports: IncomingReport[] = data.map((row: any) => ({
          reportId: (row.report_id ?? row.id ?? '').toString(),
          source: (row.source_channel ?? row.source) as ReportSource,
          verificationStatus: (row.status ?? row.verificationStatus) as VerificationStatus,
          district: row.district || 'UNASSIGNED',
          disasterType: row.disaster_type || 'UNKNOWN',
          latitude: Number(row.latitude) || 0,
          longitude: Number(row.longitude) || 0,
          mediaUrls: row.media_urls ?? (row.media_url ? [row.media_url] : []),
          contact: row.contact ?? row.contact_info ?? '',
          createdAt: row.created_at ?? row.createdAt,
          description: row.description || '',
          officerNotes: row.officer_notes || '',
          sosId: row.sos_id,
          deviceId: row.device_id,
          reviewedAt: row.reviewed_at ?? row.reviewedAt,
        }));
        setReports(mappedReports);

        if (incidentsRes.ok) {
          const incData = await incidentsRes.json();
          const arr = Array.isArray(incData) ? incData : [];
          setActiveIncidents(arr.filter((i: any) => i.status === 'ACTIVE' || i.status === 'UNDER_RESPONSE'));
        }
      } catch (err) {
        console.error('Error fetching reports:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewReport = (newReport: IncomingReport) => {
      setReports((prevReports) => [newReport, ...prevReports]);
    };

    const handleReportUpdated = (data: {
      reportId: string;
      verificationStatus: VerificationStatus;
      reviewedAt: string;
    }) => {
      setReports((prev) =>
        prev.map((r) =>
          r.reportId === data.reportId
            ? { ...r, verificationStatus: data.verificationStatus, reviewedAt: data.reviewedAt }
            : r
        )
      );
      setSelectedReport((current) => (current?.reportId === data.reportId ? null : current));
    };

    socket.on('dashboard:new-report', handleNewReport);
    socket.on('dashboard:report-updated', handleReportUpdated);

    return () => {
      socket.off('dashboard:new-report', handleNewReport);
      socket.off('dashboard:report-updated', handleReportUpdated);
    };
  }, [socket]);

  const filtered = reports
    .filter((r) => {
      if (statusFilter !== 'ALL' && r.verificationStatus !== statusFilter) return false;
      if (sourceFilter !== 'ALL' && r.source !== sourceFilter) return false;
      if (enforcedDistrict !== 'ALL' && r.district !== enforcedDistrict) return false;
      return true;
    })
    .sort((a, b) => {
      const isAPending = a.verificationStatus === VerificationStatus.PENDING_REVIEW;
      const isBPending = b.verificationStatus === VerificationStatus.PENDING_REVIEW;
      if (isAPending && !isBPending) return -1;
      if (!isAPending && isBPending) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const pendingCount = reports.filter(
    (r) => r.verificationStatus === VerificationStatus.PENDING_REVIEW
  ).length;

  const handleAction = async (reportId: string, action: 'verify' | 'reject') => {
    const statusMap = {
      verify: VerificationStatus.VERIFIED,
      reject: VerificationStatus.REJECTED,
    };
    const newStatus = statusMap[action];
    try {
      await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update DB', err);
    }
    setReports((prev) =>
      prev.map((r) =>
        r.reportId !== reportId
          ? r
          : { ...r, verificationStatus: newStatus, reviewedAt: new Date().toISOString() }
      )
    );
    setSelectedReport(null);
    if (socket) socket.emit('client:update-report-status', { reportId, status: newStatus });
  };

  const handleDuplicateClick = (report: IncomingReport) => {
    setDuplicateModal(report);
    setSelectedDuplicateIncidentId('');
  };

  const handleConfirmDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateModal) return;
    const reportId = duplicateModal.reportId;
    const incidentId = selectedDuplicateIncidentId || undefined;
    try {
      await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, status: VerificationStatus.DUPLICATE, incidentId }),
      });
    } catch (err) {
      console.error('Failed to update DB', err);
    }
    setReports((prev) =>
      prev.map((r) =>
        r.reportId !== reportId
          ? r
          : { ...r, verificationStatus: VerificationStatus.DUPLICATE, reviewedAt: new Date().toISOString() }
      )
    );
    if (socket)
      socket.emit('client:update-report-status', {
        reportId,
        status: VerificationStatus.DUPLICATE,
        incidentId,
      });
    setDuplicateModal(null);
    setSelectedReport(null);
  };

  const handleElevate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport || isElevating) return;
    setIsElevating(true);

    const payload = {
      sourceReportId: selectedReport.reportId,
      title: incidentForm.title,
      severity: incidentForm.severity,
      affectedPeople: incidentForm.affectedPeople,
      latitude: selectedReport.latitude,
      longitude: selectedReport.longitude,
      district: selectedReport.district,
      disasterType: selectedReport.disasterType,
    };

    try {
      await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selectedReport.reportId,
          status: VerificationStatus.CONVERTED_TO_INCIDENT,
        }),
      });
    } catch (err) {
      console.error('Failed to save to database', err);
    }

    setReports((prev) =>
      prev.map((r) =>
        r.reportId === selectedReport.reportId
          ? { ...r, verificationStatus: VerificationStatus.CONVERTED_TO_INCIDENT }
          : r
      )
    );

    if (socket) {
      socket.emit('client:create-incident', payload);
      socket.emit('client:update-report-status', {
        reportId: selectedReport.reportId,
        status: VerificationStatus.CONVERTED_TO_INCIDENT,
      });
    }

    setIsElevating(false);
    setSelectedReport(null);
    setIncidentForm({ title: '', severity: IncidentSeverity.HIGH, affectedPeople: 0 });
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f16] text-white">
      <div className="p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold tracking-tight">Incoming Reports</h1>
              {enforcedDistrict !== 'ALL' && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-bold text-blue-400">
                  <MapPin size={12} /> {enforcedDistrict} Zone Only
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">
              <span className="text-orange-400 font-bold">{pendingCount}</span> reports pending
              review in your jurisdiction
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-2.5 text-xs font-semibold text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              {Object.values(VerificationStatus).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-[#131924] border border-slate-800/80 rounded-lg px-4 py-2.5 text-xs font-semibold text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Sources</option>
              {Object.values(ReportSource).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Reports List */}
          <div className="col-span-2 space-y-3">
            {filtered.map((report, index) => (
              <div
                key={report.reportId || `new-report-${index}`}
                onClick={() => setSelectedReport(report)}
                className={`bg-[#131924] border rounded-xl p-5 cursor-pointer transition-all hover:border-slate-700 ${selectedReport?.reportId === report.reportId
                    ? 'border-blue-500/50 ring-1 ring-blue-500/20'
                    : 'border-slate-800/80'
                  } ${report.verificationStatus === VerificationStatus.PENDING_REVIEW
                    ? 'border-l-4 border-l-orange-500'
                    : ''
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300">{report.reportId}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-widest border ${SOURCE_LABELS[report.source]?.color ||
                        'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                    >
                      {SOURCE_LABELS[report.source]?.label || report.source}
                    </span>
                    {report.mediaUrls && report.mediaUrls.length > 0 && (
                      <Camera size={12} className="text-teal-400" />
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-widest border ${STATUS_STYLES[report.verificationStatus] ||
                      'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                  >
                    {(report.verificationStatus || 'UNKNOWN').replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-3 line-clamp-2">{report.description}</p>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <AlertTriangle size={10} /> {report.disasterType}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> {report.district}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> {new Date(report.createdAt).toLocaleTimeString()}
                  </span>
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
                  <Field
                    label="Source"
                    value={SOURCE_LABELS[selectedReport.source]?.label || selectedReport.source}
                  />
                  <Field label="Type" value={selectedReport.disasterType} />
                  <Field label="District" value={selectedReport.district} />
                  <Field
                    label="Location"
                    value={`${selectedReport.latitude}, ${selectedReport.longitude}`}
                  />
                  <Field label="Contact" value={selectedReport.contact || 'N/A'} />
                  <Field
                    label="Time"
                    value={new Date(selectedReport.createdAt).toLocaleString()}
                  />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">
                      DESCRIPTION
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedReport.description}
                    </p>
                  </div>
                  {selectedReport.mediaUrls && selectedReport.mediaUrls.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2">
                        MEDIA ({selectedReport.mediaUrls.length})
                      </p>
                      <div className="flex gap-2">
                        {selectedReport.mediaUrls.map((url, i) => (
                          <div
                            key={i}
                            className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700"
                          >
                            <Camera size={16} className="text-slate-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedReport.officerNotes && (
                    <Field label="Officer Notes" value={selectedReport.officerNotes} />
                  )}

                  {/* Verify / Reject / Duplicate actions */}
                  {selectedReport.verificationStatus === VerificationStatus.PENDING_REVIEW &&
                    hasPermission('verify:reports') && (
                      <div className="pt-4 border-t border-slate-800/50 space-y-2">
                        <button
                          onClick={() => handleAction(selectedReport.reportId, 'verify')}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-xs font-bold text-green-400 transition-colors"
                        >
                          <CheckCircle2 size={14} /> Verify Report
                        </button>
                        <button
                          onClick={() => handleAction(selectedReport.reportId, 'reject')}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 transition-colors"
                        >
                          <XCircle size={14} /> Reject Report
                        </button>
                        <button
                          onClick={() => handleDuplicateClick(selectedReport)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg text-xs font-bold text-slate-300 transition-colors"
                        >
                          <Copy size={14} /> Mark Duplicate &amp; Link Incident
                        </button>
                      </div>
                    )}

                  {/* Elevate to Incident */}
                  {selectedReport.verificationStatus === VerificationStatus.VERIFIED &&
                    hasPermission('approve:incidents') && (
                      <div className="pt-4 border-t border-slate-800/50 mt-4">
                        {!isElevating ? (
                          <button
                            onClick={() => setIsElevating(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-xs font-bold text-purple-400 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                          >
                            <AlertTriangle size={14} /> Elevate to Active Incident
                          </button>
                        ) : (
                          <form
                            onSubmit={handleElevate}
                            className="space-y-3 bg-[#0a0f16] p-4 rounded-lg border border-purple-500/30"
                          >
                            <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">
                              Configure Incident
                            </h4>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1 font-bold tracking-widest">
                                INCIDENT TITLE
                              </label>
                              <input
                                type="text"
                                required
                                value={incidentForm.title}
                                onChange={(e) =>
                                  setIncidentForm({ ...incidentForm, title: e.target.value })
                                }
                                className="w-full bg-[#131924] border border-slate-700 rounded px-3 py-2 text-xs focus:border-purple-500 outline-none text-white"
                                placeholder="e.g., Kaduwela Flash Flood"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1 font-bold tracking-widest">
                                SEVERITY
                              </label>
                              <select
                                value={incidentForm.severity}
                                onChange={(e) =>
                                  setIncidentForm({
                                    ...incidentForm,
                                    severity: e.target.value as IncidentSeverity,
                                  })
                                }
                                className="w-full bg-[#131924] border border-slate-700 rounded px-3 py-2 text-xs focus:border-purple-500 outline-none text-white"
                              >
                                {Object.values(IncidentSeverity).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1 font-bold tracking-widest">
                                EST. AFFECTED PEOPLE
                              </label>
                              <input
                                type="number"
                                required
                                min="0"
                                value={incidentForm.affectedPeople}
                                onChange={(e) =>
                                  setIncidentForm({
                                    ...incidentForm,
                                    affectedPeople: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full bg-[#131924] border border-slate-700 rounded px-3 py-2 text-xs focus:border-purple-500 outline-none text-white"
                              />
                            </div>
                            <div className="flex gap-2 pt-3 border-t border-slate-800/50 mt-2">
                              <button
                                type="button"
                                onClick={() => setIsElevating(false)}
                                className="flex-1 py-2 bg-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="flex-1 py-2 bg-purple-600 rounded-lg text-xs font-bold text-white hover:bg-purple-500 transition-colors"
                              >
                                Confirm Elevation
                              </button>
                            </div>
                          </form>
                        )}
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

      {/* ── Duplicate-Link Modal ─────────────────────────────────── */}
      {duplicateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131924] border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/80 bg-slate-800/30 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Copy size={16} className="text-slate-400" />
                Mark as Duplicate
              </h3>
              <button
                onClick={() => setDuplicateModal(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDuplicate} className="p-6 space-y-5">
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/60">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Report Being Duplicated
                </p>
                <p className="text-sm font-semibold text-slate-200 truncate">
                  {duplicateModal?.reportId}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                  {duplicateModal?.description}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Link to Existing Incident
                  <span className="ml-1 text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <select
                  value={selectedDuplicateIncidentId}
                  onChange={(e) => setSelectedDuplicateIncidentId(e.target.value)}
                  className="w-full bg-[#0a0f16] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
                >
                  <option value="">— No link (mark duplicate only) —</option>
                  {activeIncidents.map((inc: any) => (
                    <option key={inc.incident_id ?? inc.id ?? Math.random()} value={inc.incident_id ?? inc.id}>
                      [{inc.severity ?? ''}] {inc.title}
                    </option>
                  ))}
                </select>
                {activeIncidents.length === 0 && (
                  <p className="text-[10px] text-slate-600 mt-1.5">
                    No active incidents found to link to.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <Link2 size={14} className="text-amber-400 shrink-0" />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  This report will be marked <span className="font-bold">DUPLICATE</span> and
                  optionally linked to the selected incident for audit tracking.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDuplicateModal(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500 rounded-lg text-xs font-bold text-white transition-colors"
                >
                  Confirm Duplicate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">
        {label}
      </p>
      <p className="text-xs text-slate-300">{value}</p>
    </div>
  );
}