import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDatabase, queryAll, queryOne, runQuery, hashPassword } from './db';

export const apiRouter = Router();

// In-memory admin session store (session tokens mapped to admin info)
const activeAdminTokens = new Map<string, { adminId: string; username: string; role: string; expiresAt: number }>();

// Auth middleware for admin endpoints
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.admin_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
  }

  const session = activeAdminTokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeAdminTokens.delete(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  (req as any).admin = session;
  next();
}

// -------------------------------------------------------------
// PUBLIC & PARTICIPANT ENDPOINTS
// -------------------------------------------------------------

// 1. Get Event Configuration & Status
apiRouter.get('/event-config', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const rows = queryAll(db, 'SELECT key, value FROM event_settings');
    const config: Record<string, string> = {};
    rows.forEach(r => { config[r.key] = r.value; });

    // Also get fast summary counts
    const totalTeams = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM participants')?.count || 0;
    const completedRaces = queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM race_sessions WHERE status = 'FINISHED' AND result_status = 'VALID'")?.count || 0;

    res.json({
      eventName: config['event_name'] || 'Tech Event Car Racing Challenge',
      department: config['department'] || 'Department of Computer Science and Data Science',
      targetLaps: parseInt(config['target_laps'] || '20', 10),
      penaltySecondsPerHit: parseInt(config['penalty_seconds_per_hit'] || '3', 10),
      minLapSeconds: parseInt(config['min_lap_seconds'] || '4', 10),
      registrationOpen: config['registration_open'] === 'true',
      leaderboardPublic: config['leaderboard_public'] === 'true',
      competitionStatus: config['competition_status'] || 'ACTIVE',
      totalTeams,
      completedRaces
    });
  } catch (err: any) {
    console.error('Error in /event-config:', err);
    res.status(500).json({ error: 'Unable to load event settings' });
  }
});

// 2. Participant Team Registration
apiRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { teamName, department } = req.body;

    if (!teamName || typeof teamName !== 'string') {
      return res.status(400).json({ error: 'Team name is required.' });
    }

    const trimmedName = teamName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      return res.status(400).json({ error: 'Team name must be between 2 and 30 characters.' });
    }

    // Check if registration is open
    const regSetting = queryOne(db, "SELECT value FROM event_settings WHERE key = 'registration_open'");
    if (regSetting?.value !== 'true') {
      return res.status(403).json({ error: 'Registration is currently closed by event organizers.' });
    }

    // Check if team already exists
    let participant = queryOne<{ id: string; team_name: string }>(
      db,
      'SELECT id, team_name FROM participants WHERE LOWER(team_name) = LOWER(?)',
      [trimmedName]
    );

    let participantId: string;

    if (!participant) {
      // Create new participant
      participantId = crypto.randomUUID();
      const now = new Date().toISOString();
      runQuery(
        db,
        'INSERT INTO participants (id, team_name, department, created_at) VALUES (?, ?, ?, ?)',
        [participantId, trimmedName, (department || 'Tech Event Participant').trim(), now]
      );
    } else {
      participantId = participant.id;

      // Check if existing participant has an active or completed session
      const existingSession = queryOne<{ id: string; status: string; result_status: string }>(
        db,
        'SELECT id, status, result_status FROM race_sessions WHERE participant_id = ? ORDER BY created_at DESC LIMIT 1',
        [participantId]
      );

      if (existingSession) {
        if (existingSession.status === 'FINISHED' && existingSession.result_status === 'VALID') {
          return res.status(409).json({
            error: 'Team has already finished an official race. Contact organizer if you need a rerun authorization.',
            existingSessionId: existingSession.id
          });
        }
        if (existingSession.status === 'DISQUALIFIED') {
          return res.status(403).json({
            error: 'This team has been disqualified. Contact the event admin desk.',
            existingSessionId: existingSession.id
          });
        }
      }
    }

    // Create a new race session
    const sessionId = 'SESSION-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const sessionToken = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();

    runQuery(
      db,
      `INSERT INTO race_sessions (
        id, participant_id, session_token, status, result_status, created_at
      ) VALUES (?, ?, ?, 'READY', 'PENDING', ?)`,
      [sessionId, participantId, sessionToken, now]
    );

    // Record audit event
    const eventId = crypto.randomUUID();
    runQuery(
      db,
      `INSERT INTO race_events (id, race_session_id, event_type, event_timestamp, metadata) VALUES (?, ?, ?, ?, ?)`,
      [eventId, sessionId, 'REGISTERED', now, JSON.stringify({ teamName: trimmedName })]
    );

    res.json({
      success: true,
      participantId,
      sessionId,
      sessionToken,
      teamName: trimmedName,
      department: department || 'General'
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error registering team. Please try again.' });
  }
});

