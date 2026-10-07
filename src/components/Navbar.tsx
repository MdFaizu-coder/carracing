import React, { useState } from 'react';
import { Volume2, VolumeX, Shield, Trophy, Flag, Car } from 'lucide-react';
import { soundManager } from '../audio/soundManager';

interface NavbarProps {
  currentView: 'LANDING' | 'READY' | 'GAME' | 'RESULT' | 'LEADERBOARD' | 'ADMIN';
  onNavigate: (view: 'LANDING' | 'LEADERBOARD' | 'ADMIN') => void;
  targetLaps: number;
  competitionStatus?: string;
  isAdminLoggedIn: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  targetLaps,
  competitionStatus = 'ACTIVE',
  isAdminLoggedIn
}) => {
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  const handleToggleSound = () => {
    const next = soundManager.toggleMute();
    setIsMuted(next);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => onNavigate('LANDING')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-wider text-white font-['Chakra_Petch'] uppercase">
                TECH RACE <span className="text-cyan-400">CHALLENGE</span>
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                {competitionStatus}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
              College Department Tech Event • {targetLaps}-Lap Time Trial
            </div>
          </div>
        </div>

        {/* Center / Right actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mute button */}
          <button
            onClick={handleToggleSound}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Quick nav: Leaderboard */}
          <button
            onClick={() => onNavigate('LEADERBOARD')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
              currentView === 'LEADERBOARD'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Leaderboard</span>
          </button>

          {/* Quick nav: Admin Portal */}
          <button
            onClick={() => onNavigate('ADMIN')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
              currentView === 'ADMIN'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isAdminLoggedIn ? 'Admin Panel' : 'Admin'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
