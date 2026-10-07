import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { RegistrationModal } from './components/RegistrationModal';
import { ReadyView } from './components/ReadyView';
import { GameView } from './components/GameView';
import { ResultView } from './components/ResultView';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { EventConfig, ActiveSession, RaceFinishResult, AdminUser } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<
    'LANDING' | 'READY' | 'GAME' | 'RESULT' | 'LEADERBOARD' | 'ADMIN'
  >('LANDING');

  const [eventConfig, setEventConfig] = useState<EventConfig>({
    eventName: 'Tech Event Car Racing Challenge',
    department: 'Department of Computer Science and Data Science',
    targetLaps: 20,
    penaltySecondsPerHit: 3,
    minLapSeconds: 4,
    registrationOpen: true,
    leaderboardPublic: true,
    competitionStatus: 'ACTIVE'
  });

  // Session state
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [raceResult, setRaceResult] = useState<RaceFinishResult | null>(null);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  // Admin authentication
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // Load config on mount
  useEffect(() => {
    fetchConfig();

    // Check URL parameters (e.g. ?admin=1 or ?autostart=1)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === '1') {
      setCurrentView('ADMIN');
      setIsAdminLoginOpen(true);
    } else if (urlParams.get('autostart') === '1') {
      // Auto-start journey for automated testability
      handleQuickAutostart();
    }

    // Check stored admin token
    const savedToken = localStorage.getItem('tech_race_admin_token');
    const savedUser = localStorage.getItem('tech_race_admin_user');
    if (savedToken && savedUser) {
      try {
        setAdminToken(savedToken);
        setAdminUser(JSON.parse(savedUser));
      } catch {
        // safe ignore
      }
    }
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/event-config');
      if (res.ok) {
        const data = await res.json();
        setEventConfig(data);
      }
    } catch (err) {
      console.warn('Using default event configuration', err);
    }
  };

  const handleQuickAutostart = async () => {
    try {
      const testTeam = 'TEST-DRIVE-' + Math.floor(Math.random() * 900 + 100);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName: testTeam, department: 'Automated Test' })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveSession({
          participantId: data.participantId,
          sessionId: data.sessionId,
          sessionToken: data.sessionToken,
          teamName: data.teamName,
          department: data.department,
          targetLaps: 20,
          status: 'READY'
        });
        setCurrentView('READY');
      }
    } catch {
      // safe fallback
    }
  };

  const handleRegistered = (session: ActiveSession) => {
    setActiveSession(session);
    setIsRegisterOpen(false);
    setCurrentView('READY');
  };

  const handleLaunchRace = (serverStartTime: string) => {
    if (activeSession) {
      setActiveSession({
        ...activeSession,
        startedAt: serverStartTime,
        status: 'RACING'
      });
      setCurrentView('GAME');
    }
  };

  const handleRaceFinished = (result: RaceFinishResult) => {
    setRaceResult(result);
    setCurrentView('RESULT');
  };

  const handleAdminLoginSuccess = (admin: AdminUser, token: string) => {
    setAdminToken(token);
    setAdminUser(admin);
    localStorage.setItem('tech_race_admin_token', token);
    localStorage.setItem('tech_race_admin_user', JSON.stringify(admin));
    setIsAdminLoginOpen(false);
    setCurrentView('ADMIN');
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
      });
    } catch {
      // safe ignore
    }
    setAdminToken(null);
    setAdminUser(null);
    localStorage.removeItem('tech_race_admin_token');
    localStorage.removeItem('tech_race_admin_user');
    setCurrentView('LANDING');
  };

  const handleNavClick = (view: 'LANDING' | 'LEADERBOARD' | 'ADMIN') => {
    if (view === 'ADMIN') {
      if (!adminToken) {
        setIsAdminLoginOpen(true);
      } else {
        setCurrentView('ADMIN');
      }
    } else {
      setCurrentView(view);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 flex flex-col justify-between">
      {/* Persistent Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavClick}
        targetLaps={eventConfig.targetLaps}
        competitionStatus={eventConfig.competitionStatus}
        isAdminLoggedIn={Boolean(adminToken)}
      />

      {/* Main Viewport Router */}
      <main className="flex-1 flex flex-col justify-center">
        {currentView === 'LANDING' && (
          <LandingView
            config={eventConfig}
            onStartRegistration={() => setIsRegisterOpen(true)}
            onViewLeaderboard={() => setCurrentView('LEADERBOARD')}
          />
        )}

        {currentView === 'READY' && activeSession && (
          <ReadyView
            session={activeSession}
            penaltyPerHit={eventConfig.penaltySecondsPerHit}
            onLaunchRace={handleLaunchRace}
            onCancel={() => setCurrentView('LANDING')}
          />
        )}

        {currentView === 'GAME' && activeSession && (
          <GameView
            session={activeSession}
            penaltyPerHit={eventConfig.penaltySecondsPerHit}
            onFinishRace={handleRaceFinished}
            onAbortRace={() => setCurrentView('LANDING')}
          />
        )}

        {currentView === 'RESULT' && raceResult && (
          <ResultView
            result={raceResult}
            targetLaps={eventConfig.targetLaps}
            onViewLeaderboard={() => setCurrentView('LEADERBOARD')}
          />
        )}

        {currentView === 'LEADERBOARD' && (
          <LeaderboardView
            onBackToHome={() => setCurrentView('LANDING')}
            onStartRace={() => {
              if (eventConfig.registrationOpen) {
                setIsRegisterOpen(true);
              }
            }}
          />
        )}

        {currentView === 'ADMIN' && adminToken && adminUser && (
          <AdminDashboard
            adminToken={adminToken}
            adminUsername={adminUser.username}
            onLogout={handleAdminLogout}
            onClose={() => setCurrentView('LANDING')}
          />
        )}
      </main>

      {/* Modals */}
      <RegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onRegistered={handleRegistered}
        targetLaps={eventConfig.targetLaps}
      />

      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />
    </div>
  );
}