// 3. Official Race Start Confirmation
apiRouter.post('/race/start', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { sessionId, sessionToken } = req.body;

    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'Session ID and token are required.' });
    }

    const session = queryOne<{ id: string; status: string }>(
      db,
      'SELECT id, status FROM race_sessions WHERE id = ? AND session_token = ?',
      [sessionId, sessionToken]
    );

    if (!session) {
      return res.status(404).json({ error: 'Invalid race session credentials.' });
    }

    if (session.status === 'FINISHED' || session.status === 'DISQUALIFIED') {
      return res.status(400).json({ error: `Cannot start race. Current session state: ${session.status}` });
    }

    const now = new Date().toISOString();
    runQuery(
      db,
      "UPDATE race_sessions SET status = 'RACING', started_at = ? WHERE id = ?",
      [now, sessionId]
    );

    const eventId = crypto.randomUUID();
    runQuery(
      db,
      "INSERT INTO race_events (id, race_session_id, event_type, event_timestamp, metadata) VALUES (?, ?, 'START', ?, ?)",
      [eventId, sessionId, now, JSON.stringify({ startedAt: now })]
    );

    res.json({
      success: true,
      serverStartTime: now,
      status: 'RACING'
    });
  } catch (err: any) {
    console.error('Race start error:', err);
    res.status(500).json({ error: 'Failed to record official race start.' });
  }
});

