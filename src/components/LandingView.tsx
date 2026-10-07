import React from 'react';
import { Flag, Trophy, ShieldCheck, Zap, Gauge, Users, ArrowRight, Play, AlertTriangle } from 'lucide-react';
import { EventConfig } from '../types';

interface LandingViewProps {
  config: EventConfig;
  onStartRegistration: () => void;
  onViewLeaderboard: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  config,
  onStartRegistration,
  onViewLeaderboard
}) => {
  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/10 to-indigo-600/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 lg:py-16 relative z-10">
        {/* Department Badge */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-cyan-300 text-xs sm:text-sm font-semibold tracking-wide shadow-lg shadow-cyan-500/10 mb-4 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{config.department}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-white font-['Chakra_Petch'] leading-none mb-4">
            {config.eventName.split('Car')[0]}
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
              Car Racing
            </span>{' '}
            <span className="text-white">Challenge</span>
          </h1>

          <p className="max-w-2xl text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
            The official collegiate single-player time-trial motorsport challenge. Master the apexes,
            avoid precision obstacles, and lay down your fastest {config.targetLaps}-lap campaign with server-verified anti-cheat telemetry.
          </p>

          {/* Core Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button
              onClick={onStartRegistration}
              disabled={!config.registrationOpen}
              className={`w-full sm:w-auto px-8 py-4 rounded-xl font-black text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-200 shadow-xl ${
                config.registrationOpen
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/25 hover:scale-105 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{config.registrationOpen ? 'Start Competition' : 'Registration Closed'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={onViewLeaderboard}
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all hover:border-slate-500"
            >
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>View Leaderboard</span>
            </button>
          </div>
        </div>

        {/* Competition Rules & Technical Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm hover:border-cyan-500/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400 mb-3">
              <Flag className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black font-mono text-white mb-1">
              {config.targetLaps} LAPS
            </div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Official Distance
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              High-speed multi-lane highway time trial. Complete all {config.targetLaps} laps while dodging traffic cars and obstacles.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm hover:border-cyan-500/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-blue-950 border border-blue-800/50 flex items-center justify-center text-blue-400 mb-3">
              <Gauge className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black font-mono text-white mb-1">
              HIGH PRECISION
            </div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Millisecond Timer
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Continuous lap telemetry with split delta tracking, off-track physics damping, and drifting friction.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm hover:border-amber-500/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-800/50 flex items-center justify-center text-amber-400 mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-400 mb-1">
              +{config.penaltySecondsPerHit}s / HIT
            </div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Obstacle Penalties
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Cones and safety barriers will add seconds directly to your official final time. Clean lines win races.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm hover:border-emerald-500/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800/50 flex items-center justify-center text-emerald-400 mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 mb-1">
              ANTI-CHEAT
            </div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Server Cryptography
            </div>
            <p className="text-xs text-slate-400 leading-normal">
              Server-issued session tokens, physical threshold verification, wall-clock checks, and audit logging.
            </p>
          </div>
        </div>

        {/* How to Play & Controls Card */}
        <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Driver Controls & Instructions
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Drive using keyboard or on-screen touch controls. Maintain momentum through turns without clipping barriers.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md font-mono text-slate-200">
                <b className="text-cyan-400">W / ↑</b> Accelerate
              </span>
              <span className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md font-mono text-slate-200">
                <b className="text-cyan-400">S / ↓</b> Brake / Reverse
              </span>
              <span className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md font-mono text-slate-200">
                <b className="text-cyan-400">A / D or ← / →</b> Steer
              </span>
              <span className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md font-mono text-slate-200">
                <b className="text-cyan-400">SPACE</b> Drift
              </span>
              <span className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md font-mono text-slate-200">
                <b className="text-amber-400">R</b> Reset Car
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Department Branding */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500">
        Tech Event Car Racing Challenge • Official College Department Motorsport Platform
      </footer>
    </div>
  );
};
