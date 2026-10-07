// Vertical Highway Racing Engine
// Matches user reference: vertical multi-lane highway, red sports car, traffic cars, cones, barriers, oil slicks,
// big arcade lap counter, pause button, and 20-lap time trial system.

export interface PlayerCar {
  x: number;          // lateral position (pixels from road center)
  y: number;          // vertical anchor (fixed near bottom)
  width: number;
  height: number;
  speed: number;      // scroll velocity
  maxSpeed: number;
  targetMaxSpeed: number;
  acceleration: number;
  deceleration: number;
  brakeRate: number;
  turnSpeed: number;
  tilt: number;       // bank angle in radians while steering
  isOffTrack: boolean;
  inOilSlick: boolean;
  oilSlideTime: number;
  oilSlideDir: number;
}

export interface TrafficCar {
  id: string;
  lane: number;       // 0, 1, 2, 3
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;      // relative vertical speed
  color: 'blue' | 'yellow' | 'green' | 'purple' | 'silver';
  active: boolean;
}

export interface ObstacleObject {
  id: string;
  type: 'CONE' | 'BARRIER' | 'OIL_SLICK';
  lane: number;
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

export interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface LapBanner {
  y: number;
  lapNumber: number;
  passed: boolean;
}

export interface VerticalRaceState {
  currentLap: number;         // 1 to targetLaps
  targetLaps: number;
  lapDistanceRemaining: number;
  lapDistanceTotal: number;
  lapSplits: number[];
  currentLapStartTime: number;
  raceStartTime: number;
  penaltiesCount: number;
  penaltiesSeconds: number;
  isFinished: boolean;
  penaltyAlert: { text: string; time: number } | null;
  lapNotice: { text: string; time: number } | null;
  lastLapSplitMs: number | null;
  bestLapSplitMs: number | null;
}

export class VerticalRacerEngine {
  public player: PlayerCar;
  public state: VerticalRaceState;
  public traffic: TrafficCar[] = [];
  public obstacles: ObstacleObject[] = [];
  public particles: SparkParticle[] = [];
  public lapBanners: LapBanner[] = [];

  public roadOffset: number = 0;
  public roadDistance: number = 0;
  public screenShake: number = 0;

  // Road configuration for 4-lane highway
  public readonly CANVAS_W = 440;
  public readonly CANVAS_H = 740;
  public readonly ROAD_W = 330;
  public readonly NUM_LANES = 4;
  public readonly LANE_W: number;
  public readonly ROAD_LEFT: number;
  public readonly ROAD_RIGHT: number;

  private hitCooldown: number = 0;
  private spawnTimer: number = 0;

  constructor(targetLaps: number = 20, penaltyPerHitSec: number = 3) {
    this.LANE_W = this.ROAD_W / this.NUM_LANES;
    this.ROAD_LEFT = (this.CANVAS_W - this.ROAD_W) / 2;
    this.ROAD_RIGHT = this.ROAD_LEFT + this.ROAD_W;

    // Red player sports car
    this.player = {
      x: this.CANVAS_W / 2 + this.LANE_W / 2, // Start in right-center lane
      y: this.CANVAS_H - 145,                 // Bottom 80%
      width: 42,
      height: 76,
      speed: 0,
      maxSpeed: 14.5,
      targetMaxSpeed: 14.5,
      acceleration: 0.18,
      deceleration: 0.08,
      brakeRate: 0.32,
      turnSpeed: 4.8,
      tilt: 0,
      isOffTrack: false,
      inOilSlick: false,
      oilSlideTime: 0,
      oilSlideDir: 0
    };

    const lapDistance = 3600; // Units of road scroll per lap (2x current distance)

    this.state = {
      currentLap: 1,
      targetLaps,
      lapDistanceRemaining: lapDistance,
      lapDistanceTotal: lapDistance,
      lapSplits: [],
      currentLapStartTime: 0,
      raceStartTime: 0,
      penaltiesCount: 0,
      penaltiesSeconds: 0,
      isFinished: false,
      penaltyAlert: null,
      lapNotice: null,
      lastLapSplitMs: null,
      bestLapSplitMs: null
    };

    // Add first finish line banner at the end of Lap 1
    this.lapBanners.push({
      y: -lapDistance,
      lapNumber: 1,
      passed: false
    });
  }

  public getLaneCenterX(laneIndex: number): number {
    return this.ROAD_LEFT + (laneIndex + 0.5) * this.LANE_W;
  }

  public getRoadCurveOffset(y: number): number {
    const curveAtY = Math.sin((this.roadDistance + (this.player.y - y) * 1.2) / 1800);
    const curveAtPlayer = Math.sin(this.roadDistance / 1800);
    return (curveAtY - curveAtPlayer) * 56;
  }

