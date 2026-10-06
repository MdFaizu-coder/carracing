import React, { useState } from 'react';
import { RacingCanvas } from '../game/RacingCanvas';
import { ActiveSession, RaceFinishResult } from '../types';
import { AlertCircle, Loader2, ArrowLeft, RotateCcw } from 'lucide-react';

interface GameViewProps {
  session: ActiveSession;
  penaltyPerHit: number;
  onFinishRace: (result: RaceFinishResult) => void;
  onAbortRace: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  session,
  penaltyPerHit,
  onFinishRace,
  onAbortRace
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastFinishedData, setLastFinishedData] = useState<{
    raceTimeMs: number;
    penaltyCount: number;
    lapSplits: number[];
  } | null>(null);

  const handleRaceComplete = async (data: {
    raceTimeMs: number;
    penaltyCount: number;
    lapSplits: number[];
  }) => {
    setLastFinishedData(data);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/race/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          sessionToken: session.sessionToken,
          lapsCompleted: session.targetLaps,
          reportedRaceTimeMs: Math.round(data.raceTimeMs),
          penaltyCount: data.penaltyCount,
          lapSplits: data.lapSplits
        })
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Failed to submit official race results.');
      }

      onFinishRace({
        sessionId: resData.sessionId,
        teamName: resData.teamName,
        lapsCompleted: resData.lapsCompleted,
        raceTimeMs: resData.raceTimeMs,
        penaltyCount: resData.penaltyCount,
        penaltyTimeMs: resData.penaltyTimeMs,
        finalTimeMs: resData.finalTimeMs,
        resultStatus: resData.resultStatus,
        validationNotes: resData.validationNotes,
        serverHash: resData.serverHash,
        isFlagged: resData.isFlagged,
        lapSplits: data.lapSplits
      });
    } catch (err: any) {
      setSubmitError(
        err.message ||
        'Unable to connect to the competition server. Your race result is saved locally. Please click Retry Submission.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetrySubmit = () => {
    if (lastFinishedData) {
      handleRaceComplete(lastFinishedData);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 lg:px-6 py-4 flex flex-col items-center">
      {/* Top Banner info */}
      <div className="w-full flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TEAM:</span>
          <span className="text-sm font-black text-cyan-400 uppercase font-['Chakra_Petch']">
            {session.teamName}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-[11px] font-mono text-slate-500">{session.sessionId}</span>
        </div>

        <button
          onClick={() => {
            if (confirm('Are you sure you want to exit the current race? Any incomplete progress will be discarded.')) {
              onAbortRace();
            }
          }}
          className="text-xs text-slate-500 hover:text-rose-400 transition-colors uppercase font-bold"
        >
          Abort Race
        </button>
      </div>

      {/* Network Submission Error Notification with Retry */}
      {submitError && (
        <div className="w-full mb-3 p-4 bg-rose-950/90 border border-rose-600/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-200 text-xs shadow-xl animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-sm">Server Submission Delayed</p>
              <p className="text-rose-200/90 mt-0.5">{submitError}</p>
            </div>
          </div>
          <button
            onClick={handleRetrySubmit}
            disabled={submitting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg uppercase tracking-wide flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            <span>Retry Submission</span>
          </button>
        </div>
      )}

      {/* Loading Overlay when finishing race */}
      {submitting && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mb-4" />
          <h2 className="text-xl font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
            Validating Race Telemetry...
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Running server anti-cheat checksum & calculating final standings
          </p>
        </div>
      )}

      {/* Racing Canvas Engine */}
      <RacingCanvas
        targetLaps={session.targetLaps}
        penaltyPerHit={penaltyPerHit}
        onRaceFinished={handleRaceComplete}
        isCountdownActive={false}
        isPaused={submitting}
      />
    </div>
  );
};
