import React, { useState, useEffect } from 'react';
import { Trophy, Search, RefreshCw, ShieldCheck, ArrowLeft, Medal, Clock, AlertTriangle } from 'lucide-react';
import { LeaderboardEntry } from '../types';

interface LeaderboardViewProps {
  onBackToHome: () => void;
  onStartRace?: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  onBackToHome,
  onStartRace
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch leaderboard.');
      }
      setEntries(data.entries || []);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error loading leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLeaderboard();
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatMs = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const mmm = Math.floor(ms % 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`;
  };

  const filteredEntries = entries.filter((e) =>
    e.teamName.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  const top3 = entries.slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 font-semibold mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Event Home</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
                OFFICIAL LEADERBOARD
              </h1>
              <p className="text-xs text-slate-400">
                Live sorted by lowest valid final time • Verified single-player runs
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {autoRefresh ? '● Auto-Live ON' : '○ Auto-Live OFF'}
          </button>

          <button
            onClick={() => {
              setLoading(true);
              fetchLeaderboard();
            }}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh Leaderboard"
            aria-label="Refresh Leaderboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {onStartRace && (
            <button
              onClick={onStartRace}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
            >
              Race Now
            </button>
          )}
        </div>
      </div>

      {/* Empty State Banner when no teams recorded yet */}
      {entries.length === 0 && !loading && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center mb-8 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-['Chakra_Petch'] uppercase tracking-wide mb-2">
            No Race Results Recorded Yet
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6">
            All default benchmark teams have been cleared. Be the first team to enter the circuit, complete 10 laps, and take the #1 spot on the podium!
          </p>
          {onStartRace && (
            <button
              onClick={onStartRace}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
            >
              Register Team & Race Now
            </button>
          )}
        </div>
      )}

      {/* TOP 3 PODIUM CARDS (Shown when entries exist) */}
      {top3.length > 0 && !search && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Rank 2 - Silver */}
          {top3[1] && (
            <div className="order-2 md:order-1 bg-slate-900/60 border border-slate-700/60 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="w-8 h-8 rounded-full bg-slate-400/20 text-slate-200 border border-slate-400/50 flex items-center justify-center font-black text-sm">
                  2
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  SILVER PODIUM
                </span>
              </div>
              <div>
                <h3 className="text-lg font-black text-white font-['Chakra_Petch'] truncate uppercase">
                  {top3[1].teamName}
                </h3>
                <p className="text-xs text-slate-400 truncate mb-3">{top3[1].department}</p>
                <div className="text-2xl font-mono font-black text-slate-200">
                  {formatMs(top3[1].finalTimeMs)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Raw: {formatMs(top3[1].raceTimeMs)} • Pen: +{top3[1].penaltyTimeMs / 1000}s
                </div>
              </div>
            </div>
          )}

          {/* Rank 1 - Gold (Center, Elevated) */}
          {top3[0] && (
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 relative overflow-hidden shadow-xl shadow-amber-500/10 flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start mb-3">
                <span className="w-10 h-10 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500 flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/30">
                  1
                </span>
                <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <Trophy className="w-4 h-4" /> CHAMPION
                </span>
              </div>
              <div>
                <h3 className="text-xl font-black text-white font-['Chakra_Petch'] truncate uppercase">
                  {top3[0].teamName}
                </h3>
                <p className="text-xs text-amber-200/70 truncate mb-3">{top3[0].department}</p>
                <div className="text-3xl font-mono font-black text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                  {formatMs(top3[0].finalTimeMs)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Raw: {formatMs(top3[0].raceTimeMs)} • Pen: +{top3[0].penaltyTimeMs / 1000}s
                </div>
              </div>
            </div>
          )}

          {/* Rank 3 - Bronze */}
          {top3[2] && (
            <div className="order-3 md:order-3 bg-slate-900/60 border border-amber-900/40 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <span className="w-8 h-8 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/50 flex items-center justify-center font-black text-sm">
                  3
                </span>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                  BRONZE PODIUM
                </span>
              </div>
              <div>
                <h3 className="text-lg font-black text-white font-['Chakra_Petch'] truncate uppercase">
                  {top3[2].teamName}
                </h3>
                <p className="text-xs text-slate-400 truncate mb-3">{top3[2].department}</p>
                <div className="text-2xl font-mono font-black text-slate-200">
                  {formatMs(top3[2].finalTimeMs)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Raw: {formatMs(top3[2].raceTimeMs)} • Pen: +{top3[2].penaltyTimeMs / 1000}s
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search team or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-xs focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-3">
          <span>Total Records: <b className="text-slate-300">{entries.length}</b></span>
          {lastUpdated && <span>Updated: {lastUpdated}</span>}
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3.5 px-4 text-center w-16">Rank</th>
                <th className="py-3.5 px-4">Team</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4 text-center">Laps</th>
                <th className="py-3.5 px-4">Raw Time</th>
                <th className="py-3.5 px-4">Penalty</th>
                <th className="py-3.5 px-4">Official Final</th>
                <th className="py-3.5 px-4 text-center w-24">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    {loading ? 'Loading official standings...' : 'No race records found.'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((row) => (
                  <tr
                    key={row.sessionId}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                          row.rank === 1
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                            : row.rank === 2
                            ? 'bg-slate-400/20 text-slate-200 border border-slate-400/50'
                            : row.rank === 3
                            ? 'bg-amber-700/20 text-amber-500 border border-amber-700/50'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white font-['Chakra_Petch'] uppercase tracking-wide">
                        {row.teamName}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-[180px]">
                      {row.department}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-300">
                      {row.laps} / 10
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {formatMs(row.raceTimeMs)}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-400">
                      {row.penaltyTimeMs > 0 ? `+${row.penaltyTimeMs / 1000}s` : '0s'}
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                      {formatMs(row.finalTimeMs)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.verified ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50">
                          <ShieldCheck className="w-3 h-3 text-cyan-400" />
                          <span>Pass</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
