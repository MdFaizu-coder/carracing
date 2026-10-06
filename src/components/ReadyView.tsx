import React, { useState, useEffect } from 'react';
import { Flag, Play, Shield, AlertTriangle, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { ActiveSession } from '../types';
import { soundManager } from '../audio/soundManager';

interface ReadyViewProps {
  session: ActiveSession;
  penaltyPerHit: number;
  onLaunchRace: (serverStartTime: string) => void;
  onCancel: () => void;
}

export const ReadyView: React.FC<ReadyViewProps> = ({
  session,
  penaltyPerHit,
  onLaunchRace,
  onCancel
}) => {
  const [countdown, setCountdown] = useState<number | 'GO!' | null>(null);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCountdown = async () => {
    setError(null);
    setIsStartingServer(true);

    try {
      // 1. Tell backend to start official server timer
      const res = await fetch('/api/race/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          sessionToken: session.sessionToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start race on server.');
      }

      setIsStartingServer(false);

      // 2. Begin 3 -> 2 -> 1 -> GO! sequence
      runCountdownSequence(data.serverStartTime);
    } catch (err: any) {
      setIsStartingServer(false);
      setError(err.message || 'Network error starting race session.');
    }
  };

  const runCountdownSequence = (serverStartTime: string) => {
    // 3
    setCountdown(3);
    soundManager.playCountdownBeep(false);

    // 2
    setTimeout(() => {
      setCountdown(2);
      soundManager.playCountdownBeep(false);
    }, 900);

    // 1
    setTimeout(() => {
      setCountdown(1);
      soundManager.playCountdownBeep(false);
    }, 1800);

    // GO!
    setTimeout(() => {
      setCountdown('GO!');
      soundManager.playCountdownBeep(true);
    }, 2700);

    // Launch game
    setTimeout(() => {
      onLaunchRace(serverStartTime);
    }, 3400);
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex items-center justify-center p-4">
      {/* Visual countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in select-none">
          <div className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-4 font-mono">
            GET READY • OFFICIAL START
          </div>
          <div className="text-8xl sm:text-9xl font-black font-mono tracking-tight text-white animate-scale-up drop-shadow-[0_0_50px_rgba(6,182,212,0.6)]">
            {countdown === 'GO!' ? (
              <span className="text-emerald-400">GO!</span>
            ) : (
              <span className="text-cyan-400">{countdown}</span>
            )}
          </div>
          <div className="mt-8 flex gap-3">
            {[3, 2, 1].map((num) => (
              <div
                key={num}
                className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                  countdown === 'GO!' || (typeof countdown === 'number' && countdown <= num)
                    ? countdown === 'GO!'
                      ? 'bg-emerald-400 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]'
                      : 'bg-cyan-400 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]'
                    : 'bg-slate-800 border-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Ready Briefing Card */}
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-cyan-500/10 to-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Flag className="w-3.5 h-3.5" />
            <span>Driver Pre-Race Staging</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black uppercase text-white font-['Chakra_Petch'] tracking-wide">
            READY TO RACE?
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Review your session briefing below before initiating countdown.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-600/60 text-xs text-rose-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Registered Team
            </div>
            <div className="text-xl font-black text-cyan-400 tracking-wide font-['Chakra_Petch']">
              {session.teamName}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {session.department}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Official Session ID
            </div>
            <div className="text-lg font-mono font-bold text-white tracking-wider">
              {session.sessionId}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Token Authenticated</span>
            </div>
          </div>
        </div>

        {/* Race Specification Badges */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5 mb-8 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Race Parameters
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Laps</span>
              <span className="text-white font-mono font-black text-base">{session.targetLaps} Laps</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Format</span>
              <span className="text-cyan-400 font-bold text-sm">Single Player</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Obstacles</span>
              <span className="text-amber-400 font-bold text-sm">+{penaltyPerHit}s / Hit</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Timer</span>
              <span className="text-emerald-400 font-bold text-sm">Millisecond</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            ⚠️ <b>Controls & Rules:</b> Steer your red sports car with <b>A/D</b> or <b>←/→</b> arrows between lanes. Accelerate with <b>W/↑</b> and brake with <b>S/↓</b>. Dodge traffic cars, road cones, and barriers to avoid <b>+{penaltyPerHit}s</b> penalties. Complete all {session.targetLaps} laps to record your official time!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={startCountdown}
            disabled={isStartingServer}
            className="w-full sm:flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-cyan-500/25 active:scale-98 transition-all disabled:opacity-50"
          >
            {isStartingServer ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Contacting Server...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>START RACE (3-2-1-GO)</span>
              </>
            )}
          </button>

          <button
            onClick={onCancel}
            disabled={isStartingServer}
            className="w-full sm:w-auto px-6 py-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-sm uppercase tracking-wider transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};
