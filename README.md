# Tech Event Car Racing Challenge

An official collegiate single-player time-trial motorsport competition platform built for college department tech festivals. Features high-precision client-side 2D top-down racing physics, 10-lap checkpoint validation, obstacle penalty tracking, anti-cheat server verification, real-time leaderboard, and an administrative control panel.

---

## 🏎️ Features

- **Single-Player Browser Racing:**
  - Independent local execution on each participant's device with zero multiplayer synchronization bottlenecks.
  - Realistic top-down physics: acceleration, braking, drifting friction, off-track slowdown, obstacle collision recoil, and responsive WASD/Arrow/Touch controls.
- **10-Lap Checkpoint Telemetry:**
  - 6-gate sequential checkpoint system preventing track cutting or backwards driving.
  - High-precision millisecond race timer and lap split records.
- **Interactive Obstacles & Penalties:**
  - Dynamic cones, apex barriers, and oil slicks.
  - Automated +3s penalty calculation for obstacle collisions.
- **Anti-Cheat & Result Integrity:**
  - Cryptographic session tokens and server-validated start timestamps.
  - Physical minimum lap-time threshold validation.
  - Wall-clock tolerance verification.
  - SHA-256 result signature verification.
- **Organizer Admin Dashboard (`/admin`):**
  - Protected with organizer-only authentication and private credentials.
  - Real-time competition overview metrics (registered, racing, finished, flagged, disqualified).
  - Manual penalty adjustments (+/- seconds with audit reason).
  - One-click rerun authorization (generates fresh session token).
  - Disqualification with reason logging.
  - Live CSV export of official results for award ceremonies.
  - Configurable event parameters (laps, penalty rates, min lap bounds, registration toggles).
- **Procedural Audio (Web Audio API):**
  - Zero external sound asset downloads: synthetic engine rev, tire screeches, checkpoint chimes, and finish victory fanfare.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, HTML5 Canvas 2D engine, Canvas-Confetti.
- **Backend:** Express 4 on Node.js / `tsx`.
- **Database:** SQLite (Relational SQL via `sql.js` WASM engine with disk persistence to `race_competition.sqlite`).
- **Security:** Scrypt password hashing, session tokens, audit logging for all administrative modifications.

---

## 🚀 Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The application will start on **`http://localhost:3000`** with Express backend and Vite middlewares.

### 3. Build & Run Production Mode
```bash
npm run build
npm start
```

---

## 🌐 Deploy to Render or Railway

This project is already structured to run in production mode, and the required deployment files are included:

- `render.yaml` for Render
- `railway.json` for Railway

### Render
1. Push this project to GitHub.
2. In Render, click New > Web Service.
3. Connect the repository.
4. Use the default settings or these values:
   - Build Command: `npm install --legacy-peer-deps && npm run build`
   - Start Command: `NODE_ENV=production npm start`
5. Deploy.

### Railway
1. Push this project to GitHub.
2. Create a new project in Railway.
3. Import the repository.
4. Railway will use `railway.json` automatically.
5. Deploy the service.

### Notes
- The app listens on `PORT` from the environment and binds to `0.0.0.0`, which is required for hosted services.
- The project uses SQLite, so it is best suited for short-term event hosting or a single service with persistent disk storage.
- For a large-scale public event, consider moving to PostgreSQL later.

---

## 🔑 Organizer Access

Organizer login details are kept private and should not be shared publicly with contestants.

*(Admins can change settings and manage participants through the Admin Panel button in the navigation bar).*

---

## 🛡️ Anti-Cheat Validation Workflow

```
Participant Browser                    Server (Express & SQLite)
       |                                           |
       |--- 1. POST /api/register --------------->| (Creates Participant & Session)
       |<-- Returns Session ID & Token ------------|
       |                                           |
       |--- 2. POST /api/race/start ------------->| (Records Server Started_At Timestamp)
       |<-- Confirms Server Start Time ------------|
       |                                           |
       | [Driver completes 10 laps locally]        |
       | [Validates all 6 checkpoints/lap]        |
       |                                           |
       |--- 3. POST /api/race/finish ------------>| (Validates: Laps == 10,
       |    (lapSplits, rawMs, penalties)          |   rawMs >= Target * MinLapSec,
       |                                           |   reportedMs <= serverElapsed + tol,
       |                                           |   Computes SHA-256 Server Hash)
       |<-- Returns Official Validated Time -------|
```
