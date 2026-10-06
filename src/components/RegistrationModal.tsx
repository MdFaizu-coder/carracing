import React, { useState } from 'react';
import { X, Car, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { ActiveSession } from '../types';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: (session: ActiveSession) => void;
  targetLaps: number;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegistered,
  targetLaps
}) => {
  const [teamName, setTeamName] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = teamName.trim();
    if (!trimmed) {
      setError('Please enter a team name to proceed.');
      return;
    }

    if (trimmed.length < 2) {
      setError('Team name must have at least 2 characters.');
      return;
    }

    if (trimmed.length > 30) {
      setError('Team name cannot exceed 30 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: trimmed,
          department: department.trim() || 'General Participant'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      onRegistered({
        participantId: data.participantId,
        sessionId: data.sessionId,
        sessionToken: data.sessionToken,
        teamName: data.teamName,
        department: data.department,
        targetLaps,
        status: 'READY'
      });
    } catch (err: any) {
      setError(err.message || 'Network error connecting to competition server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
              Team Registration
            </h2>
            <p className="text-xs text-slate-400">
              Official Driver Entry • {targetLaps} Laps Time Trial
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/70 border border-rose-600/50 flex items-start gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Enter Team Name <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={30}
              placeholder="e.g. TEAM ALPHA, CYBER VORTEX"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-white placeholder-slate-500 text-sm font-semibold tracking-wide transition-all uppercase outline-none"
              autoFocus
            />
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
              <span>Max 30 characters</span>
              <span>{teamName.trim().length} / 30</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              College Department / Club / Section (Optional)
            </label>
            <input
              type="text"
              maxLength={40}
              placeholder="e.g. CSE-A, AI Club, Mechanical Dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-white placeholder-slate-500 text-sm tracking-wide transition-all outline-none"
            />
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-[11px] uppercase">
              <span>Race Guidelines</span>
            </div>
            <p className="text-[11px]">
              • Single-player race starts as soon as you confirm readiness.
            </p>
            <p className="text-[11px]">
              • Each obstacle collision incurs a penalty. Stay on tarmac!
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-98 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Race Session...</span>
              </>
            ) : (
              <>
                <span>CONTINUE</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
