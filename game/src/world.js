// Tidebound Light — the lighthouse stealth simulation.
// Pure logic, no DOM: the renderer draws what this module decides,
// the headless test drives it with synthetic input, and the tide,
// the lamp beam and the keepers all run on the same fixed rules.

import { LEVELS } from './levels.js';
import {
  COLS, ROWS, PLAYER_SPEED, PLAYER_SNEAK_SPEED, PLAYER_WADE_SPEED,
  PLAYER_RADIUS, KEEPER_PATROL_SPEED, KEEPER_PROWL_SPEED,
  KEEPER_CHASE_SPEED, KEEPER_RANGE, CONE_HALF, DETECT_FILL,
  DETECT_BEAM, DETECT_DRAIN, START_COVERS, STONES_PER_LEVEL,
  TIDE_PERIOD, TIDE_HIGH_FROM, TIDE_HIGH_TO, BEAM_SPEED, BEAM_HALF,
  BEAM_RANGE, NOISE_WALK, NOISE_SPLASH, NOISE_SNEAK,
  NOISE_SNEAK_SPLASH, STONE_HEARING, SCORE_KEY, SCORE_SALVAGE,
  SCORE_CLEAR, SCORE_GHOST, SCORE_STONE_LEFT,
} from './config.js';

export const EVENT_CAUGHT = 'caught';
export const EVENT_LEVEL_CLEAR = 'level-clear';
export const EVENT_GAME_CLEAR = 'game-clear';
export const EVENT_GAME_OVER = 'game-over';

export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return level.grid[ty][tx];
}

export function tidePhaseAt(time) {
  return (time % TIDE_PERIOD) / TIDE_PERIOD;
}

export function tideIsHigh(time) {
  const p = tidePhaseAt(time);
  return p >= TIDE_HIGH_FROM && p <= TIDE_HIGH_TO;
}

// Feet are blocked by rock, crates, and by the low causeway while
// the tide is over it. Sight is blocked only by rock and crates.
export function blocksFeet(level, tx, ty, high) {
  const ch = tileAt(level, tx, ty);
  if (ch === '#' || ch === 'B') return true;
  if (ch === '=' && high) return true;
  return false;
}

export function blocksSight(level, tx, ty) {
  const ch = tileAt(level, tx, ty);
  return ch === '#' || ch === 'B';
}

export function hasLineOfSight(level, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 0.15));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksSight(level, Math.floor(x1 + dx * t), Math.floor(y1 + dy * t))) return false;
  }
  return true;
}

// Breadth-first route over feet-passable tiles (tide ignored, so a
// route exists across the causeway for when the tide is out).
export function findPath(level, sx, sy, tx, ty) {
  const key = (x, y) => y * COLS + x;
  const prev = new Map([[key(sx, sy), -1]]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || blocksFeet(level, nx, ny, false)) continue;
      prev.set(k, key(x, y));
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = [];
  let cur = key(tx, ty);
  while (cur !== -1) {
    path.unshift([cur % COLS, Math.floor(cur / COLS)]);
    cur = prev.get(cur);
  }
  return path;
}

function findChar(level, ch) {
  for (let y = 0; y < ROWS; y++) {
    const x = level.grid[y].indexOf(ch);
    if (x >= 0) return { x: x + 0.5, y: y + 0.5, tx: x, ty: y };
  }
  return null;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(levelIndex, carry = {}) {
  const level = LEVELS[levelIndex];
  const start = findChar(level, 'P');
  const keyPos = findChar(level, 'K');
  const exitPos = findChar(level, 'X');
  const salvage = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (level.grid[y][x] === 'o') salvage.push({ x: x + 0.5, y: y + 0.5, taken: false });
  }
  const guards = level.patrols.map((waypoints, gi) => {
    const [wx, wy] = waypoints[0];
    return {
      x: wx + 0.5, y: wy + 0.5, face: gi * 1.7 + 0.4,
      waypoints, wpIndex: 1 % waypoints.length,
      path: null, pathIdx: 0, repath: 0,
      state: 'patrol', stateTime: 0,
      target: null, lastSeen: null, scanDir: 1,
    };
  });
  return {
    levelIndex, level, time: 0,
    player: { x: start.x, y: start.y, face: 0.3, moving: false, sneaking: false, wading: false },
    key: { x: keyPos.x, y: keyPos.y, taken: false },
    exit: { x: exitPos.x, y: exitPos.y },
    salvage, guards,
    detection: 0, seen: false, litByBeam: false,
    stones: STONES_PER_LEVEL, splashes: [],
    score: carry.score ?? 0,
    covers: carry.covers ?? START_COVERS,
    ghost: true, cleared: false, over: false,
    alarmFlash: 0, message: null,
  };
}

export function retryLevel(w) {
  const fresh = createWorld(w.levelIndex, { score: w.score, covers: w.covers });
  fresh.time = w.time;
  return fresh;
}