// 4. Official Race Result Submission & Anti-Cheat Validation
apiRouter.post('/race/finish', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const {
      sessionId,
      sessionToken,
      lapsCompleted,
      reportedRaceTimeMs,
      penaltyCount,
      lapSplits,
      checksum
    } = req.body;

    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'Session credentials missing.' });
    }

    const session = queryOne<{
      id: string;
      status: string;
      started_at: string;
      result_status: string;
      team_name: string;
    }>(
      db,
      `SELECT s.id, s.status, s.started_at, s.result_status, p.team_name
       FROM race_sessions s
       JOIN participants p ON s.participant_id = p.id
       WHERE s.id = ? AND s.session_token = ?`,
      [sessionId, sessionToken]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found or invalid token.' });
    }

    if (session.status === 'FINISHED') {
      return res.status(409).json({ error: 'This race session has already been finalized and recorded.' });
    }

    if (session.status === 'DISQUALIFIED') {
      return res.status(403).json({ error: 'This session has been marked as disqualified.' });
    }

    if (!session.started_at) {
      return res.status(400).json({ error: 'Race was never officially started on the server.' });
    }

    // Retrieve settings
    const targetLapsSetting = queryOne(db, "SELECT value FROM event_settings WHERE key = 'target_laps'");
    const targetLaps = parseInt(targetLapsSetting?.value || '20', 10);

    const minLapSecondsSetting = queryOne(db, "SELECT value FROM event_settings WHERE key = 'min_lap_seconds'");
    const minLapSeconds = parseInt(minLapSecondsSetting?.value || '4', 10);

    const penaltySecSetting = queryOne(db, "SELECT value FROM event_settings WHERE key = 'penalty_seconds_per_hit'");
    const penaltySecPerHit = parseInt(penaltySecSetting?.value || '3', 10);

    // ANTI-CHEAT VALIDATIONS
    let validationNotes = 'Passed automated server checks.';
    let isFlagged = false;

    // 1. Lap Count Check
    if (Number(lapsCompleted) !== targetLaps) {
      isFlagged = true;
      validationNotes = `Incomplete laps submitted: ${lapsCompleted}/${targetLaps}.`;
    }

    // 2. Minimum Lap Time Physics Threshold Check
    const minPossibleRaceTimeMs = targetLaps * minLapSeconds * 1000;
    if (reportedRaceTimeMs < minPossibleRaceTimeMs) {
      isFlagged = true;
      validationNotes = `Sub-physical time anomaly: ${reportedRaceTimeMs}ms is below absolute circuit limit (${minPossibleRaceTimeMs}ms).`;
    }

    // 3. Wall clock check against server start time
    const serverStartMs = new Date(session.started_at).getTime();
    const serverElapsedMs = Date.now() - serverStartMs;

    // Client time cannot exceed server elapsed time by more than 3 seconds (allowing small clock skew)
    if (reportedRaceTimeMs > serverElapsedMs + 3500) {
      isFlagged = true;
      validationNotes = `Timing desync: reported ${reportedRaceTimeMs}ms exceeds server elapsed ${serverElapsedMs}ms.`;
    }

    // 4. Lap split array check
    if (Array.isArray(lapSplits) && lapSplits.length === targetLaps) {
      for (let i = 0; i < lapSplits.length; i++) {
        if (lapSplits[i] < minLapSeconds * 1000) {
          isFlagged = true;
          validationNotes = `Lap ${i + 1} split (${lapSplits[i]}ms) is under minimum lap threshold.`;
          break;
        }
      }
    }

    const safePenaltyCount = Math.max(0, parseInt(penaltyCount || '0', 10));
    const penaltyTimeMs = safePenaltyCount * penaltySecPerHit * 1000;
    const finalTimeMs = Math.round(reportedRaceTimeMs) + penaltyTimeMs;

    const resultStatus = isFlagged ? 'FLAGGED_REVIEW' : 'VALID';
    const now = new Date().toISOString();

    // Server verification cryptographic hash
    const serverHash = crypto
      .createHash('sha256')
      .update(`${sessionId}:${session.team_name}:${reportedRaceTimeMs}:${penaltyTimeMs}:${finalTimeMs}`)
      .digest('hex');

    runQuery(
      db,
      `UPDATE race_sessions SET
        status = 'FINISHED',
        completed_at = ?,
        laps_completed = ?,
        race_time_ms = ?,
        penalty_time_ms = ?,
        final_time_ms = ?,
        result_status = ?,
        validation_notes = ?,
        server_hash = ?
      WHERE id = ?`,
      [
        now,
        targetLaps,
        Math.round(reportedRaceTimeMs),
        penaltyTimeMs,
        finalTimeMs,
        resultStatus,
        validationNotes,
        serverHash,
        sessionId
      ]
    );

    // Record audit event
    const eventId = crypto.randomUUID();
    runQuery(
      db,
      `INSERT INTO race_events (id, race_session_id, event_type, event_timestamp, metadata) VALUES (?, ?, 'FINISH', ?, ?)`,
      [
        eventId,
        sessionId,
        now,
        JSON.stringify({
          reportedRaceTimeMs,
          penaltyCount: safePenaltyCount,
          penaltyTimeMs,
          finalTimeMs,
          resultStatus,
          validationNotes,
          lapSplits
        })
      ]
    );

    res.json({
      success: true,
      sessionId,
      teamName: session.team_name,
      lapsCompleted: targetLaps,
      raceTimeMs: Math.round(reportedRaceTimeMs),
      penaltyCount: safePenaltyCount,
      penaltyTimeMs,
      finalTimeMs,
      resultStatus,
      validationNotes,
      serverHash,
      isFlagged
    });
  } catch (err: any) {
    console.error('Race finish error:', err);
    res.status(500).json({ error: 'Failed to record official race finish.' });
  }
});

