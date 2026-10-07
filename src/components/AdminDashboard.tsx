import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Flag, Trophy, AlertTriangle, Download, RefreshCw,
  Search, Settings, History, LogOut, CheckCircle2, ChevronRight, Ban, RotateCcw
} from 'lucide-react';
import { AdminOverviewMetrics, AdminSessionItem, AdminActionLog, EventConfig } from '../types';
import { SessionDetailModal } from './SessionDetailModal';

interface AdminDashboardProps {
  adminToken: string;
  adminUsername: string;
  onLogout: () => void;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminToken,
  adminUsername,
  onLogout,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'SESSIONS' | 'SETTINGS' | 'AUDIT'>('SESSIONS');
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Settings State
  const [eventSettings, setEventSettings] = useState<Partial<EventConfig>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      // 1. Overview metrics
      const ovRes = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (ovRes.ok) {
        setMetrics(await ovRes.json());
      }

      // 2. Sessions list
      const sessRes = await fetch(`/api/admin/sessions?search=${encodeURIComponent(search)}&status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData.sessions || []);
      }

      // 3. Settings (if on settings tab)
      const confRes = await fetch('/api/event-config');
      if (confRes.ok) {
        setEventSettings(await confRes.json());
      }

      // 4. Audit logs
      const logRes = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (logRes.ok) {
        const logData = await logRes.json();
        setAuditLogs(logData.logs || []);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [search, statusFilter]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsNotice(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          settings: {
            event_name: eventSettings.eventName,
            department: eventSettings.department,
            target_laps: String(eventSettings.targetLaps),
            penalty_seconds_per_hit: String(eventSettings.penaltySecondsPerHit),
            min_lap_seconds: String(eventSettings.minLapSeconds),
            registration_open: String(eventSettings.registrationOpen),
            leaderboard_public: String(eventSettings.leaderboardPublic),
            competition_status: eventSettings.competitionStatus
          }
        })
      });

      if (res.ok) {
        setSettingsNotice('Event configuration saved successfully.');
        setTimeout(() => setSettingsNotice(null), 3500);
      }
    } catch {
      setSettingsNotice('Failed to update event configuration.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportCsv = () => {
    window.open(`/api/admin/export-csv`, '_blank');
  };

  const formatMs = (ms: number): string => {
    if (!ms) return '00:00.000';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const mmm = Math.floor(ms % 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
              ADMIN CONTROL PANEL
            </h1>
            <p className="text-xs text-slate-400">
              Logged in as <b className="text-cyan-400">{adminUsername}</b> • Event Desk
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* METRICS ROW */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Total Teams</span>
            <span className="text-2xl font-black font-mono text-white">{metrics.totalRegistered}</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Racing Now</span>
            <span className="text-2xl font-black font-mono text-cyan-400">{metrics.racingNow}</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Finished Valid</span>
            <span className="text-2xl font-black font-mono text-emerald-400">{metrics.finishedValid}</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Flagged Review</span>
            <span className="text-2xl font-black font-mono text-amber-400">{metrics.flaggedCount}</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Disqualified</span>
            <span className="text-2xl font-black font-mono text-rose-400">{metrics.disqualifiedCount}</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Course Record</span>
            <span className="text-base font-black font-mono text-amber-400 truncate block mt-1">
              {metrics.bestRecord ? formatMs(metrics.bestRecord) : 'None'}
            </span>
          </div>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-800 gap-6 mb-6">
        <button
          onClick={() => setActiveTab('SESSIONS')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'SESSIONS'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Flag className="w-4 h-4" />
          <span>Participants & Races ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'SETTINGS'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Event Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'AUDIT'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: SESSIONS & RACES */}
      {activeTab === 'SESSIONS' && (
        <div>
          {/* Filter / Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search team, session ID, or department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:border-cyan-500 outline-none"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs font-semibold focus:border-cyan-500 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="RACING">Racing</option>
                <option value="FINISHED">Finished</option>
                <option value="FLAGGED">Review Required</option>
                <option value="READY">Ready</option>
                <option value="DISQUALIFIED">Disqualified</option>
                <option value="RERUN_APPROVED">Rerun Approved</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="py-3 px-4">Session ID</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Laps</th>
                    <th className="py-3 px-4">Raw Time</th>
                    <th className="py-3 px-4">Penalty</th>
                    <th className="py-3 px-4">Final Time</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No participant sessions found matching query.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedSessionId(s.id)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-cyan-400 font-medium">
                          {s.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white font-['Chakra_Petch'] uppercase">
                            {s.team_name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {s.department}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            s.status === 'FINISHED' && s.result_status === 'VALID'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : s.result_status === 'FLAGGED_REVIEW'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : s.status === 'RACING'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse'
                              : s.status === 'DISQUALIFIED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {s.result_status === 'FLAGGED_REVIEW' ? 'REVIEW NEEDED' : s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {s.laps_completed} / 10
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {s.race_time_ms > 0 ? formatMs(s.race_time_ms) : '-'}
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400">
                          {s.penalty_time_ms > 0 ? `+${s.penalty_time_ms / 1000}s` : '0s'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {s.final_time_ms > 0 ? formatMs(s.final_time_ms) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSessionId(s.id);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EVENT SETTINGS */}
      {activeTab === 'SETTINGS' && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-black text-white font-['Chakra_Petch'] uppercase tracking-wide mb-4">
            Event Rules & Competition Parameters
          </h2>

          {settingsNotice && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-950 border border-emerald-500/40 text-xs text-emerald-200">
              {settingsNotice}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Event Name
              </label>
              <input
                type="text"
                value={eventSettings.eventName || ''}
                onChange={(e) => setEventSettings({ ...eventSettings, eventName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Hosting Department / College
              </label>
              <input
                type="text"
                value={eventSettings.department || ''}
                onChange={(e) => setEventSettings({ ...eventSettings, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Target Laps
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={eventSettings.targetLaps || 20}
                  onChange={(e) => setEventSettings({ ...eventSettings, targetLaps: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Penalty / Hit (s)
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={eventSettings.penaltySecondsPerHit || 3}
                  onChange={(e) => setEventSettings({ ...eventSettings, penaltySecondsPerHit: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Min Lap Threshold (s)
                </label>
                <input
                  type="number"
                  min={5}
                  max={20}
                  value={eventSettings.minLapSeconds || 4}
                  onChange={(e) => setEventSettings({ ...eventSettings, minLapSeconds: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>
            </div>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(eventSettings.registrationOpen)}
                  onChange={(e) => setEventSettings({ ...eventSettings, registrationOpen: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded"
                />
                <div>
                  <div className="text-xs font-bold text-white uppercase">Registration Open</div>
                  <div className="text-[10px] text-slate-400">Allow new teams to sign up</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(eventSettings.leaderboardPublic)}
                  onChange={(e) => setEventSettings({ ...eventSettings, leaderboardPublic: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded"
                />
                <div>
                  <div className="text-xs font-bold text-white uppercase">Leaderboard Public</div>
                  <div className="text-[10px] text-slate-400">Show live rankings to players</div>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="mt-4 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save Configuration'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === 'AUDIT' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              System Audit Log
            </span>
            <span className="text-[11px] text-slate-500">
              All organizer overrides & adjustments
            </span>
          </div>
          <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No admin actions logged yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/30">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-400">{log.admin_username}</span>
                      <span className="text-[11px] font-mono text-slate-400">[{log.action}]</span>
                      {log.target_id && (
                        <span className="text-[11px] text-slate-500">→ {log.target_id}</span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5 font-mono">
                      {log.details}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          adminToken={adminToken}
          onClose={() => setSelectedSessionId(null)}
          onActionComplete={fetchDashboardData}
        />
      )}
    </div>
  );
};
