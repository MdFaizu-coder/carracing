import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Flag, Trophy, Clock, AlertTriangle, ShieldCheck, CheckCircle2, ChevronRight, Share2, Copy } from 'lucide-react';
import { RaceFinishResult } from '../types';

interface ResultViewProps {
  result: RaceFinishResult;
  onViewLeaderboard: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  onViewLeaderboard
}) => {
  useEffect(() => {
    // Fire confetti fanfare on mount
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 350);
    } catch {
      // safe fallback
    }
  }, []);

  const formatMs = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const mmm = Math.floor(ms % 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`;
  };

  const copyResultText = () => {
    const text = `🏁 Tech Event Car Racing Challenge Result
Team: ${result.teamName}
Laps: ${result.lapsCompleted}/10
Race Time: ${formatMs(result.raceTimeMs)}
Penalties: +${result.penaltyTimeMs / 1000}s
Official Final Time: ${formatMs(result.finalTimeMs)}
Status: ${result.resultStatus}`;
    navigator.clipboard.writeText(text);
    alert('Race result summary copied to clipboard!');
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>OFFICIAL FINISH VERIFIED</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase text-white font-['Chakra_Petch'] tracking-wide">
            🏁 RACE COMPLETED
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Your race data has been securely verified and submitted to the competition database.
          </p>
        </div>

        {/* Core Result Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-2">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">TEAM</span>
              <div className="text-2xl font-black text-cyan-400 font-['Chakra_Petch'] uppercase tracking-wide">
                {result.teamName}
              </div>
            </div>
            <div className="sm:text-right">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">COMPLETED DISTANCE</span>
              <div className="text-lg font-mono font-black text-white">
                {result.lapsCompleted} / 10 LAPS
              </div>
            </div>
          </div>

          {/* Time Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-cyan-400" />
                Race Time
              </div>
              <div className="text-xl font-mono font-bold text-slate-200">
                {formatMs(result.raceTimeMs)}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Penalties ({result.penaltyCount} hits)
              </div>
              <div className="text-xl font-mono font-bold text-amber-400">
                +{result.penaltyTimeMs / 1000} seconds
              </div>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/40 p-3.5 rounded-xl shadow-inner shadow-emerald-500/10">
              <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Trophy className="w-3 h-3 text-emerald-400" />
                Final Official Time
              </div>
              <div className="text-2xl font-mono font-black text-emerald-400">
                {formatMs(result.finalTimeMs)}
              </div>
            </div>
          </div>

          {/* Status & Cryptographic verification badge */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase text-[11px] text-slate-500">Status:</span>
              <span className={`px-2.5 py-0.5 rounded font-black text-xs uppercase tracking-wider ${
                result.resultStatus === 'VALID'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                {result.resultStatus === 'VALID' ? 'RESULT RECORDED' : 'UNDER REVIEW'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 truncate" title={result.serverHash}>
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Hash: {result.serverHash.slice(0, 16)}...</span>
            </div>
          </div>
        </div>

        {/* Lap-by-Lap Split Times (Accordion / Table) */}
        {result.lapSplits && result.lapSplits.length > 0 && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-6">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Lap Telemetry Breakdown</span>
              <span className="text-[10px] text-slate-500 font-normal">All 10 Laps Completed</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {result.lapSplits.map((split, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800/80 p-2 rounded-lg text-center">
                  <span className="text-[10px] text-slate-500 font-bold block">LAP {i + 1}</span>
                  <span className="font-mono text-slate-200 font-semibold">{formatMs(split)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notice on Reruns */}
        <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-center text-xs text-slate-500 mb-6">
          Official times are permanently recorded. To prevent unfair retries, single-device restarts are disabled unless approved by an event organizer.
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onViewLeaderboard}
            className="w-full sm:flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-98 transition-all"
          >
            <Trophy className="w-5 h-5 text-slate-950" />
            <span>VIEW LEADERBOARD</span>
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={copyResultText}
            className="w-full sm:w-auto px-5 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            <Copy className="w-4 h-4 text-cyan-400" />
            <span>Copy Certificate</span>
          </button>
        </div>
      </div>
    </div>
  );
};