// 5. Public Leaderboard
apiRouter.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();

    const lbPublicSetting = queryOne(db, "SELECT value FROM event_settings WHERE key = 'leaderboard_public'");
    if (lbPublicSetting?.value === 'false') {
      return res.json({
        isPublic: false,
        message: 'The leaderboard is currently hidden by event organizers.',
        entries: []
      });
    }

    const rows = queryAll<{
      id: string;
      team_name: string;
      department: string;
      laps_completed: number;
      race_time_ms: number;
      penalty_time_ms: number;
      final_time_ms: number;
      completed_at: string;
      server_hash: string;
    }>(
      db,
      `SELECT
        s.id,
        p.team_name,
        p.department,
        s.laps_completed,
        s.race_time_ms,
        s.penalty_time_ms,
        s.final_time_ms,
        s.completed_at,
        s.server_hash
      FROM race_sessions s
      JOIN participants p ON s.participant_id = p.id
      WHERE s.status = 'FINISHED' AND s.result_status = 'VALID'
      ORDER BY s.final_time_ms ASC, s.completed_at ASC`
    );

    const entries = rows.map((r, index) => ({
      rank: index + 1,
      sessionId: r.id,
      teamName: r.team_name,
      department: r.department || 'Tech Participant',
      laps: r.laps_completed,
      raceTimeMs: r.race_time_ms,
      penaltyTimeMs: r.penalty_time_ms,
      finalTimeMs: r.final_time_ms,
      completedAt: r.completed_at,
      verified: Boolean(r.server_hash)
    }));

    res.json({
      isPublic: true,
      lastUpdated: new Date().toISOString(),
      entries
    });
  } catch (err: any) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Unable to retrieve leaderboard.' });
  }
});

// -------------------------------------------------------------
// ORGANIZER ADMIN ENDPOINTS
// -------------------------------------------------------------

// Admin Login
apiRouter.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    const hashedInput = hashPassword(password);
    const user = queryOne<{ id: string; username: string; role: string; password_hash: string }>(
      db,
      'SELECT id, username, role, password_hash FROM admin_users WHERE username = ?',
      [username.trim()]
    );

    if (!user || user.password_hash !== hashedInput) {
      return res.status(401).json({ error: 'Invalid admin username or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 1000 * 60 * 60 * 12; // 12 hours

    activeAdminTokens.set(token, {
      adminId: user.id,
      username: user.username,
      role: user.role,
      expiresAt
    });

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: false, // AI Studio dev environment runs over http inside container
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12
    });

    res.json({
      success: true,
      token,
      admin: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Admin login failed.' });
  }
});

// Admin Me
apiRouter.get('/admin/me', requireAdmin, (req: Request, res: Response) => {
  res.json({ success: true, admin: (req as any).admin });
});

// Admin Logout
apiRouter.post('/admin/logout', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.admin_token;
  if (token) {
    activeAdminTokens.delete(token);
  }
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// Admin Overview Metrics
apiRouter.get('/admin/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();

    const totalRegistered = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM participants')?.count || 0;
    const racingNow = queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM race_sessions WHERE status = 'RACING'")?.count || 0;
    const finishedValid = queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM race_sessions WHERE status = 'FINISHED' AND result_status = 'VALID'")?.count || 0;
    const flaggedCount = queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM race_sessions WHERE result_status = 'FLAGGED_REVIEW'")?.count || 0;
    const disqualifiedCount = queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM race_sessions WHERE status = 'DISQUALIFIED' OR result_status = 'DISQUALIFIED'")?.count || 0;
    const bestRecord = queryOne<{ min_time: number }>(db, "SELECT MIN(final_time_ms) as min_time FROM race_sessions WHERE status = 'FINISHED' AND result_status = 'VALID'")?.min_time || 0;

    res.json({
      totalRegistered,
      racingNow,
      finishedValid,
      flaggedCount,
      disqualifiedCount,
      bestRecord
    });
  } catch (err: any) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to retrieve overview metrics.' });
  }
});

