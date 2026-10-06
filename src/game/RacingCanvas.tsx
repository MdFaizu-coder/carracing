import React, { useEffect, useRef, useState } from 'react';
import { VerticalRacerEngine, TrafficCar, ObstacleObject, SparkParticle, PlayerCar } from './verticalRacer';
import { soundManager } from '../audio/soundManager';
import { Maximize2, Minimize2, Volume2, VolumeX, Play, RotateCcw } from 'lucide-react';

interface RacingCanvasProps {
  targetLaps: number;
  penaltyPerHit: number;
  onLapFinished?: (lap: number, splitMs: number) => void;
  onRaceFinished: (result: {
    raceTimeMs: number;
    penaltyCount: number;
    lapSplits: number[];
  }) => void;
  isCountdownActive: boolean;
  isPaused: boolean;
}

export const RacingCanvas: React.FC<RacingCanvasProps> = ({
  targetLaps,
  penaltyPerHit,
  onLapFinished,
  onRaceFinished,
  isCountdownActive,
  isPaused: externalPaused
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<VerticalRacerEngine | null>(null);

  const [isLocalPaused, setIsLocalPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  const inputRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false
  });

  const [hudState, setHudState] = useState({
    lap: 1,
    speedKmH: 0,
    timeMs: 0,
    penaltiesSec: 0,
    alertText: '',
    lapNoticeText: '',
    bestLapSec: '--',
    lastLapSec: '--'
  });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') inputRef.current.forward = true;
      if (key === 's' || e.key === 'ArrowDown') inputRef.current.backward = true;
      if (key === 'a' || e.key === 'ArrowLeft') inputRef.current.left = true;
      if (key === 'd' || e.key === 'ArrowRight') inputRef.current.right = true;
      if (key === 'p' || key === 'escape') {
        setIsLocalPaused((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') inputRef.current.forward = false;
      if (key === 's' || e.key === 'ArrowDown') inputRef.current.backward = false;
      if (key === 'a' || e.key === 'ArrowLeft') inputRef.current.left = false;
      if (key === 'd' || e.key === 'ArrowRight') inputRef.current.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Render Loop
  useEffect(() => {
    const engine = new VerticalRacerEngine(targetLaps, penaltyPerHit);
    engineRef.current = engine;

    soundManager.startEngine();

    let animationFrameId: number;
    let finishTriggered = false;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const now = performance.now();
      const isGamePaused = isCountdownActive || isLocalPaused || externalPaused;

      // Update physics if active
      if (!isGamePaused && !engine.state.isFinished) {
        engine.update(
          inputRef.current,
          now,
          (lap, splitMs) => {
            soundManager.playLapComplete();
            if (onLapFinished) onLapFinished(lap, splitMs);
          },
          () => {
            soundManager.playCollision();
          },
          () => {
            if (!finishTriggered) {
              finishTriggered = true;
              soundManager.stopEngine();
              soundManager.playFinishFanfare();
              const totalRaceMs = now - (engine.state.raceStartTime || now);
              onRaceFinished({
                raceTimeMs: totalRaceMs,
                penaltyCount: engine.state.penaltiesCount,
                lapSplits: engine.state.lapSplits
              });
            }
          }
        );

        // Sound modulation
        const normSpeed = engine.player.speed / engine.player.maxSpeed;
        soundManager.updateEngine(normSpeed);
      } else {
        soundManager.updateEngine(0);
      }

      // Update HUD state
      const currentRaceTime = engine.state.raceStartTime > 0
        ? (engine.state.isFinished
            ? (engine.state.lapSplits.reduce((a, b) => a + b, 0) || (now - engine.state.raceStartTime))
            : (now - engine.state.raceStartTime))
        : 0;

      const activeAlert = engine.state.penaltyAlert && now - engine.state.penaltyAlert.time < 2200
        ? engine.state.penaltyAlert.text
        : '';

      const activeLapNotice = engine.state.lapNotice && now - engine.state.lapNotice.time < 2500
        ? engine.state.lapNotice.text
        : '';

      setHudState({
        lap: engine.state.currentLap,
        speedKmH: Math.round(engine.player.speed * 12.8),
        timeMs: currentRaceTime,
        penaltiesSec: engine.state.penaltiesSeconds,
        alertText: activeAlert,
        lapNoticeText: activeLapNotice,
        bestLapSec: engine.state.bestLapSplitMs ? (engine.state.bestLapSplitMs / 1000).toFixed(1) : '--',
        lastLapSec: engine.state.lastLapSplitMs ? (engine.state.lastLapSplitMs / 1000).toFixed(1) : '--'
      });

      // -----------------------------------------------------------------
      // DRAW VERTICAL HIGHWAY SCENE
      // -----------------------------------------------------------------
      drawVerticalScene(ctx, canvas.width, canvas.height, engine);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      soundManager.stopEngine();
    };
  }, [targetLaps, penaltyPerHit, isCountdownActive, isLocalPaused, externalPaused]);

  const drawVerticalScene = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    engine: VerticalRacerEngine
  ) => {
    ctx.save();

    // Screen Shake on collision
    if (engine.screenShake > 0) {
      const sx = (Math.random() - 0.5) * engine.screenShake;
      const sy = (Math.random() - 0.5) * engine.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Sidewalk / Concrete Road Shoulders (Dark Gray concrete)
    ctx.fillStyle = '#1c222c';
    ctx.fillRect(0, 0, w, h);

    // Concrete curb texture grooves
    ctx.strokeStyle = '#141a22';
    ctx.lineWidth = 2;
    const curbStep = 24;
    const curbOffset = (engine.roadOffset * 0.7) % curbStep;
    for (let y = -curbStep + curbOffset; y < h + curbStep; y += curbStep) {
      // Left sidewalk grooves
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(engine.ROAD_LEFT, y);
      ctx.stroke();

      // Right sidewalk grooves
      ctx.beginPath();
      ctx.moveTo(engine.ROAD_RIGHT, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Asphalt Highway Road Surface (Deep asphalt slate)
    ctx.fillStyle = '#262d35';
    ctx.fillRect(engine.ROAD_LEFT, 0, engine.ROAD_W, h);

    // Subtle asphalt grain texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < 40; i++) {
      const rx = engine.ROAD_LEFT + ((i * 37) % engine.ROAD_W);
      const ry = ((i * 59 + engine.roadOffset * 2) % h);
      ctx.fillRect(rx, ry, 3, 3);
    }

    // 3. Outer Road Boundary Lines (Solid Yellow Lines)
    ctx.strokeStyle = '#eab308'; // Bright Highway Yellow
    ctx.lineWidth = 4;
    // Left Yellow line
    ctx.beginPath();
    ctx.moveTo(engine.ROAD_LEFT + 2, 0);
    ctx.lineTo(engine.ROAD_LEFT + 2, h);
    ctx.stroke();
    // Right Yellow line
    ctx.beginPath();
    ctx.moveTo(engine.ROAD_RIGHT - 2, 0);
    ctx.lineTo(engine.ROAD_RIGHT - 2, h);
    ctx.stroke();

    // 4. Center White Solid Divider Line (matching user image!)
    const centerX = w / 2;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, h);
    ctx.stroke();

    // 5. White Dashed Lane Dividers
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    const dashLength = 32;
    const dashGap = 28;
    ctx.setLineDash([dashLength, dashGap]);
    ctx.lineDashOffset = -engine.roadOffset;

    // Divider between lane 0 and 1
    const div1X = engine.ROAD_LEFT + engine.LANE_W;
    ctx.beginPath();
    ctx.moveTo(div1X, 0);
    ctx.lineTo(div1X, h);
    ctx.stroke();

    // Divider between lane 2 and 3
    const div3X = engine.ROAD_LEFT + engine.LANE_W * 3;
    ctx.beginPath();
    ctx.moveTo(div3X, 0);
    ctx.lineTo(div3X, h);
    ctx.stroke();

    ctx.setLineDash([]); // Reset line dash

    // 6. Checkered Lap Banner (Start / Finish line)
    for (const banner of engine.lapBanners) {
      if (banner.y > -80 && banner.y < h + 80) {
        drawCheckeredBanner(ctx, banner.y, engine);
      }
    }

    // 7. Oil Slicks
    for (const obs of engine.obstacles) {
      if (obs.type === 'OIL_SLICK' && obs.y > -60 && obs.y < h + 60) {
        drawOilSlick(ctx, obs);
      }
    }

    // 8. Obstacles (Cones & Safety Barriers)
    for (const obs of engine.obstacles) {
      if (obs.type !== 'OIL_SLICK' && obs.y > -60 && obs.y < h + 60) {
        if (obs.type === 'CONE') {
          drawCone(ctx, obs.x, obs.y, obs.width);
        } else if (obs.type === 'BARRIER') {
          drawBarrier(ctx, obs.x, obs.y, obs.width, obs.height);
        }
      }
    }

    // 9. Traffic Cars
    for (const traffic of engine.traffic) {
      if (traffic.y > -100 && traffic.y < h + 100) {
        drawTrafficCar(ctx, traffic);
      }
    }

    // 10. Particles (Sparks & Smoke)
    for (const p of engine.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 11. Red Player Sports Car (matching user image!)
    drawPlayerCar(ctx, engine.player);

    // 12. Big Arcade Lap Counter (Top Center, exactly matching the screenshot!)
    drawArcadeLapNumber(ctx, w, engine.state.currentLap);

    ctx.restore();
  };

  // Big stylized italic white/red drop-shadow arcade lap number (matching user screenshot!)
  const drawArcadeLapNumber = (ctx: CanvasRenderingContext2D, w: number, lapNumber: number) => {
    ctx.save();
    const text = String(lapNumber);
    ctx.font = 'italic 900 88px "Chakra Petch", "Impact", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const cx = w / 2;
    const cy = 60;

    // Outer dark/red shadow
    ctx.fillStyle = '#7f1d1d'; // Deep dark red drop shadow
    ctx.fillText(text, cx + 5, cy + 5);

    // Inner shadow outline
    ctx.fillStyle = '#0f172a';
    ctx.fillText(text, cx + 2, cy + 2);

    // Red outline border
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 10;
    ctx.strokeText(text, cx, cy);

    // White fill face
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, cy);

    // Soft specular highlight on top half
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(text, cx - 1, cy - 1);

    ctx.restore();
  };

  // Draw Checkered Start / Finish Line Banner
  const drawCheckeredBanner = (ctx: CanvasRenderingContext2D, y: number, engine: VerticalRacerEngine) => {
    ctx.save();
    const box = 16;
    const rows = 2;
    const cols = Math.floor(engine.ROAD_W / box);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#0f172a';
        ctx.fillRect(engine.ROAD_LEFT + c * box, y + r * box - box, box, box);
      }
    }

    // Yellow support lines
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3;
    ctx.strokeRect(engine.ROAD_LEFT, y - box, engine.ROAD_W, box * rows);

    // Banner Text
    ctx.font = 'bold 12px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('LAP GATE', engine.CANVAS_W / 2, y + 26);

    ctx.restore();
  };

  // Draw Player's Sleek Red Sports Car (matching user image!)
  const drawPlayerCar = (ctx: CanvasRenderingContext2D, car: PlayerCar) => {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.tilt);

    const w = car.width;
    const h = car.height;

    // Car Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 4, -h / 2 + 8, w, h, 10);
    ctx.fill();

    // 4 Black Tires
    ctx.fillStyle = '#0f172a';
    const tireW = 7;
    const tireH = 16;
    // Front tires
    ctx.fillRect(-w / 2 - 3, -h / 2 + 10, tireW, tireH);
    ctx.fillRect(w / 2 - tireW + 3, -h / 2 + 10, tireW, tireH);
    // Rear tires
    ctx.fillRect(-w / 2 - 3, h / 2 - 24, tireW, tireH);
    ctx.fillRect(w / 2 - tireW + 3, h / 2 - 24, tireW, tireH);

    // Car Red Body Gradient (Vibrant sports red)
    const bodyGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bodyGrad.addColorStop(0, '#dc2626');   // deep red
    bodyGrad.addColorStop(0.3, '#ef4444'); // bright crimson
    bodyGrad.addColorStop(0.5, '#f87171'); // highlight ridge
    bodyGrad.addColorStop(0.7, '#ef4444');
    bodyGrad.addColorStop(1, '#b91c1c');   // dark red edge

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;

    // Aerodynamic Chassis Shape
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, [14, 14, 10, 10]);
    ctx.fill();
    ctx.stroke();

    // Front Hood highlight
    ctx.fillStyle = 'rgba(254, 202, 202, 0.35)';
    ctx.beginPath();
    ctx.moveTo(-w / 4, -h / 2 + 6);
    ctx.lineTo(w / 4, -h / 2 + 6);
    ctx.lineTo(w / 6, -h / 6);
    ctx.lineTo(-w / 6, -h / 6);
    ctx.closePath();
    ctx.fill();

    // Cockpit Windshield (Tinted glass)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 6, -h / 2 + 22, w - 12, 16, 4);
    ctx.fill();

    // Windshield glass specular line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 9, -h / 2 + 25);
    ctx.lineTo(-w / 2 + 16, -h / 2 + 35);
    ctx.stroke();

    // Red Roof Panel
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-w / 2 + 8, -h / 2 + 38, w - 16, 12);

    // Rear Windshield
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 7, -h / 2 + 50, w - 14, 11, 3);
    ctx.fill();

    // Front Headlights (Yellow/White beams)
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-w / 2 + 4, -h / 2 + 2, 7, 4);
    ctx.fillRect(w / 2 - 11, -h / 2 + 2, 7, 4);

    // Rear Brake Tail Lights (Bright red glow)
    ctx.fillStyle = '#fee2e2';
    ctx.fillRect(-w / 2 + 4, h / 2 - 4, 7, 3);
    ctx.fillRect(w / 2 - 11, h / 2 - 4, 7, 3);

    // Side Mirrors
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-w / 2 - 4, -h / 2 + 26, 4, 6);
    ctx.fillRect(w / 2, -h / 2 + 26, 4, 6);

    ctx.restore();
  };

  // Draw Traffic Car
  const drawTrafficCar = (ctx: CanvasRenderingContext2D, traffic: TrafficCar) => {
    ctx.save();
    ctx.translate(traffic.x, traffic.y);

    const w = traffic.width;
    const h = traffic.height;

    // Palette colors
    const colorPaints = {
      blue: { main: '#0284c7', light: '#38bdf8', dark: '#0369a1' },
      yellow: { main: '#eab308', light: '#fde047', dark: '#ca8a04' },
      green: { main: '#16a34a', light: '#4ade80', dark: '#15803d' },
      purple: { main: '#9333ea', light: '#c084fc', dark: '#7e22ce' },
      silver: { main: '#64748b', light: '#94a3b8', dark: '#475569' }
    };

    const c = colorPaints[traffic.color];

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 3, -h / 2 + 6, w, h, 8);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-w / 2 - 2, -h / 2 + 10, 5, 14);
    ctx.fillRect(w / 2 - 3, -h / 2 + 10, 5, 14);
    ctx.fillRect(-w / 2 - 2, h / 2 - 24, 5, 14);
    ctx.fillRect(w / 2 - 3, h / 2 - 24, 5, 14);

    // Chassis
    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, c.dark);
    grad.addColorStop(0.5, c.light);
    grad.addColorStop(1, c.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 10);
    ctx.fill();

    // Windshield
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 5, -h / 2 + 18, w - 10, 15, 3);
    ctx.fill();

    // Rear Windshield
    ctx.fillRect(-w / 2 + 6, -h / 2 + 45, w - 12, 10);

    // Tail lights
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-w / 2 + 4, h / 2 - 3, 6, 3);
    ctx.fillRect(w / 2 - 10, h / 2 - 3, 6, 3);

    ctx.restore();
  };

  // Draw Traffic Cone
  const drawCone = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x, y);

    // Orange Base
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 4);
    ctx.fill();

    // White concentric ring
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Orange Tip
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Draw Safety Barrier
  const drawBarrier = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // White stripes
    ctx.fillStyle = '#ffffff';
    const stripeW = 8;
    for (let s = -w / 2; s < w / 2; s += stripeW * 2) {
      ctx.fillRect(s, -h / 2, stripeW, h);
    }

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.restore();
  };

  // Draw Oil Slick
  const drawOilSlick = (ctx: CanvasRenderingContext2D, obs: ObstacleObject) => {
    ctx.save();
    ctx.translate(obs.x, obs.y);

    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, obs.width / 2);
    grad.addColorStop(0, 'rgba(147, 51, 234, 0.8)');
    grad.addColorStop(0.7, 'rgba(30, 27, 75, 0.9)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.ellipse(0, 0, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleToggleAudio = () => {
    const next = soundManager.toggleMute();
    setIsMuted(next);
  };

  const formatTimer = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const mmm = Math.floor(ms % 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center p-2 select-none"
    >
      {/* Game Window Container (Vertical Aspect Ratio matching user reference!) */}
      <div className="relative w-full max-w-[440px] aspect-[440/740] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={440}
          height={740}
          className="w-full h-full object-contain block bg-slate-950 cursor-pointer"
        />

        {/* 1. TOP-LEFT: Red Square Pause Button with White Double Bars (Matching image!) */}
        <button
          onClick={() => setIsLocalPaused((p) => !p)}
          className="absolute top-4 left-4 w-12 h-12 bg-red-700 hover:bg-red-600 active:scale-95 border-2 border-white rounded-md shadow-lg flex items-center justify-center transition-all z-20"
          title="Pause Game (P)"
          aria-label="Pause Race"
        >
          <div className="flex gap-1.5 items-center justify-center">
            <span className="w-2 h-6 bg-white rounded-xs shadow-sm" />
            <span className="w-2 h-6 bg-white rounded-xs shadow-sm" />
          </div>
        </button>

        {/* 2. TOP-RIGHT: Arcade HUD (Matching image Best / Last retro styling!) */}
        <div className="absolute top-3 right-4 flex flex-col items-end pointer-events-none z-20">
          <div className="text-right leading-tight">
            {/* Best: XX (in red arcade italic) */}
            <div className="font-['Chakra_Petch',sans-serif] italic font-black text-xl text-red-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Best: <span className="text-red-400">{hudState.bestLapSec}</span>
            </div>
            {/* Last: XX (in orange/amber arcade italic) */}
            <div className="font-['Chakra_Petch',sans-serif] italic font-black text-xl text-amber-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Last: <span className="text-amber-400">{hudState.lastLapSec}</span>
            </div>
          </div>

          {/* Official Millisecond Timer & Penalties Badge */}
          <div className="mt-1 bg-slate-900/90 border border-slate-700 px-2.5 py-1 rounded text-right shadow-md">
            <div className="text-xs font-mono font-black text-emerald-400">
              {formatTimer(hudState.timeMs)}
            </div>
            {hudState.penaltiesSec > 0 && (
              <div className="text-[10px] font-mono font-bold text-amber-400">
                +{hudState.penaltiesSec}s PEN
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Alerts / Banners */}
        <div className="absolute top-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-20">
          {hudState.alertText && (
            <div className="bg-rose-950/95 border-2 border-rose-500 text-rose-100 px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wide shadow-xl animate-bounce">
              {hudState.alertText}
            </div>
          )}
          {hudState.lapNoticeText && !hudState.alertText && (
            <div className="bg-cyan-950/95 border-2 border-cyan-500 text-cyan-100 px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wide shadow-xl">
              {hudState.lapNoticeText}
            </div>
          )}
        </div>

        {/* Pause Modal Overlay */}
        {isLocalPaused && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-700 border-2 border-white flex items-center justify-center text-white mb-4 shadow-xl">
              <div className="flex gap-2">
                <span className="w-2.5 h-8 bg-white rounded-xs" />
                <span className="w-2.5 h-8 bg-white rounded-xs" />
              </div>
            </div>
            <h2 className="text-2xl font-black uppercase text-white font-['Chakra_Petch'] mb-1">
              RACE PAUSED
            </h2>
            <p className="text-xs text-slate-400 mb-6 text-center">
              Lap {hudState.lap} / {targetLaps} • Timer paused
            </p>

            <div className="flex flex-col gap-3 w-48">
              <button
                onClick={() => setIsLocalPaused(false)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Race</span>
              </button>

              <button
                onClick={handleToggleAudio}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{isMuted ? 'Unmute Audio' : 'Mute Audio'}</span>
              </button>
            </div>
          </div>
        )}

        {/* On-Screen Touch Driving Controls for Mobile / Tablets */}
        <div className="sm:hidden absolute bottom-4 inset-x-4 flex justify-between items-end pointer-events-none z-20">
          {/* Steer Left / Right */}
          <div className="flex gap-2 pointer-events-auto">
            <button
              onTouchStart={() => (inputRef.current.left = true)}
              onTouchEnd={() => (inputRef.current.left = false)}
              className="w-14 h-14 bg-slate-900/90 border border-slate-700 active:bg-cyan-600 text-white rounded-xl font-bold flex items-center justify-center text-xl shadow-lg active:scale-95"
              aria-label="Steer Left"
            >
              ◀
            </button>
            <button
              onTouchStart={() => (inputRef.current.right = true)}
              onTouchEnd={() => (inputRef.current.right = false)}
              className="w-14 h-14 bg-slate-900/90 border border-slate-700 active:bg-cyan-600 text-white rounded-xl font-bold flex items-center justify-center text-xl shadow-lg active:scale-95"
              aria-label="Steer Right"
            >
              ▶
            </button>
          </div>

          {/* Gas & Brake */}
          <div className="flex gap-2 pointer-events-auto">
            <button
              onTouchStart={() => (inputRef.current.backward = true)}
              onTouchEnd={() => (inputRef.current.backward = false)}
              className="w-12 h-14 bg-slate-900/90 border border-slate-700 active:bg-amber-600 text-amber-400 rounded-xl font-bold flex items-center justify-center text-sm shadow-lg active:scale-95"
              aria-label="Brake"
            >
              BRK
            </button>
            <button
              onTouchStart={() => (inputRef.current.forward = true)}
              onTouchEnd={() => (inputRef.current.forward = false)}
              className="w-14 h-14 bg-emerald-700/90 border border-emerald-500 active:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center text-base shadow-lg active:scale-95"
              aria-label="Gas / Accelerate"
            >
              GAS
            </button>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM WEBGL / FRAME BAR (Matching the Unity WebGL bottom toolbar from user image!) */}
      <div className="w-full max-w-[440px] mt-2 px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {/* Unity WebGL styled badge */}
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-[11px]">WebGL Engine</span>
          </div>
          <span className="text-slate-600">•</span>
          <span className="font-bold text-slate-400 text-[11px] uppercase">Car Racing</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleAudio}
            className="p-1 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-colors"
            title="Toggle Fullscreen"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
