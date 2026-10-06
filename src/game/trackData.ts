export interface Point {
  x: number;
  y: number;
}

export interface CheckpointGate {
  id: number;
  name: string;
  p1: Point;
  p2: Point;
  center: Point;
  directionAngle: number; // ideal forward heading in radians
}

export interface Obstacle {
  id: string;
  type: 'CONE' | 'BARRIER' | 'OIL_SLICK';
  x: number;
  y: number;
  radius: number;
  color?: string;
  name: string;
}

// Circuit definition: track center waypoints
// Form a closed Grand Prix loop in a 1400 x 950 virtual canvas coordinate space
export const TRACK_WAYPOINTS: Point[] = [
  { x: 350, y: 800 },  // 0: Start / Finish Main Straight
  { x: 750, y: 800 },  // 1: End of Main Straight
  { x: 1050, y: 780 }, // 2: Approach Turn 1
  { x: 1240, y: 640 }, // 3: Turn 1 Apex
  { x: 1220, y: 380 }, // 4: Turn 2 Sweeper
  { x: 1040, y: 220 }, // 5: High-speed Back Straight entry
  { x: 680, y: 160 },  // 6: Back Straight mid
  { x: 420, y: 160 },  // 7: Back Straight braking zone
  { x: 200, y: 260 },  // 8: Technical Chicane entry
  { x: 300, y: 440 },  // 9: Mid Infield S-Bend
  { x: 180, y: 600 },  // 10: Final Turn entry
  { x: 220, y: 760 },  // 11: Final Turn exit to Main Straight
];

export const TRACK_WIDTH = 130; // standard width of the tarmac
export const CANVAS_WIDTH = 1400;
export const CANVAS_HEIGHT = 950;

// 6 Checkpoint Gates placed across the track width
export const CHECKPOINTS: CheckpointGate[] = [
  {
    id: 0,
    name: 'Start / Finish Line',
    p1: { x: 350, y: 800 - TRACK_WIDTH / 2 },
    p2: { x: 350, y: 800 + TRACK_WIDTH / 2 },
    center: { x: 350, y: 800 },
    directionAngle: 0 // pointing right (+x)
  },
  {
    id: 1,
    name: 'Sector 1 - Turn 1 Entry',
    p1: { x: 1050 - 45, y: 780 - TRACK_WIDTH / 2 },
    p2: { x: 1050 + 45, y: 780 + TRACK_WIDTH / 2 },
    center: { x: 1050, y: 780 },
    directionAngle: -0.2
  },
  {
    id: 2,
    name: 'Sector 1 - Turn 2 Apex',
    p1: { x: 1220 - TRACK_WIDTH / 2, y: 380 },
    p2: { x: 1220 + TRACK_WIDTH / 2, y: 380 },
    center: { x: 1220, y: 380 },
    directionAngle: -Math.PI / 2 // pointing up
  },
  {
    id: 3,
    name: 'Sector 2 - Back Straight',
    p1: { x: 680, y: 160 - TRACK_WIDTH / 2 },
    p2: { x: 680, y: 160 + TRACK_WIDTH / 2 },
    center: { x: 680, y: 160 },
    directionAngle: Math.PI // pointing left
  },
  {
    id: 4,
    name: 'Sector 2 - Chicane S-Bend',
    p1: { x: 300 - TRACK_WIDTH / 2, y: 440 },
    p2: { x: 300 + TRACK_WIDTH / 2, y: 440 },
    center: { x: 300, y: 440 },
    directionAngle: Math.PI * 0.7
  },
  {
    id: 5,
    name: 'Sector 3 - Final Turn',
    p1: { x: 180 - TRACK_WIDTH / 2, y: 600 },
    p2: { x: 180 + TRACK_WIDTH / 2, y: 600 },
    center: { x: 180, y: 600 },
    directionAngle: Math.PI / 2 // pointing down to main straight
  }
];

// Strategic obstacles placed around the circuit to test racing lines
export const DEFAULT_OBSTACLES: Obstacle[] = [
  // Cones at Turn 1 outer runoff
  { id: 'c1', type: 'CONE', x: 1290, y: 670, radius: 14, name: 'T1 Outer Cone' },
  { id: 'c2', type: 'CONE', x: 1305, y: 640, radius: 14, name: 'T1 Outer Cone' },

  // Barrier clipping Turn 2 inner apex
  { id: 'b1', type: 'BARRIER', x: 1160, y: 380, radius: 16, name: 'T2 Apex Barrier' },

  // Back straight chicane cones (tightens the racing line)
  { id: 'c3', type: 'CONE', x: 550, y: 130, radius: 14, name: 'Straight Cone High' },
  { id: 'c4', type: 'CONE', x: 550, y: 195, radius: 14, name: 'Straight Cone Low' },

  // Oil slick near Technical Chicane (causing slip)
  { id: 'o1', type: 'OIL_SLICK', x: 230, y: 290, radius: 24, name: 'Chicane Oil Patch' },

  // S-Bend apex barriers
  { id: 'b2', type: 'BARRIER', x: 345, y: 460, radius: 16, name: 'S-Bend Barrier' },

  // Final Corner Inner Cone
  { id: 'c5', type: 'CONE', x: 150, y: 560, radius: 14, name: 'Final Turn Cone' },
  { id: 'c6', type: 'CONE', x: 190, y: 720, radius: 14, name: 'Pit Entry Cone' },
];

// Helper: distance between point and line segment
export function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projX, p.y - projY);
}

// Line segment intersection detection (for crossing checkpoint lines)
export function segmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point
): boolean {
  function ccw(pA: Point, pB: Point, pC: Point): boolean {
    return (pC.y - pA.y) * (pB.x - pA.x) > (pB.y - pA.y) * (pC.x - pA.x);
  }
  return (
    ccw(a1, b1, b2) !== ccw(a2, b1, b2) &&
    ccw(a1, a2, b1) !== ccw(a1, a2, b2)
  );
}

// Distance to closest point on the track loop
export function getDistanceToTrackCenter(p: Point): { distance: number; closestSegmentIndex: number } {
  let minDistance = Infinity;
  let closestIndex = 0;
  const count = TRACK_WAYPOINTS.length;

  for (let i = 0; i < count; i++) {
    const p1 = TRACK_WAYPOINTS[i];
    const p2 = TRACK_WAYPOINTS[(i + 1) % count];
    const d = distToSegment(p, p1, p2);
    if (d < minDistance) {
      minDistance = d;
      closestIndex = i;
    }
  }

  return { distance: minDistance, closestSegmentIndex: closestIndex };
}
