import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_FILE = path.resolve(process.cwd(), 'race_competition.sqlite');

let dbInstance: Database | null = null;

// Helper to save DB to disk
export function persistDatabase() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

// Password hashing utility
export function hashPassword(password: string): string {
  const salt = 'tech_race_salt_2026';
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
      console.log('Loaded existing SQLite database from disk.');
    } catch (err) {
      console.warn('Failed to load existing DB file, creating a new one.', err);
      dbInstance = new SQL.Database();
    }
  } else {
    console.log('Creating new in-memory SQLite database and initializing tables.');
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  persistDatabase();
  return dbInstance;
}

function initSchema(db: Database) {
  // 1. participants table
  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      team_name TEXT NOT NULL UNIQUE,
      department TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 2. race_sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS race_sessions (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL, /* REGISTERED, READY, RACING, FINISHED, DISQUALIFIED, RERUN_APPROVED */
      started_at TEXT,
      completed_at TEXT,
      laps_completed INTEGER NOT NULL DEFAULT 0,
      race_time_ms INTEGER NOT NULL DEFAULT 0,
      penalty_time_ms INTEGER NOT NULL DEFAULT 0,
      final_time_ms INTEGER NOT NULL DEFAULT 0,
      result_status TEXT NOT NULL DEFAULT 'PENDING', /* PENDING, VALIDATING, VALID, FLAGGED_REVIEW, DISQUALIFIED */
      validation_notes TEXT,
      client_signature TEXT,
      server_hash TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (participant_id) REFERENCES participants (id)
    );
  `);

  // 3. race_events table (audit trail for checkpoints, penalties, starts, finishes)
  db.run(`
    CREATE TABLE IF NOT EXISTS race_events (
      id TEXT PRIMARY KEY,
      race_session_id TEXT NOT NULL,
      event_type TEXT NOT NULL, /* START, LAP_COMPLETED, OBSTACLE_HIT, FINISH, PENALTY_ADDED, DISQUALIFIED */
      event_timestamp TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (race_session_id) REFERENCES race_sessions (id)
    );
  `);

  // 4. admin_users table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ORGANIZER',
      created_at TEXT NOT NULL
    );
  `);

  // 5. admin_actions table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_actions (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // 6. event_settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS event_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Indexes for high concurrency
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_participant ON race_sessions(participant_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON race_sessions(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_result ON race_sessions(result_status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_session ON race_events(race_session_id);`);

  // Seed default admin if not exists, or refresh password for the current organizer account.
  const adminCheck = db.exec("SELECT id, password_hash FROM admin_users WHERE username = 'admin'");
  const adminPassHash = hashPassword('amcds');

  if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
    const adminId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO admin_users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`,
      [adminId, 'admin', adminPassHash, 'SUPER_ADMIN', now]
    );
    console.log('Seeded default admin user: admin');
  } else {
    const existingHash = adminCheck[0].values[0][1] as string | undefined;
    if (existingHash !== adminPassHash) {
      db.run("UPDATE admin_users SET password_hash = ? WHERE username = 'admin'", [adminPassHash]);
      console.log('Updated admin password to amcds for existing admin user.');
    }
  }

  // Seed default event settings if not set
  const defaultSettings: Record<string, string> = {
    event_name: 'Tech Event Car Racing Challenge',
    department: 'Department of Computer Science & Engineering',
    target_laps: '10',
    penalty_seconds_per_hit: '3',
    min_lap_seconds: '8', // Anti-cheat: 1 lap under 8s is physically impossible on this circuit
    registration_open: 'true',
    leaderboard_public: 'true',
    competition_status: 'ACTIVE' // ACTIVE, PAUSED, FINALIZED
  };

  const now = new Date().toISOString();
  for (const [k, v] of Object.entries(defaultSettings)) {
    const check = db.exec(`SELECT value FROM event_settings WHERE key = '${k}'`);
    if (check.length === 0 || check[0].values.length === 0) {
      db.run(`INSERT INTO event_settings (key, value, updated_at) VALUES (?, ?, ?)`, [k, v, now]);
    }
  }

  // Ensure default benchmark teams are completely removed as requested
  db.run(`
    DELETE FROM race_events WHERE race_session_id IN (
      SELECT id FROM race_sessions WHERE participant_id IN (
        SELECT id FROM participants WHERE team_name IN ('Apex Circuit Knights', 'Byte Speedsters', 'Quantum Overdrive')
      )
    );
  `);
  db.run(`
    DELETE FROM race_sessions WHERE participant_id IN (
      SELECT id FROM participants WHERE team_name IN ('Apex Circuit Knights', 'Byte Speedsters', 'Quantum Overdrive')
    );
  `);
  db.run(`
    DELETE FROM participants WHERE team_name IN ('Apex Circuit Knights', 'Byte Speedsters', 'Quantum Overdrive');
  `);
}

// Database helper execution wrappers
export function queryAll<T = any>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(db: Database, sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function runQuery(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
  persistDatabase();
}