  public update(
    inputs: { forward: boolean; backward: boolean; left: boolean; right: boolean },
    now: number,
    onLapFinished?: (lap: number, splitMs: number) => void,
    onObstacleHit?: (type: string) => void,
    onRaceFinished?: () => void
  ) {
    if (this.state.isFinished) return;

    // Start timer on first movement/update
    if (this.state.raceStartTime === 0) {
      this.state.raceStartTime = now;
      this.state.currentLapStartTime = now;
    }

    // 1. Acceleration / Speed physics
    const offRoadPenalty = this.player.isOffTrack ? 0.45 : 1.0;
    const currentMax = this.player.maxSpeed * offRoadPenalty;

    if (inputs.forward) {
      if (this.player.speed < currentMax) {
        this.player.speed += this.player.acceleration * offRoadPenalty;
      }
    } else if (inputs.backward) {
      if (this.player.speed > 2.0) {
        this.player.speed -= this.player.brakeRate;
      }
    } else {
      // Natural rolling friction
      if (this.player.speed > 6.0) {
        this.player.speed -= this.player.deceleration;
      } else if (this.player.speed < 6.0) {
        // Minimum idle cruise speed
        this.player.speed += 0.05;
      }
    }

    // Cap speed
    this.player.speed = Math.max(1.5, Math.min(this.player.speed, currentMax));

    // 2. Lateral Steering & Oil Slide
    let moveX = 0;
    if (inputs.left) moveX -= this.player.turnSpeed;
    if (inputs.right) moveX += this.player.turnSpeed;

    // Oil Slick sliding effect
    if (this.player.oilSlideTime > 0) {
      this.player.oilSlideTime--;
      moveX += this.player.oilSlideDir * 3.5;
      this.player.tilt = this.player.oilSlideDir * 0.25;
    } else {
      // Car tilt while steering
      const targetTilt = moveX !== 0 ? (moveX > 0 ? 0.08 : -0.08) : 0;
      this.player.tilt += (targetTilt - this.player.tilt) * 0.2;
    }

    this.player.x += moveX;

    // Keep car within canvas bounds
    const minX = 25;
    const maxX = this.CANVAS_W - 25;
    this.player.x = Math.max(minX, Math.min(maxX, this.player.x));

    // Off-track check (outside yellow lines)
    this.player.isOffTrack =
      this.player.x - this.player.width / 2 < this.ROAD_LEFT + 4 ||
      this.player.x + this.player.width / 2 > this.ROAD_RIGHT - 4;

    // Add off-track dust particles
    if (this.player.isOffTrack && Math.random() < 0.4) {
      this.particles.push({
        x: this.player.x + (Math.random() - 0.5) * 20,
        y: this.player.y + this.player.height / 2,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3,
        life: 0,
        maxLife: 18,
        color: 'rgba(120, 113, 108, 0.6)',
        size: 3 + Math.random() * 3
      });
    }

    // 3. Road & Banner Scrolling
    this.roadOffset = (this.roadOffset + this.player.speed) % 80;
    this.roadDistance += this.player.speed;

    // Advance lap distance
    this.state.lapDistanceRemaining -= this.player.speed;

    // Scroll lap banners down
    for (const banner of this.lapBanners) {
      banner.y += this.player.speed;
      if (!banner.passed && banner.y >= this.player.y) {
        banner.passed = true;
        this.handleLapCrossing(now, onLapFinished, onRaceFinished);
      }
    }

    // Remove banners that scrolled past screen
    this.lapBanners = this.lapBanners.filter((b) => b.y < this.CANVAS_H + 200);

    // 4. Traffic & Obstacles Spawning & Scrolling
    this.spawnTimer += this.player.speed;
    if (this.spawnTimer > 145) {
      this.spawnTimer = 0;
      this.spawnHazard();
    }

    // Update traffic positions
    for (const t of this.traffic) {
      // Traffic moves downwards relative to road & player speed
      t.y += (this.player.speed - t.speed);
    }
    // Filter traffic out of screen
    this.traffic = this.traffic.filter((t) => t.y < this.CANVAS_H + 120 && t.y > -400);

    // Update obstacles
    for (const o of this.obstacles) {
      o.y += this.player.speed;
    }
    this.obstacles = this.obstacles.filter((o) => o.y < this.CANVAS_H + 120);

    // 5. Collision Checks
    if (this.hitCooldown > 0) {
      this.hitCooldown--;
    } else {
      this.checkCollisions(now, onObstacleHit);
    }

    // 6. Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake *= 0.85;
      if (this.screenShake < 0.5) this.screenShake = 0;
    }

    // 7. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  private handleLapCrossing(
    now: number,
    onLapFinished?: (lap: number, splitMs: number) => void,
    onRaceFinished?: () => void
  ) {
    const splitTime = now - this.state.currentLapStartTime;
    this.state.lapSplits.push(splitTime);
    this.state.lastLapSplitMs = splitTime;

    if (!this.state.bestLapSplitMs || splitTime < this.state.bestLapSplitMs) {
      this.state.bestLapSplitMs = splitTime;
    }

    this.state.lapNotice = {
      text: `LAP ${this.state.currentLap} COMPLETED: ${(splitTime / 1000).toFixed(2)}s`,
      time: now
    };

    if (onLapFinished) {
      onLapFinished(this.state.currentLap, splitTime);
    }

    if (this.state.currentLap >= this.state.targetLaps) {
      this.state.isFinished = true;
      if (onRaceFinished) onRaceFinished();
    } else {
      this.state.currentLap++;
      this.state.currentLapStartTime = now;
      this.state.lapDistanceRemaining = this.state.lapDistanceTotal;

      // Spawn next checkered line banner
      this.lapBanners.push({
        y: -this.state.lapDistanceTotal,
        lapNumber: this.state.currentLap,
        passed: false
      });
    }
  }