function circleHitsWall(level, x, y, high) {
  const r = PLAYER_RADIUS;
  for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
    if (blocksFeet(level, Math.floor(cx), Math.floor(cy), high)) return true;
  }
  return false;
}

function moveActor(level, actor, dx, dy, high) {
  const nx = actor.x + dx;
  if (!circleHitsWall(level, nx, actor.y, high)) actor.x = nx;
  const ny = actor.y + dy;
  if (!circleHitsWall(level, actor.x, ny, high)) actor.y = ny;
}

// Steer a keeper along a pathfound route toward a tile target.
function steerGuard(w, g, tx, ty, speed, dt) {
  g.repath -= dt;
  if (!g.path || g.pathIdx >= g.path.length || g.repath <= 0) {
    g.path = findPath(w.level, Math.floor(g.x), Math.floor(g.y), tx, ty);
    g.pathIdx = 0;
    g.repath = 0.6;
    if (g.path && g.path.length > 1) g.pathIdx = 1;
  }
  if (!g.path) return true;
  const [px, py] = g.path[Math.min(g.pathIdx, g.path.length - 1)];
  const gx = px + 0.5, gy = py + 0.5;
  const dx = gx - g.x, dy = gy - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.12) {
    g.pathIdx++;
    return g.pathIdx >= g.path.length;
  }
  const step = Math.min(dist, speed * dt);
  moveActor(w.level, g, (dx / dist) * step, (dy / dist) * step, tideIsHigh(w.time));
  g.face = angleLerp(g.face, Math.atan2(dy, dx), 10 * dt);
  return false;
}

export function beamAngleAt(w) {
  return w.time * BEAM_SPEED + w.levelIndex * 2.1 + 0.7;
}

export function playerLitByBeam(w) {
  const lamp = w.level.lamp;
  if (!lamp) return false;
  const dx = w.player.x - lamp.x, dy = w.player.y - lamp.y;
  const dist = Math.hypot(dx, dy);
  if (dist > BEAM_RANGE || dist < 0.8) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), beamAngleAt(w))) > BEAM_HALF) return false;
  return hasLineOfSight(w.level, lamp.x, lamp.y, w.player.x, w.player.y);
}