// Admin Sessions List
apiRouter.get('/admin/sessions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const search = (req.query.search as string || '').toLowerCase();
    const statusFilter = req.query.status as string || 'ALL';

    let query = `
      SELECT
        s.id,
        s.participant_id,
        p.team_name,
        p.department,
        s.status,
        s.started_at,
        s.completed_at,
        s.laps_completed,
        s.race_time_ms,
        s.penalty_time_ms,
        s.final_time_ms,
        s.result_status,
        s.validation_notes,
        s.created_at
      FROM race_sessions s
      JOIN participants p ON s.participant_id = p.id
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (search) {
      whereClauses.push('(LOWER(p.team_name) LIKE ? OR LOWER(p.department) LIKE ? OR LOWER(s.id) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'FLAGGED') {
        whereClauses.push("s.result_status = 'FLAGGED_REVIEW'");
      } else {
        whereClauses.push('s.status = ?');
        params.push(statusFilter);
      }
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' ORDER BY s.created_at DESC LIMIT 200';

    const sessions = queryAll(db, query, params);
    res.json({ sessions });
  } catch (err: any) {
    console.error('Admin sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions.' });
  }
});

// Admin Add / Remove Penalty
apiRouter.post('/admin/penalty', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { sessionId, penaltyDeltaMs, reason } = req.body;
    const admin = (req as any).admin;

    if (!sessionId || typeof penaltyDeltaMs !== 'number') {
      return res.status(400).json({ error: 'sessionId and penaltyDeltaMs are required.' });
    }

    const session = queryOne<{ id: string; penalty_time_ms: number; race_time_ms: number; final_time_ms: number }>(
      db,
      'SELECT id, penalty_time_ms, race_time_ms, final_time_ms FROM race_sessions WHERE id = ?',
      [sessionId]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const newPenalty = Math.max(0, session.penalty_time_ms + penaltyDeltaMs);
    const newFinal = session.race_time_ms + newPenalty;

    runQuery(
      db,
      'UPDATE race_sessions SET penalty_time_ms = ?, final_time_ms = ? WHERE id = ?',
      [newPenalty, newFinal, sessionId]
    );

    // Audit action
    const actionId = crypto.randomUUID();
    const now = new Date().toISOString();
    runQuery(
      db,
      `INSERT INTO admin_actions (id, admin_id, admin_username, action, target_id, details, timestamp)
       VALUES (?, ?, ?, 'ADJUST_PENALTY', ?, ?, ?)`,
      [
        actionId,
        admin.adminId,
        admin.username,
        sessionId,
        JSON.stringify({ deltaMs: penaltyDeltaMs, newPenalty, newFinal, reason: reason || 'Manual adjustment' }),
        now
      ]
    );

    res.json({ success: true, newPenalty, newFinal });
  } catch (err: any) {
    console.error('Penalty update error:', err);
    res.status(500).json({ error: 'Failed to adjust penalty.' });
  }
});

// Admin Disqualify Participant
apiRouter.post('/admin/disqualify', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { sessionId, reason } = req.body;
    const admin = (req as any).admin;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    runQuery(
      db,
      "UPDATE race_sessions SET status = 'DISQUALIFIED', result_status = 'DISQUALIFIED', validation_notes = ? WHERE id = ?",
      [`Disqualified by admin: ${reason || 'Rule violation'}`, sessionId]
    );

    const actionId = crypto.randomUUID();
    const now = new Date().toISOString();
    runQuery(
      db,
      `INSERT INTO admin_actions (id, admin_id, admin_username, action, target_id, details, timestamp)
       VALUES (?, ?, ?, 'DISQUALIFY', ?, ?, ?)`,
      [actionId, admin.adminId, admin.username, sessionId, JSON.stringify({ reason }), now]
    );

    res.json({ success: true, status: 'DISQUALIFIED' });
  } catch (err: any) {
    console.error('Disqualification error:', err);
    res.status(500).json({ error: 'Failed to disqualify session.' });
  }
});

// Admin Remove Team and all related data
apiRouter.post('/admin/remove-team', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { sessionId, reason } = req.body;
    const admin = (req as any).admin;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const session = queryOne<{ participant_id: string; team_name: string }>(
      db,
      `SELECT s.participant_id, p.team_name
       FROM race_sessions s
       JOIN participants p ON p.id = s.participant_id
       WHERE s.id = ?`,
      [sessionId]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    runQuery(
      db,
      'DELETE FROM race_events WHERE race_session_id IN (SELECT id FROM race_sessions WHERE participant_id = ?)',
      [session.participant_id]
    );

    runQuery(
      db,
      'DELETE FROM race_sessions WHERE participant_id = ?',
      [session.participant_id]
    );

    runQuery(
      db,
      'DELETE FROM participants WHERE id = ?',
      [session.participant_id]
    );

    const actionId = crypto.randomUUID();
    const now = new Date().toISOString();
    runQuery(
      db,
      `INSERT INTO admin_actions (id, admin_id, admin_username, action, target_id, details, timestamp)
       VALUES (?, ?, ?, 'REMOVE_TEAM', ?, ?, ?)`,
      [
        actionId,
        admin.adminId,
        admin.username,
        sessionId,
        JSON.stringify({ teamName: session.team_name, reason: reason || 'Removed by organizer' }),
        now
      ]
    );

    res.json({ success: true, message: 'Team removed successfully.' });
  } catch (err: any) {
    console.error('Remove team error:', err);
    res.status(500).json({ error: 'Failed to remove team.' });
  }
});

// Admin Approve Rerun
apiRouter.post('/admin/approve-rerun', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { sessionId, reason } = req.body;
    const admin = (req as any).admin;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const session = queryOne<{ participant_id: string }>(
      db,
      'SELECT participant_id FROM race_sessions WHERE id = ?',
      [sessionId]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Mark previous session as SUPERSEDED / RERUN_APPROVED
    runQuery(
      db,
      "UPDATE race_sessions SET status = 'RERUN_APPROVED', validation_notes = ? WHERE id = ?",
      [`Rerun approved by ${admin.username}: ${reason || 'Technical rerun granted'}`, sessionId]
    );

    // Create a fresh new session for this participant so they can start immediately
    const newSessionId = 'SESSION-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const newSessionToken = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();

    runQuery(
      db,
      `INSERT INTO race_sessions (
        id, participant_id, session_token, status, result_status, created_at
      ) VALUES (?, ?, ?, 'READY', 'PENDING', ?)`,
      [newSessionId, session.participant_id, newSessionToken, now]
    );

    const actionId = crypto.randomUUID();
    runQuery(
      db,
      `INSERT INTO admin_actions (id, admin_id, admin_username, action, target_id, details, timestamp)
       VALUES (?, ?, ?, 'APPROVE_RERUN', ?, ?, ?)`,
      [actionId, admin.adminId, admin.username, sessionId, JSON.stringify({ reason, newSessionId }), now]
    );

    res.json({
      success: true,
      message: 'Rerun authorized. New active session generated.',
      newSessionId,
      newSessionToken
    });
  } catch (err: any) {
    console.error('Approve rerun error:', err);
    res.status(500).json({ error: 'Failed to authorize rerun.' });
  }
});

// Admin Override / Validate Flagged Result
apiRouter.post('/admin/validate-flagged', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { sessionId, note } = req.body;
    const admin = (req as any).admin;

    runQuery(
      db,
      "UPDATE race_sessions SET result_status = 'VALID', validation_notes = ? WHERE id = ?",
      [`Manually approved by admin ${admin.username}: ${note || 'Verified legitimate run'}`, sessionId]
    );

    const actionId = crypto.randomUUID();
    const now = new Date().toISOString();
    runQuery(
      db,
      `INSERT INTO admin_actions (id, admin_id, admin_username, action, target_id, details, timestamp)
       VALUES (?, ?, ?, 'MANUAL_VALIDATE', ?, ?, ?)`,
      [actionId, admin.adminId, admin.username, sessionId, JSON.stringify({ note }), now]
    );

    res.json({ success: true, result_status: 'VALID' });
  } catch (err: any) {
    console.error('Validate flagged error:', err);
    res.status(500).json({ error: 'Failed to validate flagged result.' });
  }
});

// Admin Session Details & Telemetry
apiRouter.get('/admin/session/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const sessionId = req.params.id;

    const session = queryOne(
      db,
      `SELECT s.*, p.team_name, p.department
       FROM race_sessions s
       JOIN participants p ON s.participant_id = p.id
       WHERE s.id = ?`,
      [sessionId]
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const events = queryAll(
      db,
      'SELECT id, event_type, event_timestamp, metadata FROM race_events WHERE race_session_id = ? ORDER BY event_timestamp ASC',
      [sessionId]
    );

    res.json({ session, events });
  } catch (err: any) {
    console.error('Session details error:', err);
    res.status(500).json({ error: 'Failed to retrieve session details.' });
  }
});

// Admin Audit Logs
apiRouter.get('/admin/audit-logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const logs = queryAll(
      db,
      'SELECT id, admin_username, action, target_id, details, timestamp FROM admin_actions ORDER BY timestamp DESC LIMIT 100'
    );
    res.json({ logs });
  } catch (err: any) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// Admin Update Event Settings
apiRouter.post('/admin/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { settings } = req.body;
    const admin = (req as any).admin;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings object.' });
    }

    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(settings)) {
      runQuery(
        db,
        `INSERT INTO event_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, String(value), now]
      );
    }

    const actionId = crypto.randomUUID();
    runQuery(
      db,
      `INSERT INTO admin_actions (id, admin_id, admin_username, action, target_id, details, timestamp)
       VALUES (?, ?, ?, 'UPDATE_SETTINGS', 'EVENT_CONFIG', ?, ?)`,
      [actionId, admin.adminId, admin.username, JSON.stringify(settings), now]
    );

    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    console.error('Save settings error:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Admin Export CSV
apiRouter.get('/admin/export-csv', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const rows = queryAll<{
      id: string;
      team_name: string;
      department: string;
      status: string;
      result_status: string;
      laps_completed: number;
      race_time_ms: number;
      penalty_time_ms: number;
      final_time_ms: number;
      started_at: string;
      completed_at: string;
      validation_notes: string;
    }>(
      db,
      `SELECT
        s.id, p.team_name, p.department, s.status, s.result_status,
        s.laps_completed, s.race_time_ms, s.penalty_time_ms, s.final_time_ms,
        s.started_at, s.completed_at, s.validation_notes
      FROM race_sessions s
      JOIN participants p ON s.participant_id = p.id
      ORDER BY s.final_time_ms ASC, s.created_at ASC`
    );

    const headers = [
      'Rank',
      'Session ID',
      'Team Name',
      'Department',
      'Status',
      'Result Status',
      'Laps Completed',
      'Race Time (s)',
      'Penalty Time (s)',
      'Final Time (s)',
      'Formatted Final Time',
      'Started At',
      'Completed At',
      'Notes'
    ];

    let rank = 1;
    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const isOfficial = r.status === 'FINISHED' && r.result_status === 'VALID';
      const rankDisplay = isOfficial ? String(rank++) : 'N/A';
      const raceSec = (r.race_time_ms / 1000).toFixed(3);
      const penaltySec = (r.penalty_time_ms / 1000).toFixed(3);
      const finalSec = (r.final_time_ms / 1000).toFixed(3);

      const mins = Math.floor(r.final_time_ms / 60000);
      const secs = ((r.final_time_ms % 60000) / 1000).toFixed(3);
      const formattedTime = `${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`;

      const line = [
        rankDisplay,
        `"${r.id}"`,
        `"${(r.team_name || '').replace(/"/g, '""')}"`,
        `"${(r.department || '').replace(/"/g, '""')}"`,
        r.status,
        r.result_status,
        r.laps_completed,
        raceSec,
        penaltySec,
        finalSec,
        `"${formattedTime}"`,
        `"${r.started_at || ''}"`,
        `"${r.completed_at || ''}"`,
        `"${(r.validation_notes || '').replace(/"/g, '""')}"`
      ];
      csvLines.push(line.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tech_race_results.csv"');
    res.send(csvLines.join('\n'));
  } catch (err: any) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
});
