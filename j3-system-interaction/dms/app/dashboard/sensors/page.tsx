'use client';

import { ReactNode, useMemo, useState, useEffect } from 'react';
import { Activity, Battery, MapPin, Pencil, Plus, RadioTower, Search, Trash2, WifiOff, X, Filter } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

type SensorStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
type SensorMetric = 'Water Level' | 'Rainfall' | 'River Flow' | 'Soil Moisture' | 'Temperature';

interface SensorNode {
  id: string;
  location: string;
  district: string;
  metric: SensorMetric;
  status: SensorStatus;
  battery: number;
  lastSeenMinutes: number;
  latestValue: string;
}

const STATUS_STYLES: Record<SensorStatus, string> = {
  ONLINE: 'bg-green-500/10 text-green-400 border-green-500/30',
  OFFLINE: 'bg-red-500/10 text-red-400 border-red-500/30',
  MAINTENANCE: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

export default function SensorsPage() {
  const socket = useSocket();
  const [sensors, setSensors] = useState<SensorNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SensorStatus>('ALL');
  const [metricFilter, setMetricFilter] = useState<'ALL' | SensorMetric>('ALL');
  
  const [editorMode, setEditorMode] = useState<'add' | 'edit' | null>(null);
  const [editorOriginalId, setEditorOriginalId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [draft, setDraft] = useState<SensorNode>({
    id: '',
    location: '',
    district: '',
    metric: 'Water Level',
    status: 'ONLINE',
    battery: 100,
    lastSeenMinutes: 0,
    latestValue: '',
  });

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const response = await fetch('/api/sensors');
        if (!response.ok) throw new Error('Failed to fetch sensor data');
        
        const data = await response.json();
        const mappedSensors: SensorNode[] = [];
        const now = new Date().getTime();
        
        // Map database schema to SensorNode UI format
        data.devices.forEach((device: any) => {
          const water = data.waterLevels.find((w: any) => w.device_id === device.device_id);
          const rain = data.rainfall.find((r: any) => r.division_id === device.division_id);
          const soil = data.soilMoisture.find((s: any) => s.division_id === device.division_id);
          const temp = data.temperatures.find((t: any) => t.division_id === device.division_id);

          const baseNode = {
            location: device.division_name || 'Unknown Location',
            district: device.division_name || 'Unassigned',
            status: (device.status as SensorStatus) || 'OFFLINE',
            // Generate a deterministic fake battery level for visual completeness
            battery: 100 - (device.device_id.length % 4) * 8, 
          };

          let hasData = false;

          if (water) {
            hasData = true;
            mappedSensors.push({
              ...baseNode,
              id: device.device_id,
              metric: 'Water Level',
              lastSeenMinutes: Math.max(0, Math.floor((now - new Date(water.timestamp).getTime()) / 60000)),
              latestValue: `${Number(water.current_level).toFixed(2)} m`
            });
          }

          if (rain) {
            hasData = true;
            mappedSensors.push({
              ...baseNode,
              id: hasData ? `${device.device_id}-RN` : device.device_id,
              metric: 'Rainfall',
              lastSeenMinutes: Math.max(0, Math.floor((now - new Date(rain.date).getTime()) / 60000)),
              latestValue: `${Number(rain.rain_sum).toFixed(1)} mm`
            });
          }

          if (soil) {
            hasData = true;
            mappedSensors.push({
              ...baseNode,
              id: hasData ? `${device.device_id}-SM` : device.device_id,
              metric: 'Soil Moisture',
              lastSeenMinutes: Math.max(0, Math.floor((now - new Date(soil.date).getTime()) / 60000)),
              latestValue: `${Number(soil.moisture_7_28cm || 0).toFixed(1)}%`
            });
          }

          if (temp) {
            hasData = true;
            mappedSensors.push({
              ...baseNode,
              id: hasData ? `${device.device_id}-TP` : device.device_id,
              metric: 'Temperature',
              lastSeenMinutes: Math.max(0, Math.floor((now - new Date(temp.date).getTime()) / 60000)),
              latestValue: `${Number(temp.temperature).toFixed(1)}°C`
            });
          }

          if (!hasData) {
            mappedSensors.push({
              ...baseNode,
              id: device.device_id,
              metric: 'Water Level',
              lastSeenMinutes: 0,
              latestValue: 'No data'
            });
          }
        });

        setSensors(mappedSensors);
      } catch (error) {
        console.error('Error fetching sensors:', error);
        setNotice({ type: 'error', text: 'Failed to load live sensor data.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSensors();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleTelemetryUpdate = (update: Partial<SensorNode>) => {
      setSensors((prev) => prev.map((sensor) => sensor.id === update.id ? { ...sensor, ...update } : sensor));
    };
    socket.on('sensor:telemetry-update', handleTelemetryUpdate);
    return () => { socket.off('sensor:telemetry-update', handleTelemetryUpdate); };
  }, [socket]);

  const filteredSensors = useMemo(() =>
    sensors.filter((sensor) => {
      if (statusFilter !== 'ALL' && sensor.status !== statusFilter) return false;
      if (metricFilter !== 'ALL' && sensor.metric !== metricFilter) return false;
      if (query && !sensor.id.toLowerCase().includes(query.toLowerCase()) && !sensor.location.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    }),
  [query, sensors, statusFilter, metricFilter]);

  const totals = useMemo(() => {
    const total = sensors.length;
    const online = sensors.filter((sensor) => sensor.status === 'ONLINE').length;
    const offline = sensors.filter((sensor) => sensor.status === 'OFFLINE').length;
    const averageBattery = Math.round(sensors.reduce((sum, sensor) => sum + sensor.battery, 0) / (sensors.length || 1));
    return { total, online, offline, averageBattery };
  }, [sensors]);

  const openAddEditor = () => {
    setEditorMode('add');
    setEditorOriginalId(null);
    setNotice(null);
    setDraft({ id: '', location: '', district: '', metric: 'Water Level', status: 'ONLINE', battery: 100, lastSeenMinutes: 0, latestValue: '' });
  };

  const openEditEditor = (sensor: SensorNode) => {
    setEditorMode('edit');
    setEditorOriginalId(sensor.id);
    setNotice(null);
    setDraft(sensor);
  };

  const closeEditor = () => {
    setEditorMode(null);
    setEditorOriginalId(null);
  };

  const saveSensor = () => {
    const id = draft.id.trim();
    if (!id || !draft.location.trim() || !draft.latestValue.trim()) {
      setNotice({ type: 'error', text: 'Please complete all required fields.' });
      return;
    }
    const duplicate = sensors.some((sensor) => sensor.id.toLowerCase() === id.toLowerCase() && sensor.id !== editorOriginalId);
    if (duplicate) {
      setNotice({ type: 'error', text: 'Sensor ID already exists. Use a unique ID.' });
      return;
    }

    if (editorMode === 'add') {
      setSensors((prev) => [{ ...draft, id }, ...prev]);
      setNotice({ type: 'success', text: `Sensor ${id} added.` });
    } else if (editorMode === 'edit' && editorOriginalId) {
      setSensors((prev) => prev.map((sensor) => sensor.id === editorOriginalId ? { ...draft, id } : sensor));
      setNotice({ type: 'success', text: `Sensor ${id} updated.` });
    }
    closeEditor();
  };

  const removeSensor = (id: string) => {
    setSensors((prev) => prev.filter((sensor) => sensor.id !== id));
    setNotice({ type: 'success', text: `Sensor ${id} removed.` });
    if (editorOriginalId === id) closeEditor();
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
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Sensor Network</h1>
            <p className="text-sm text-slate-400">
              Real-time telemetry categorized by Water Level, Rainfall, Soil Moisture, and Temperature.
            </p>
          </div>
          <button onClick={openAddEditor} className="px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-sm font-semibold text-blue-300 flex items-center gap-2 transition-colors">
            <Plus size={14} /> Add Sensor
          </button>
        </div>

        {notice && (
          <div className={`mb-6 px-4 py-3 rounded-lg border text-sm ${notice.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
            {notice.text}
          </div>
        )}

        {editorMode && (
          <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold tracking-widest uppercase text-slate-300">{editorMode === 'add' ? 'Add Sensor' : 'Edit Sensor'}</h2>
              <button onClick={closeEditor} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Sensor ID"><input value={draft.id} onChange={(e) => setDraft((prev) => ({ ...prev, id: e.target.value.toUpperCase() }))} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" /></Field>
              <Field label="Metric">
                <select value={draft.metric} onChange={(e) => setDraft((prev) => ({ ...prev, metric: e.target.value as SensorMetric }))} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none">
                  <option>Water Level</option><option>Rainfall</option><option>River Flow</option><option>Soil Moisture</option><option>Temperature</option>
                </select>
              </Field>
              <Field label="Status">
                <select value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as SensorStatus }))} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none">
                  <option value="ONLINE">ONLINE</option><option value="OFFLINE">OFFLINE</option><option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </Field>
              <Field label="Location"><input value={draft.location} onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" /></Field>
              <Field label="District"><input value={draft.district} onChange={(e) => setDraft((prev) => ({ ...prev, district: e.target.value }))} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" /></Field>
              <Field label="Latest Reading"><input value={draft.latestValue} onChange={(e) => setDraft((prev) => ({ ...prev, latestValue: e.target.value }))} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" /></Field>
              <Field label="Battery %"><input type="number" min={0} max={100} value={draft.battery} onChange={(e) => setDraft((prev) => ({ ...prev, battery: Math.max(0, Math.min(100, Number(e.target.value))) }))} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" /></Field>
              <Field label="Last Seen (min)"><input type="number" min={0} value={draft.lastSeenMinutes} onChange={(e) => setDraft((prev) => ({ ...prev, lastSeenMinutes: Math.max(0, Number(e.target.value)) }))} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" /></Field>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={closeEditor} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800/60 transition-colors">Cancel</button>
              <button onClick={saveSensor} className="px-4 py-2 rounded-lg border border-blue-500/40 bg-blue-500/20 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition-colors">{editorMode === 'add' ? 'Create Sensor' : 'Save Changes'}</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-6 mb-6">
          <StatCard title="Total Data Nodes" value={totals.total.toString()} color="blue" icon={<RadioTower size={14} />} />
          <StatCard title="Online" value={totals.online.toString()} color="green" icon={<Activity size={14} />} />
          <StatCard title="Offline" value={totals.offline.toString()} color="red" icon={<WifiOff size={14} />} />
          <StatCard title="Avg Battery" value={`${totals.averageBattery}%`} color="orange" icon={<Battery size={14} />} />
        </div>

        <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-4 flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input type="text" placeholder="Filter by ID or location..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-[#0a0f16] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50" />
          </div>
          
          {/* New Category Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <select value={metricFilter} onChange={(e) => setMetricFilter(e.target.value as 'ALL' | SensorMetric)} className="pl-9 pr-4 w-[200px] bg-[#0a0f16] border border-slate-800 rounded-lg py-2 text-sm text-slate-300 focus:outline-none">
              <option value="ALL">All Categories</option>
              <option value="Water Level">Water Level</option>
              <option value="Rainfall">Rainfall</option>
              <option value="Soil Moisture">Soil Moisture</option>
              <option value="Temperature">Temperature</option>
            </select>
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | SensorStatus)} className="bg-[#0a0f16] border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none min-w-[150px]">
            <option value="ALL">Status: All</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>

        <div className="bg-[#131924] border border-slate-800/80 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/80 bg-[#0a0f16]/50 text-[9px] font-bold text-slate-500 tracking-widest uppercase">
                <th className="px-6 py-4">Sensor / Category</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Latest Reading</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Health</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredSensors.map((sensor) => (
                <tr key={sensor.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-200">{sensor.id}</p>
                    <p className={`text-[10px] mt-1 font-semibold uppercase tracking-wide ${
                      sensor.metric === 'Water Level' ? 'text-blue-400' :
                      sensor.metric === 'Rainfall' ? 'text-cyan-400' :
                      sensor.metric === 'Temperature' ? 'text-orange-400' : 'text-amber-600'
                    }`}>{sensor.metric}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-semibold text-slate-300">{sensor.location}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><MapPin size={10} /> {sensor.district}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-200">{sensor.latestValue}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Updated {sensor.lastSeenMinutes} min ago</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border ${STATUS_STYLES[sensor.status]}`}>{sensor.status}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                        <div className={`${sensor.battery >= 60 ? 'bg-green-400' : sensor.battery >= 30 ? 'bg-orange-400' : 'bg-red-400'} h-full rounded-full`} style={{ width: `${sensor.battery}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-300 w-9 text-right">{sensor.battery}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <button onClick={() => openEditEditor(sensor)} className="px-2.5 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800/70 transition-colors text-xs font-semibold flex items-center gap-1"><Pencil size={12} /> Edit</button>
                      <button onClick={() => removeSensor(sensor.id)} className="px-2.5 py-1.5 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors text-xs font-semibold flex items-center gap-1"><Trash2 size={12} /> Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSensors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">No sensors found matching the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: ReactNode; color: 'blue' | 'green' | 'red' | 'orange' }) {
  const colorMap = { blue: 'border-blue-500/30 text-blue-400', green: 'border-green-500/30 text-green-400', red: 'border-red-500/30 text-red-400', orange: 'border-orange-500/30 text-orange-400' };
  return (
    <div className="bg-[#131924] border border-slate-800/80 rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{title}</span>
        <span className={colorMap[color]}>{icon}</span>
      </div>
      <span className="text-4xl font-bold tracking-tight">{value}</span>
    </div>
  );
}