export function stepWorld(w, input, dt) {
  const events = [];
  if (w.cleared || w.over) return events;
  w.time += dt;
  const high = tideIsHigh(w.time);
  const p = w.player;
  const pTile = tileAt(w.level, Math.floor(p.x), Math.floor(p.y));
  p.wading = pTile === '~' || pTile === '=';
  p.sneaking = !!input.sneak;

  // --- the tide-runner moves -------------------------------------
  let mx = input.dx ?? 0, my = input.dy ?? 0;
  const mag = Math.hypot(mx, my);
  p.moving = mag > 0;
  if (p.moving) {
    mx /= mag; my /= mag;
    let speed = p.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_SPEED;
    if (p.wading && !p.sneaking) speed = Math.min(speed, PLAYER_WADE_SPEED + 0.7);
    if (p.wading && p.sneaking) speed = PLAYER_SNEAK_SPEED;
    moveActor(w.level, p, mx * speed * dt, my * speed * dt, high);
    p.face = angleLerp(p.face, Math.atan2(my, mx), 14 * dt);
    // noise: splashing carries, sneaking muffles
    const radius = p.wading
      ? (p.sneaking ? NOISE_SNEAK_SPLASH : NOISE_SPLASH)
      : (p.sneaking ? NOISE_SNEAK : NOISE_WALK);
    for (const g of w.guards) {
      if (g.state === 'chase') continue;
      if (Math.hypot(g.x - p.x, g.y - p.y) < radius) {
        g.state = 'suspicious';
        g.target = { x: p.x, y: p.y };
        g.stateTime = 0;
        g.path = null;
      }
    }
  }

  // --- a thrown stone splashes -----------------------------------
  if (input.throwAt && w.stones > 0) {
    w.stones--;
    const sx = Math.max(1, Math.min(COLS - 2, input.throwAt.x));
    const sy = Math.max(1, Math.min(ROWS - 2, input.throwAt.y));
    w.splashes.push({ x: sx, y: sy, t: 0 });
    events.push('stone');
    for (const g of w.guards) {
      if (g.state === 'chase') continue;
      if (Math.hypot(g.x - sx, g.y - sy) < STONE_HEARING) {
        g.state = 'distracted';
        g.target = { x: sx, y: sy };
        g.stateTime = 0;
        g.path = null;
      }
    }
  }
  for (const s of w.splashes) s.t += dt;
  w.splashes = w.splashes.filter((s) => s.t < 1.2);

  // --- who can see the runner? -----------------------------------
  w.litByBeam = playerLitByBeam(w);
  let bestFactor = 0;
  let seer = null;
  for (const g of w.guards) {
    const dx = p.x - g.x, dy = p.y - g.y;
    const dist = Math.hypot(dx, dy);
    g.sees = false;
    if (dist < KEEPER_RANGE) {
      const ang = Math.abs(angleDiff(Math.atan2(dy, dx), g.face));
      if (ang < CONE_HALF && hasLineOfSight(w.level, g.x, g.y, p.x, p.y)) {
        let factor = dist < 1.1 ? 1.6 : 1;
        if (pTile === 's') factor *= 0.35;
        if (p.sneaking) factor *= 0.65;
        if (dist > KEEPER_RANGE * 0.7) factor *= 0.7;
        g.sees = true;
        if (factor > bestFactor) { bestFactor = factor; seer = g; }
      }
    }
  }
  if (w.litByBeam) {
    // The great lamp cares nothing for kelp or crouching.
    bestFactor = Math.max(bestFactor, 0.85);
    if (!seer) seer = w.guards[0] ?? null;
  }
  if (bestFactor > 0) {
    w.detection += (dt / DETECT_FILL) * bestFactor;
    if (w.litByBeam) w.detection += dt * DETECT_BEAM * 0.32;
    w.seen = true;
    w.ghost = false;
    if (seer) {
      seer.lastSeen = { x: p.x, y: p.y };
      if (w.detection > 0.35 && seer.state !== 'chase') {
        seer.state = 'suspicious';
        seer.target = { x: p.x, y: p.y };
        seer.stateTime = 0;
        seer.path = null;
      }
    }
  } else {
    w.detection -= DETECT_DRAIN * dt;
  }
  w.detection = Math.max(0, Math.min(1, w.detection));
  if (w.detection >= 1) {
    w.alarmFlash = 0.8;
    for (const g of w.guards) {
      if (Math.hypot(g.x - p.x, g.y - p.y) < KEEPER_RANGE * 1.7) {
        g.state = 'chase';
        g.lastSeen = { x: p.x, y: p.y };
        g.stateTime = 0;
        g.path = null;
      }
    }
    w.detection = 0.82;
    events.push('alarm');
  }
  if (w.alarmFlash > 0) w.alarmFlash -= dt;

  // --- keepers act ------------------------------------------------
  for (const g of w.guards) {
    g.stateTime += dt;
    if (g.state === 'patrol') {
      const [tx, ty] = g.waypoints[g.wpIndex];
      if (steerGuard(w, g, tx, ty, KEEPER_PATROL_SPEED, dt)) {
        g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        g.path = null;
      }
    } else if (g.state === 'suspicious' || g.state === 'distracted') {
      const wait = g.state === 'distracted' ? 2.2 : 2.6;
      if (g.target) {
        const arrived = steerGuard(w, g, Math.floor(g.target.x), Math.floor(g.target.y), KEEPER_PROWL_SPEED, dt);
        if (arrived) {
          g.face += Math.sin(w.time * 1.7 + g.wpIndex) * 1.4 * dt;
          if (g.stateTime > wait + 1.2) { g.state = 'patrol'; g.target = null; g.path = null; }
        }
      } else if (g.stateTime > wait) { g.state = 'patrol'; g.path = null; }
    } else if (g.state === 'chase') {
      const dest = g.sees ? { x: p.x, y: p.y } : g.lastSeen;
      if (dest) steerGuard(w, g, Math.floor(dest.x), Math.floor(dest.y), KEEPER_CHASE_SPEED, dt);
      if (g.sees) g.lastSeen = { x: p.x, y: p.y };
      if (!g.sees && g.stateTime > 3.2) { g.state = 'suspicious'; g.target = g.lastSeen; g.stateTime = 0; g.path = null; }
      if (g.stateTime > 9) { g.state = 'patrol'; g.path = null; }
    }
    if (g.state === 'chase' && Math.hypot(g.x - p.x, g.y - p.y) < 0.62) {
      w.covers--;
      events.push(EVENT_CAUGHT);
      if (w.covers < 0) { w.over = true; events.push(EVENT_GAME_OVER); }
      return events;
    }
  }

  // --- pickups and the way out ------------------------------------
  if (!w.key.taken && Math.hypot(p.x - w.key.x, p.y - w.key.y) < 0.62) {
    w.key.taken = true;
    w.score += SCORE_KEY;
    events.push('key');
  }
  for (const s of w.salvage) {
    if (!s.taken && Math.hypot(p.x - s.x, p.y - s.y) < 0.6) {
      s.taken = true;
      w.score += SCORE_SALVAGE;
      events.push('salvage');
    }
  }
  if (w.key.taken && Math.hypot(p.x - w.exit.x, p.y - w.exit.y) < 0.72) {
    w.score += SCORE_CLEAR + w.stones * SCORE_STONE_LEFT + (w.ghost ? SCORE_GHOST : 0);
    w.cleared = true;
    events.push(w.levelIndex === LEVELS.length - 1 ? EVENT_GAME_CLEAR : EVENT_LEVEL_CLEAR);
  }
  return events;
}