  private spawnHazard() {
    const lane = Math.floor(Math.random() * this.NUM_LANES);
    const laneX = this.getLaneCenterX(lane);

    // Don't spawn if something is already in that lane nearby
    const hasOverlap =
      this.traffic.some((t) => t.lane === lane && t.y < 0) ||
      this.obstacles.some((o) => o.lane === lane && o.y < 0);
    if (hasOverlap) return;

    const roll = Math.random();
    if (roll < 0.35) {
      // Spawn traffic car
      const colors: ('blue' | 'yellow' | 'green' | 'purple' | 'silver')[] = [
        'blue', 'yellow', 'green', 'purple', 'silver'
      ];
      this.traffic.push({
        id: 't_' + Math.random().toString(36).slice(2, 7),
        lane,
        x: laneX,
        y: -120,
        width: 40,
        height: 72,
        speed: 4.5 + Math.random() * 3.5, // traffic drives at 4.5-8.0
        color: colors[Math.floor(Math.random() * colors.length)],
        active: true
      });
    } else if (roll < 0.70) {
      // Spawn road cone
      this.obstacles.push({
        id: 'c_' + Math.random().toString(36).slice(2, 7),
        type: 'CONE',
        lane,
        x: laneX + (Math.random() - 0.5) * 20,
        y: -80,
        width: 26,
        height: 26,
        active: true
      });
    } else if (roll < 0.90) {
      // Spawn road safety barrier
      this.obstacles.push({
        id: 'b_' + Math.random().toString(36).slice(2, 7),
        type: 'BARRIER',
        lane,
        x: laneX,
        y: -90,
        width: 52,
        height: 28,
        active: true
      });
    } else {
      // Spawn oil slick
      this.obstacles.push({
        id: 'o_' + Math.random().toString(36).slice(2, 7),
        type: 'OIL_SLICK',
        lane,
        x: laneX,
        y: -90,
        width: 48,
        height: 36,
        active: true
      });
    }
  }

  private checkCollisions(now: number, onObstacleHit?: (type: string) => void) {
    const p = this.player;
    const pLeft = p.x - p.width / 2 + 6;
    const pRight = p.x + p.width / 2 - 6;
    const pTop = p.y - p.height / 2 + 6;
    const pBottom = p.y + p.height / 2 - 6;

    // Check traffic cars
    for (const t of this.traffic) {
      const tLeft = t.x - t.width / 2 + 4;
      const tRight = t.x + t.width / 2 - 4;
      const tTop = t.y - t.height / 2 + 4;
      const tBottom = t.y + t.height / 2 - 4;

      if (pLeft < tRight && pRight > tLeft && pTop < tBottom && pBottom > tTop) {
        this.triggerCollision('TRAFFIC CAR', now, onObstacleHit);
        // Push traffic car ahead
        t.y -= 30;
        return;
      }
    }

    // Check obstacles
    for (const o of this.obstacles) {
      if (o.type === 'OIL_SLICK') {
        const dist = Math.hypot(p.x - o.x, p.y - o.y);
        if (dist < 32 && p.oilSlideTime <= 0) {
          p.oilSlideTime = 25;
          p.oilSlideDir = Math.random() > 0.5 ? 1 : -1;
          this.state.penaltyAlert = { text: '⚠️ OIL SLICK SLIP!', time: now };
        }
        continue;
      }

      const oLeft = o.x - o.width / 2;
      const oRight = o.x + o.width / 2;
      const oTop = o.y - o.height / 2;
      const oBottom = o.y + o.height / 2;

      if (pLeft < oRight && pRight > oLeft && pTop < oBottom && pBottom > oTop) {
        this.triggerCollision(o.type, now, onObstacleHit);
        // Remove hit cone/barrier
        o.y = 9999;
        return;
      }
    }
  }

  private triggerCollision(type: string, now: number, onObstacleHit?: (type: string) => void) {
    this.hitCooldown = 60; // 1 second cooldown
    this.screenShake = 14;  // screen rumble
    this.player.speed = Math.max(3.0, this.player.speed * 0.4); // 60% speed loss

    // Spawn sparks
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: this.player.x + (Math.random() - 0.5) * 20,
        y: this.player.y - this.player.height / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 0,
        maxLife: 24,
        color: '#f59e0b',
        size: 3 + Math.random() * 4
      });
    }

    this.state.penaltiesCount++;
    this.state.penaltiesSeconds += 3;
    this.state.penaltyAlert = {
      text: `⚠️ COLLISION! +3s PENALTY`,
      time: now
    };

    if (onObstacleHit) onObstacleHit(type);
  }
}
