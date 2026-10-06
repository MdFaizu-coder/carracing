export interface EventConfig {
  eventName: string;
  department: string;
  targetLaps: number;
  penaltySecondsPerHit: number;
  minLapSeconds: number;
  registrationOpen: boolean;
  leaderboardPublic: boolean;
  competitionStatus: 'ACTIVE' | 'PAUSED' | 'FINALIZED';
  totalTeams?: number;
  completedRaces?: number;
}

export interface ParticipantRegistration {
  teamName: string;
  department?: string;
}

export interface ActiveSession {
  participantId: string;
  sessionId: string;
  sessionToken: string;
  teamName: string;
  department: string;
  targetLaps: number;
  status: 'READY' | 'RACING' | 'FINISHED' | 'DISQUALIFIED';
  startedAt?: string;
}

export interface LapSplit {
  lap: number;
  timeMs: number;
  splitFormatted: string;
}

export interface RaceFinishResult {
  sessionId: string;
  teamName: string;
  lapsCompleted: number;
  raceTimeMs: number;
  penaltyCount: number;
  penaltyTimeMs: number;
  finalTimeMs: number;
  resultStatus: 'VALID' | 'FLAGGED_REVIEW' | 'DISQUALIFIED';
  validationNotes: string;
  serverHash: string;
  isFlagged: boolean;
  lapSplits?: number[];
}

export interface LeaderboardEntry {
  rank: number;
  sessionId: string;
  teamName: string;
  department: string;
  laps: number;
  raceTimeMs: number;
  penaltyTimeMs: number;
  finalTimeMs: number;
  completedAt: string;
  verified: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  role: string;
}

export interface AdminOverviewMetrics {
  totalRegistered: number;
  racingNow: number;
  finishedValid: number;
  flaggedCount: number;
  disqualifiedCount: number;
  bestRecord: number;
}

export interface AdminSessionItem {
  id: string;
  participant_id: string;
  team_name: string;
  department: string;
  status: 'REGISTERED' | 'READY' | 'RACING' | 'FINISHED' | 'DISQUALIFIED' | 'RERUN_APPROVED';
  started_at: string | null;
  completed_at: string | null;
  laps_completed: number;
  race_time_ms: number;
  penalty_time_ms: number;
  final_time_ms: number;
  result_status: 'PENDING' | 'VALIDATING' | 'VALID' | 'FLAGGED_REVIEW' | 'DISQUALIFIED';
  validation_notes: string | null;
  created_at: string;
}

export interface AdminActionLog {
  id: string;
  admin_username: string;
  action: string;
  target_id: string;
  details: string;
  timestamp: string;
}
