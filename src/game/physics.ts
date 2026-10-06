import {
  CHECKPOINTS,
  DEFAULT_OBSTACLES,
  getDistanceToTrackCenter,
  Obstacle,
  Point,
  segmentsIntersect,
  TRACK_WIDTH,
  TRACK_WAYPOINTS
} from './trackData';

export interface CarState {
  x: number;
  y: number;
  angle: number;       // in radians
  speed: number;       // forward velocity
  angularVelocity: number;
  driftAngle: number;
  isOffTrack: boolean;
  isDrifting: boolean;
  isInOilSlick: boolean;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export interface RaceProgress {
  currentLap: number;           // 1 to targetLaps
  targetLaps: number;
  lastPassedCheckpoint: number; // 0..5
  checkpointsPassedInLap: number[];
  lapSplits: number[];          // time in ms for each finished lap
  currentLapStartTime: number;
  raceStartTime: number;
  penaltiesCount: number;
  penaltiesSeconds: number;
  isFinished: boolean;
  penaltyAlert: { text: string; time: number } | null;
  lapNotice: { text: string; time: number } | null;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface SkidMark {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export class CarPhysicsEngine {
  public car: CarState;
  public progress: RaceProgress;
  public obstacles: Obstacle[];
  public particles: Particle[] = [];
  public skidMarks: SkidMark[] = [];

  private hitCooldowns: Map<string, number> = new Map();
  private prevPos: Point;

  // Car tuning constants
  private readonly MAX_SPEED_ON_TRACK = 9.2;
  private readonly MAX_SPEED_OFF_TRACK = 3.2;
  private readonly ACCELERATION = 0.17;
  private readonly BRAKE_POWER = 0.28;
  private readonly REVERSE_MAX = -3.0;
  private readonly TURN_SPEED = 0.054;
  private readonly NATURAL_FRICTION = 0.982;
  private readonly OFF_TRACK_FRICTION = 0.92;
  private readonly DRIFT_FRICTION = 0.955;

  constructor(targetLaps: number = 10, penaltyPerHitSec: number = 3) {
    // Starting grid: behind start/finish line (x: 280, y: 800) facing right (angle: 0)
    this.car = {
      x: 280,
      y: 800,
      angle: 0,
      speed: 0,
      angularVelocity: 0,
      driftAngle: 0,
      isOffTrack: false,
      isDrifting: false,
      isInOilSlick: false
    };

    this.prevPos = { x: this.car.x, y: this.car.y };

    this.progress = {
      currentLap: 1,
      targetLaps,
      lastPassedCheckpoint: -1, // hasn't crossed start line yet
      checkpointsPassedInLap: [],
      lapSplits: [],
      currentLapStartTime: 0,
      raceStartTime: 0,
      penaltiesCount: 0,
      penaltiesSeconds: 0,
      isFinished: false,
      penaltyAlert: null,
      lapNotice: null
    };

    this.obstacles = JSON.parse(JSON.stringify(DEFAULT_OBSTACLES));
  }

  public resetToTrackCenter() {
    // Resets car to nearest safe track waypoint
    const { closestSegmentIndex } = getDistanceToTrackCenter({ x: this.car.x, y: this.car.y });
    const p1 = TRACK_WAYPOINTS[closestSegmentIndex];
    const p2 = TRACK_WAYPOINTS[(closestSegmentIndex + 1) % TRACK_WAYPOINTS.length];
    this.car.x = (p1.x + p2.x) / 2;
    this.car.y = (p1.y + p2.y) / 2;
    this.car.angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    this.car.speed = 0;
    this.car.angularVelocity = 0;
    this.prevPos = { x: this.car.x, y: this.car.y };
  }

  public update(
    input: InputState,
    now: number,
    onCheckpointPassed?: (cpId: number) => void,
    onLapFinished?: (lap: number, splitMs: number) => void,
    onObstacleHit?: (obs: Obstacle) => void,
    onRaceFinished?: () => void
  ) {
    if (this.progress.isFinished) return;

    this.prevPos = { x: this.car.x, y: this.car.y };

    // 1. Off-track & Oil Slick detection
    const { distance } = getDistanceToTrackCenter({ x: this.car.x, y: this.car.y });
    // Half width + small curb margin
    this.car.isOffTrack = distance > (TRACK_WIDTH / 2 + 10);

    // Check oil slick
    this.car.isInOilSlick = false;
    for (const obs of this.obstacles) {
      if (obs.type === 'OIL_SLICK') {
        const d = Math.hypot(this.car.x - obs.x, this.car.y - obs.y);
        if (d < obs.radius + 15) {
          this.car.isInOilSlick = true;
          break;
        }
      }
    }

    const currentMaxSpeed = this.car.isOffTrack
      ? this.MAX_SPEED_OFF_TRACK
      : this.MAX_SPEED_ON_TRACK;

    // 2. Acceleration / Braking
    if (input.forward) {
      if (this.car.speed < currentMaxSpeed) {
        this.car.speed += this.ACCELERATION * (this.car.isOffTrack ? 0.6 : 1.0);
      }
    } else if (input.backward) {
      if (this.car.speed > 0) {
        this.car.speed -= this.BRAKE_POWER;
      } else if (this.car.speed > this.REVERSE_MAX) {
        this.car.speed -= this.ACCELERATION * 0.7;
      }
    }

    // 3. Friction & Damping
    const friction = this.car.isOffTrack
      ? this.OFF_TRACK_FRICTION
      : input.handbrake || this.car.isInOilSlick
      ? this.DRIFT_FRICTION
      : this.NATURAL_FRICTION;

    this.car.speed *= friction;

    // Deadzone stop
    if (Math.abs(this.car.speed) < 0.04) {
      this.car.speed = 0;
    }

    // 4. Steering
    const speedRatio = Math.min(1.0, Math.abs(this.car.speed) / 4.0);
    const steerDir = this.car.speed >= 0 ? 1 : -1;
    let turnRate = this.TURN_SPEED * speedRatio * steerDir;

    if (input.handbrake || this.car.isInOilSlick) {
      turnRate *= 1.45; // Sharper turn when drifting
      this.car.isDrifting = Math.abs(this.car.speed) > 3.0;
    } else {
      this.car.isDrifting = false;
    }

    if (input.left) {
      this.car.angle -= turnRate;
    }
    if (input.right) {
      this.car.angle += turnRate;
    }

    // 5. Velocity Vector Update
    const vx = Math.cos(this.car.angle) * this.car.speed;
    const vy = Math.sin(this.car.angle) * this.car.speed;

    this.car.x += vx;
    this.car.y += vy;

    // Keep car inside world bounds (10 to 1390)
    this.car.x = Math.max(20, Math.min(1380, this.car.x));
    this.car.y = Math.max(20, Math.min(930, this.car.y));

    // 6. Visual Skidmarks & Particles
    if ((this.car.isDrifting || (this.car.isOffTrack && Math.abs(this.car.speed) > 2.0)) && Math.abs(this.car.speed) > 2.5) {
      // Add tire tracks
      if (Math.random() < 0.5) {
        this.skidMarks.push({
          x: this.car.x - Math.cos(this.car.angle) * 14,
          y: this.car.y - Math.sin(this.car.angle) * 14,
          angle: this.car.angle,
          alpha: this.car.isOffTrack ? 0.25 : 0.4
        });
        if (this.skidMarks.length > 300) {
          this.skidMarks.shift();
        }
      }

      // Add smoke or dust particle
      this.particles.push({
        x: this.car.x - Math.cos(this.car.angle) * 16 + (Math.random() - 0.5) * 8,
        y: this.car.y - Math.sin(this.car.angle) * 16 + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        life: 0,
        maxLife: 24,
        color: this.car.isOffTrack ? 'rgba(90, 140, 50, 0.6)' : 'rgba(200, 210, 220, 0.45)',
        size: 3 + Math.random() * 4
      });
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 7. Checkpoint Crossing Detection
    this.checkCheckpoints(now, onCheckpointPassed, onLapFinished, onRaceFinished);

    // 8. Obstacle Collision Detection
    this.checkObstacles(now, onObstacleHit);
  }

  private checkCheckpoints(
    now: number,
    onCheckpointPassed?: (cpId: number) => void,
    onLapFinished?: (lap: number, splitMs: number) => void,
    onRaceFinished?: () => void
  ) {
    const curP: Point = { x: this.car.x, y: this.car.y };
    const prevP: Point = this.prevPos;

    for (let i = 0; i < CHECKPOINTS.length; i++) {
      const cp = CHECKPOINTS[i];
      // Test if path segment intersects checkpoint line
      if (segmentsIntersect(prevP, curP, cp.p1, cp.p2)) {
        // Initial race start gate (crossing Start Line CP 0 first time)
        if (cp.id === 0 && this.progress.lastPassedCheckpoint === -1) {
          this.progress.lastPassedCheckpoint = 0;
          this.progress.checkpointsPassedInLap = [0];
          this.progress.raceStartTime = now;
          this.progress.currentLapStartTime = now;
          if (onCheckpointPassed) onCheckpointPassed(0);
          return;
        }

        // Sequential Checkpoint check
        // Next expected checkpoint is (lastPassedCheckpoint + 1)
        const expectedNextCp = (this.progress.lastPassedCheckpoint + 1) % CHECKPOINTS.length;

        if (cp.id === expectedNextCp) {
          this.progress.lastPassedCheckpoint = cp.id;
          if (!this.progress.checkpointsPassedInLap.includes(cp.id)) {
            this.progress.checkpointsPassedInLap.push(cp.id);
          }
          if (onCheckpointPassed) onCheckpointPassed(cp.id);

          // If crossed CP 0 after passing all other checkpoints (1 through 5), LAP IS COMPLETE!
          if (cp.id === 0 && this.progress.checkpointsPassedInLap.length >= CHECKPOINTS.length) {
            const splitTime = now - this.progress.currentLapStartTime;
            this.progress.lapSplits.push(splitTime);

            this.progress.lapNotice = {
              text: `LAP ${this.progress.currentLap} COMPLETED: ${(splitTime / 1000).toFixed(2)}s`,
              time: now
            };

            if (onLapFinished) {
              onLapFinished(this.progress.currentLap, splitTime);
            }

            if (this.progress.currentLap >= this.progress.targetLaps) {
              // RACE FINISHED!
              this.progress.isFinished = true;
              if (onRaceFinished) onRaceFinished();
            } else {
              // Advance to next lap
              this.progress.currentLap++;
              this.progress.checkpointsPassedInLap = [0];
              this.progress.currentLapStartTime = now;
            }
          }
        }
      }
    }
  }

  private checkObstacles(now: number, onObstacleHit?: (obs: Obstacle) => void) {
    const carRadius = 15;

    for (const obs of this.obstacles) {
      if (obs.type === 'OIL_SLICK') continue; // Oil slicks handle slip friction, not collision penalties

      const lastHit = this.hitCooldowns.get(obs.id) || 0;
      if (now - lastHit < 1800) continue; // 1.8s hit debounce

      const dist = Math.hypot(this.car.x - obs.x, this.car.y - obs.y);
      if (dist < carRadius + obs.radius) {
        // Impact!
        this.hitCooldowns.set(obs.id, now);

        // Slow car down by 50%
        this.car.speed *= 0.5;

        // Push car slightly back
        const pushAngle = Math.atan2(this.car.y - obs.y, this.car.x - obs.x);
        this.car.x += Math.cos(pushAngle) * 8;
        this.car.y += Math.sin(pushAngle) * 8;

        // Add sparks
        for (let s = 0; s < 12; s++) {
          this.particles.push({
            x: obs.x,
            y: obs.y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 0,
            maxLife: 20,
            color: '#f59e0b',
            size: 3 + Math.random() * 3
          });
        }

        this.progress.penaltiesCount++;
        this.progress.penaltiesSeconds += 3;
        this.progress.penaltyAlert = {
          text: `⚠️ OBSTACLE HIT! +3s PENALTY`,
          time: now
        };

        if (onObstacleHit) onObstacleHit(obs);
      }
    }
  }
}
