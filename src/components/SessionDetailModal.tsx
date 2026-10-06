import React, { useState, useEffect } from 'react';
import { X, Shield, Clock, AlertTriangle, CheckCircle, RotateCcw, Ban, Loader2 } from 'lucide-react';
import { AdminSessionItem } from '../types';

interface SessionDetailModalProps {
  sessionId: string | null;
  adminToken: string;
  onClose: () => void;
  onActionComplete: () => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  sessionId,
  adminToken,
  onClose,
  onActionComplete
}) => {
  const [session, setSession] = useState<AdminSessionItem | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [penaltyDelta, setPenaltyDelta] = useState(3);
  const [penaltyReason, setPenaltyReason] = useState('Obstacle cut or boundary clip');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    loadDetails();
  }, [sessionId]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        setEvents(data.events || []);
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustPenalty = async (deltaSeconds: number) => {
    if (!sessionId) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/penalty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          sessionId,
          penaltyDeltaMs: deltaSeconds * 1000,
          reason: penaltyReason
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`Penalty adjusted (${deltaSeconds > 0 ? '+' : ''}${deltaSeconds}s)`);
        loadDetails();
        onActionComplete();
      }
    } catch (err: any) {
      setActionMsg('Failed to update penalty: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisqualify = async () => {
    if (!sessionId || !confirm('Are you sure you want to disqualify this participant?')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/disqualify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          sessionId,
          reason: penaltyReason || 'Disqualified by event organizer'
        })
      });
      if (res.ok) {
        setActionMsg('Participant Disqualified.');
        loadDetails();
        onActionComplete();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRerun = async () => {
    if (!sessionId || !confirm('Approve a rerun for this team? This creates a fresh session token for them.')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/approve-rerun', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          sessionId,
          reason: 'Organizing committee authorized rerun'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(`Rerun approved! New Session: ${data.newSessionId}`);
        loadDetails();
        onActionComplete();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidateFlagged = async () => {
    if (!sessionId) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/validate-flagged', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          sessionId,
          note: 'Admin verified and cleared flags.'
        })
      });
      if (res.ok) {
        setActionMsg('Result validated and published to leaderboard.');
        loadDetails();
        onActionComplete();
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (!sessionId) return null;

  const formatMs = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const mmm = Math.floor(ms % 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {loading || !session ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Loading telemetry details...</span>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                <span>Session Inspection</span>
                <span>•</span>
                <span className="font-mono text-slate-400">{session.id}</span>
              </div>
              <h2 className="text-2xl font-black text-white font-['Chakra_Petch'] uppercase">
                {session.team_name}
              </h2>
              <p className="text-xs text-slate-400">{session.department}</p>
            </div>

            {actionMsg && (
              <div className="mb-4 p-3 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-xs text-cyan-200">
                {actionMsg}
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Status</span>
                <span className="text-xs font-bold text-cyan-400 uppercase">{session.status}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Laps</span>
                <span className="text-sm font-mono font-bold text-white">{session.laps_completed} / 10</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Raw Time</span>
                <span className="text-sm font-mono text-slate-300">{formatMs(session.race_time_ms)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Final Time</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{formatMs(session.final_time_ms)}</span>
              </div>
            </div>

            {session.validation_notes && (
              <div className="mb-6 p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300">
                <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">Validation Notes</span>
                <span>{session.validation_notes}</span>
              </div>
            )}

            {/* Admin Actions Panel */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl mb-6 space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Administrative Actions
              </span>

              {/* Adjust Penalty */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Reason for adjustment"
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                />
                <button
                  onClick={() => handleAdjustPenalty(3)}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-lg text-xs font-bold whitespace-nowrap"
                >
                  +3s Penalty
                </button>
                <button
                  onClick={() => handleAdjustPenalty(-3)}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs font-bold whitespace-nowrap"
                >
                  -3s Penalty
                </button>
              </div>

              {/* Status overrides */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                {session.result_status === 'FLAGGED_REVIEW' && (
                  <button
                    onClick={handleValidateFlagged}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Approve & Validate</span>
                  </button>
                )}

                <button
                  onClick={handleApproveRerun}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Authorize Rerun</span>
                </button>

                {session.status !== 'DISQUALIFIED' && (
                  <button
                    onClick={handleDisqualify}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Disqualify Team</span>
                  </button>
                )}
              </div>
            </div>

            {/* Audit Trail Events */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Session Audit Events ({events.length})
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {events.map((ev, i) => (
                  <div key={i} className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-[11px] flex justify-between items-center">
                    <div>
                      <span className="font-bold text-cyan-400 mr-2">[{ev.event_type}]</span>
                      <span className="text-slate-400">{ev.metadata ? ev.metadata.slice(0, 70) : ''}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(ev.event_timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
