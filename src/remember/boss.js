import * as THREE from 'three';
import * as models from './models.js';
import { createPowers, createParticles, beamGeometry, beamMaterial, UP } from './powers.js';
import { rankFor } from './memory.js';
import { LANDMARKS } from '../world/city/bible.js';
import { lots } from '../world/city/lots.js';

// The final boss: a toy kaiju wades out of the river and marches on the mayor's office (the spire).
// Laser vision and ice breath wear it down; hitting it builds aggro, and an angry kaiju turns on you
// instead of the city. Everything the kaiju decides lives in createFight() (pure, tested with bots);
// the mode below turns that into models, beams, rubble and a HUD.

export const BOSS = {
  hp: 3000, speed: 6, phaseSpeed: [1, 1.12, 1.25], turn: 0.8,
  laser: { body: 60, weak: 2, frozen: 1.5 },   // damage per second of exposure; weak points and a frozen kaiju multiply it
  slow: { secs: 3.2, factor: 0.4 },
  freeze: { fill: 0.55, decay: 0.25, secs: 2.6, immune: 7 },
  aggro: { engage: 0.6, release: 0.2, perDamage: 1 / 260, perIce: 0.22, perNear: 0.05, decay: 0.15, quiet: 1 },
  stalk: { far: 95, speed: 0.55, near: 3.5, nearRange: 60 },
  breath: { windup: 1.2, lock: 0.3, fire: 1.5, recover: 0.9, sweep: 0.7, radius: 4.5, length: 260, cd: [7, 5.6, 4.4], damage: 18 },
  swipe: { windup: 0.7, hit: 0.3, recover: 0.7, range: 50, arc: 1.15, height: 40, cd: 4.5, damage: 25 },
  roar: { windup: 0.9, hold: 0.7, range: 70, cd: 13, damage: 10, knock: 75 },
  hall: { reach: 40, secs: 4.5 },
  player: { hp: 100, iframes: 1.2 },
};

// --- Pure helpers ------------------------------------------------------------

const TAU = Math.PI * 2;
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// Heading convention shared with the rig: forward is (-sin h, -cos h).
export const headingTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
const flat = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const ease = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };

export function phaseFor(hpFrac) { return hpFrac > 0.66 ? 0 : hpFrac > 0.33 ? 1 : 2; }

// Aggro rises with damage and ice, a little with loitering close by, and falls once you stop.
export function aggroStep(a, { damage = 0, ice = 0, near = false, quiet = 0 }, dt, T = BOSS.aggro) {
  a += damage * T.perDamage + ice * T.perIce + (near ? T.perNear * dt : 0);
  if (quiet > T.quiet) a -= T.decay * dt;
  return Math.min(1, Math.max(0, a));
}
export function engagedNow(was, a, T = BOSS.aggro) { return was ? a > T.release : a >= T.engage; }

// Laser damage for `dt` seconds on a target; weak points double it and a frozen kaiju takes half again.
export function laserDamage(dt, weak, frozen, T = BOSS.laser) { return T.body * dt * (weak ? T.weak : 1) * (frozen ? T.frozen : 1); }

// Distance from a point to a segment.
export function pointSegDist(px, py, pz, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz;
  const u = L2 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / L2)) : 0;
  return Math.hypot(px - (ax + dx * u), py - (ay + dy * u), pz - (az + dz * u));
}

// How far the breath has swept (radians) u of the way through the blast: it starts just short of where you were.
export function sweepAngle(u, dir, span = BOSS.breath.sweep) { return dir * span * (u - 0.35); }

// A waypoint list from the river to the mayor's office, bent a little so the walk is not a ruler line.
export function pathToHall(from, hall, bends = 3) {
  const dx = hall.x - from.x, dz = hall.z - from.z, L = Math.hypot(dx, dz) || 1, px = -dz / L, pz = dx / L;
  const pts = [{ x: from.x, z: from.z }];
  for (let i = 1; i <= bends; i++) {
    const u = i / (bends + 1), off = Math.sin(u * TAU) * 26;
    pts.push({ x: from.x + dx * u + px * off, z: from.z + dz * u + pz * off });
  }
  pts.push({ x: hall.x, z: hall.z });
  return pts;
}
export function pathLength(path) { let n = 0; for (let i = 1; i < path.length; i++) n += flat(path[i].x, path[i].z, path[i - 1].x, path[i - 1].z); return n; }

// The roof height over a point: the tallest tier record that covers it.
export function roofAt(buildings, x, z) {
  let h = 0;
  for (const b of buildings) if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && b.height > h) h = b.height;
  return h;
}

// Where the mayor's office stands: the middle of the spire's lot (the landmark's own point sits on the lot's corner).
export function hallPoint(briefs) {
  const b = briefs.find((l) => l.landmark === 'spire');
  return b ? { x: b.x, z: b.z, id: b.id } : { x: LANDMARKS.find((l) => l.id === 'spire').at[0], z: LANDMARKS.find((l) => l.id === 'spire').at[1], id: null };
}

// Lot briefs whose footprint touches a circle.
export function lotsInCircle(briefs, x, z, r, out = []) {
  out.length = 0;
  for (const b of briefs) {
    const cx = Math.min(Math.max(x, b.x - b.w / 2), b.x + b.w / 2), cz = Math.min(Math.max(z, b.z - b.d / 2), b.z + b.d / 2);
    if ((cx - x) ** 2 + (cz - z) ** 2 <= r * r) out.push(b);
  }
  return out;
}

// Is a point behind the kaiju, within tail reach and low enough for the tail to catch it?
export function inTailZone(f, p, T = BOSS.swipe) {
  const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz);
  if (d > T.range || d < 1 || p.y > T.height) return false;
  return Math.abs(angDiff(Math.atan2(dx, dz), Math.atan2(Math.sin(f.heading), Math.cos(f.heading)))) < T.arc;
}

// Score and rank. A win is worth the most when it is fast, clean and leaves the mayor's office and you in one piece.
export const RANKS = [9300, 8000, 6600, 5000];
export function scoreFor({ won, dealt, weakShare = 0, timeLeft = 0, lots = 0, hall = 0, hpLeft = 0 }) {
  const combat = dealt * 0.6 * (1 + weakShare * 0.5);
  const saved = Math.max(0, 2200 - lots * 45);
  if (!won) return Math.round(combat * 0.5 + saved * 0.2);
  return Math.round(combat + 2400 + timeLeft * 11 + hall * 1200 + saved + hpLeft * 11);
}
export function rankOf(score, won) { return won ? rankFor(score, RANKS) : 'D'; }

// --- The kaiju's brain -----------------------------------------------------------

const KAIJU_START = { x: 500, z: -262 };

// One fight, no three.js: where the kaiju is, what it is doing and what it wants. step() takes the
// frame's { player: {x, y, z}, damage (already scaled), ice (seconds of exposure) } and returns the
// events of that frame: engage, disengage, phase, frozen, thaw, smash:start, breath:windup,
// breath:lock, breath:fire, breath:end, swipe:windup, swipe:hit, roar:windup, roar:blast,
// hall:destroyed, dead.
export function createFight({ path, tuning = {} } = {}) {
  const T = { ...BOSS, ...tuning };
  const wp = path || pathToHall(KAIJU_START, hallPoint(lots()));
  const f = {
    T, path: wp, hall: wp[wp.length - 1], hp: T.hp, max: T.hp, dealt: 0, x: wp[0].x, z: wp[0].z, heading: headingTo(wp[0].x, wp[0].z, wp[1].x, wp[1].z),
    state: 'march', t: 0, age: 0, i: 1, speed: 0, aggro: 0, engaged: false, quiet: 9, near: 0, phase: 0, pendingRoar: false,
    slowT: 0, freeze: 0, frozenT: 0, immuneT: 0, hallHp: 1, smash: 0, walked: 0,
    cd: { breath: 4, swipe: 0, roar: 6 }, lock: false, fired: false, firing: false, fireU: 0, W: 0, sweepDir: 1, swipeSide: 1, shots: 0,
    anim: { roar: 0, breath: 0, swipe: 0, frozen: 0, aimYaw: 0 },
    events: [],
  };
  const ev = f.events;
  const slowed = () => f.slowT > 0;
  const speedNow = () => T.speed * T.phaseSpeed[f.phase] * (slowed() ? T.slow.factor : 1);
  const turnNow = () => T.turn * (slowed() ? 0.55 : 1);
  const go = (state) => { f.state = state; f.t = 0; f.lock = false; f.fired = false; f.firing = false; };
  const resume = () => go(f.engaged ? 'stalk' : 'march');

  function turnToward(dt, want, mul) {
    const d = angDiff(want, f.heading), rate = turnNow() * mul * dt;
    f.heading += Math.max(-rate, Math.min(rate, d));
    return d;
  }
  function walkTo(dt, tx, tz, mul = 1) {
    const d = turnToward(dt, headingTo(f.x, f.z, tx, tz), 1);
    if (Math.abs(d) < 0.7) {
      const v = speedNow() * mul * (Math.abs(d) < 0.25 ? 1 : 0.5);
      f.x -= Math.sin(f.heading) * v * dt; f.z -= Math.cos(f.heading) * v * dt; f.speed = v; f.walked += v * dt;
    }
  }
  const turnTo = (dt, tx, tz, mul = 1) => turnToward(dt, headingTo(f.x, f.z, tx, tz), mul);

  f.step = (dt, { player: p, damage = 0, ice = 0 }) => {
    ev.length = 0;
    f.age += dt; f.t += dt; f.speed = 0;
    for (const k in f.cd) f.cd[k] = Math.max(0, f.cd[k] - dt);
    f.slowT = Math.max(0, f.slowT - dt); f.immuneT = Math.max(0, f.immuneT - dt);
    if (f.state === 'dead' || f.state === 'won') return ev;

    if (damage > 0) { f.hp = Math.max(0, f.hp - damage); f.dealt += damage; }
    if (f.hp <= 0) { go('dead'); f.anim.frozen = 0; ev.push('dead'); return ev; }
    const ph = phaseFor(f.hp / f.max);
    if (ph > f.phase) { f.phase = ph; f.pendingRoar = true; ev.push('phase'); }

    if (ice > 0) {
      f.slowT = T.slow.secs;
      if (f.state !== 'frozen' && f.immuneT <= 0) f.freeze += ice * T.freeze.fill;
    } else f.freeze = Math.max(0, f.freeze - dt * T.freeze.decay);
    f.quiet = damage > 0 || ice > 0 ? 0 : f.quiet + dt;
    const dist = flat(p.x, p.z, f.x, f.z), close = dist < T.stalk.nearRange;
    f.near = close ? f.near + dt : Math.max(0, f.near - dt * 2);
    f.aggro = aggroStep(f.aggro, { damage, ice, near: close, quiet: f.quiet }, dt, T.aggro);
    const was = f.engaged;
    f.engaged = engagedNow(was, f.aggro, T.aggro);
    if (f.engaged !== was) ev.push(f.engaged ? 'engage' : 'disengage');

    if (f.freeze >= 1 && f.state !== 'frozen') {
      f.freeze = 0; f.frozenT = T.freeze.secs; f.immuneT = T.freeze.immune + T.freeze.secs; f.cd.breath = Math.max(f.cd.breath, 2.2);
      go('frozen'); ev.push('frozen');
    }

    switch (f.state) {
      case 'frozen':
        f.frozenT -= dt;
        if (f.frozenT <= 0) { ev.push('thaw'); resume(); }
        break;
      case 'march': {
        if (f.engaged) { go('stalk'); break; }
        if (flat(f.x, f.z, f.hall.x, f.hall.z) <= T.hall.reach) { go('smash'); ev.push('smash:start'); break; }
        const w = f.path[f.i];
        if (flat(f.x, f.z, w.x, w.z) < 14 && f.i < f.path.length - 1) f.i++;
        walkTo(dt, f.path[f.i].x, f.path[f.i].z);
        break;
      }
      case 'smash':
        if (f.engaged) { f.smash = 0; go('stalk'); break; }
        f.smash += dt;
        turnTo(dt, f.hall.x, f.hall.z);
        f.hallHp -= dt / T.hall.secs;
        if (f.hallHp <= 0) { f.hallHp = 0; go('won'); ev.push('hall:destroyed'); }
        break;
      case 'stalk': {
        if (!f.engaged && f.t > 0.4) { resume(); break; }
        if (dist > T.stalk.far) walkTo(dt, p.x, p.z, T.stalk.speed); else turnTo(dt, p.x, p.z);
        if (f.t < 0.6) break;
        if (f.pendingRoar) { f.pendingRoar = false; go('roar'); ev.push('roar:windup'); }
        else if (f.cd.swipe <= 0 && inTailZone(f, p, T.swipe)) {
          go('swipe'); f.swipeSide = (p.x - f.x) * Math.cos(f.heading) - (p.z - f.z) * Math.sin(f.heading) >= 0 ? 1 : -1; ev.push('swipe:windup');
        } else if (f.cd.roar <= 0 && f.near >= T.stalk.near && dist < T.roar.range) { go('roar'); ev.push('roar:windup'); }
        else if (f.cd.breath <= 0) { go('breath'); f.W = T.breath.windup * (slowed() ? 1.3 : 1); f.sweepDir = (f.shots++ & 1) ? -1 : 1; ev.push('breath:windup'); }
        break;
      }
      case 'breath': {
        const B = T.breath;
        if (f.t < f.W) {
          if (!f.lock) turnTo(dt, p.x, p.z, 1.3);
          if (!f.lock && f.t >= f.W - B.lock) { f.lock = true; ev.push('breath:lock'); }
        } else if (f.t < f.W + B.fire) {
          if (!f.fired) { f.fired = true; ev.push('breath:fire'); }
          f.firing = true; f.fireU = (f.t - f.W) / B.fire;
        } else {
          f.firing = false;
          if (f.t >= f.W + B.fire + B.recover) { f.cd.breath = B.cd[f.phase] * (slowed() ? 1.3 : 1); ev.push('breath:end'); resume(); }
        }
        break;
      }
      case 'swipe': {
        const S = T.swipe;
        if (f.t >= S.windup && !f.fired) { f.fired = true; ev.push('swipe:hit'); }
        if (f.t >= S.windup + S.hit + S.recover) { f.cd.swipe = S.cd; resume(); }
        break;
      }
      case 'roar': {
        const R = T.roar;
        if (f.t >= R.windup && !f.fired) { f.fired = true; ev.push('roar:blast'); }
        if (f.t >= R.windup + R.hold) { f.cd.roar = R.cd; resume(); }
        break;
      }
      default: break;
    }

    // What the model should show.
    const a = f.anim, B = T.breath, S = T.swipe, R = T.roar;
    a.roar = f.state === 'roar' ? ease(f.t / 0.5) * (1 - ease((f.t - R.windup - 0.2) / 0.5)) : 0;
    a.breath = f.state === 'breath' ? (f.t < f.W ? ease(f.t / f.W) : f.t < f.W + B.fire ? 1 : 1 - ease((f.t - f.W - B.fire) / B.recover))
      : f.state === 'smash' ? ease(f.smash / 1.2) : 0;
    a.swipe = f.state === 'swipe' ? -f.swipeSide * (f.t < S.windup ? ease(f.t / S.windup) : f.t < S.windup + S.hit ? 1 - 2 * ease((f.t - S.windup) / S.hit) : -1 + ease((f.t - S.windup - S.hit) / S.recover)) : 0;
    a.frozen = f.state === 'frozen' ? 1 : slowed() ? 0.3 : 0;
    const look = f.state === 'smash' ? headingTo(f.x, f.z, f.hall.x, f.hall.z) : headingTo(f.x, f.z, p.x, p.z);
    a.aimYaw = f.state === 'march' || f.state === 'frozen' || f.state === 'swipe' ? 0 : Math.max(-1, Math.min(1, angDiff(look, f.heading)));
    return ev;
  };
  return f;
}

// --- The mode ----------------------------------------------------------------

// Mirrors SHORE in world/city/scene.js: where the island ends and the rivers begin.
const SHORE = [-262, 300];
const inRiver = (x) => x > SHORE[1] || x < SHORE[0];
const hearts = (hp, max) => { const n = Math.ceil(hp / (max / 5)); return '♥'.repeat(n) + '♡'.repeat(5 - n); };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

const ROUND_SECS = 180;

export const kaiju = {
  mover: 'flight', ride: 'hero', time: ROUND_SECS, outfit: { shirt: '#2b62a6', pants: '#e0322b', hat: 'cape' },
  title: 'Kaiju',
  intro: (m) => {
    const water = m.city === 'tokyo' ? 'Tokyo Bay' : 'the East River';
    const office = m.city === 'tokyo' ? 'the Metropolitan Government tower' : 'City Hall';
    return [
      m.year === '1900' ? `Nobody in 1900 had a word for it. The newspapers tried several. It came up out of ${water} at dusk, and it was walking.`
        : m.year === '2100' ? `The towers had made everyone feel safe. Then ${water} bubbled, and something fifty-five metres tall climbed out of it.`
          : `It came up out of ${water} just before dark. Fifty-five metres of it, and it was headed straight for ${office}.`,
      'The mayor\'s office is the dome on the tall spire. Hold the left button to burn it with your eyes. Hold the right to freeze it. Make it look at you, not at the city.',
    ];
  },
  controls: 'WASD fly · SPACE up · C down · SHIFT boost · mouse aims · LEFT button / L laser eyes · RIGHT button / F ice breath',
  create(ctx) {
    const { world, group, hud, controls, practice = 1, upgrades = new Set() } = ctx;
    const T = BOSS;
    // Upgrades from the shop: coolant makes the eyes overheat half as fast, armour takes a third off every hit.
    const armour = upgrades.has('armor') ? 2 / 3 : 1;
    const powers = createPowers({ camera: ctx.camera, group, heatRate: upgrades.has('coolant') ? 0.5 : 1 });
    // The city: lot briefs (to knock down) and the mayor's office on the spire's roof.
    const briefs = world.city.city.briefs;
    const HALL = hallPoint(briefs), hallLot = briefs.find((b) => b.id === HALL.id);
    const fight = createFight({ path: pathToHall(KAIJU_START, HALL) });
    const lotHeight = new Map();
    for (const b of world.city.buildings) lotHeight.set(b.lot, Math.max(lotHeight.get(b.lot) || 0, b.height));
    const roof = roofAt(world.city.buildings, HALL.x, HALL.z) || 100;
    const hall = models.makeCityHall();
    hall.position.set(HALL.x, roof, HALL.z);
    group.add(hall);

    const boss = models.makeKaiju();
    boss.rotation.order = 'YXZ';
    group.add(boss);
    const ud = boss.userData;
    const targets = [
      ...ud.hitboxes.map((h) => ({ id: 'kaiju', node: h.node, position: V(0, 0, 0), radius: h.r, weak: false })),
      ...ud.weakPoints.map((n) => ({ id: 'kaiju', node: n, position: V(0, 0, 0), radius: n.userData.radius, weak: true })),
    ];

    // Effects: rubble dust, river spray, the breath's fire and its beam.
    const dust = createParticles(group, { max: 220, colours: ['#cdbfa8', '#8d8478', '#5c554d'], additive: false, alpha: 0.7, drag: 0.5, gravity: 2 });
    const spray = createParticles(group, { max: 120, colours: ['#ffffff', '#bfe6ff', '#6aa9d6'], additive: true, alpha: 0.6, drag: 0.9, gravity: -14 });
    const fire = createParticles(group, { max: 200, colours: ['#fff0ff', '#ff5cc8', '#5a1a6a'], additive: true, alpha: 1, drag: 0.5, gravity: -6 });
    const glowTex = (() => {
      if (typeof document === 'undefined') return null;
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
    })();
    const flare = () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff7ad6', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
      s.visible = false; s.renderOrder = 7; group.add(s); return s;
    };
    const blast = flare(), maw = flare();
    const beamGeo = beamGeometry([[0.8, [0.9, 0.78, 0.9]], [2.1, [0.95, 0.28, 0.7]], [4, [0.45, 0.08, 0.38]]], 0.02), beamMat = beamMaterial();
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.visible = false; beam.frustumCulled = false; beam.renderOrder = 6; group.add(beam);
    const sightGeo = beamGeometry([[0.12, [1, 0.35, 0.4]]], 0), sightMat = beamMaterial();
    const sight = new THREE.Mesh(sightGeo, sightMat); sight.visible = false; sight.frustumCulled = false; sight.renderOrder = 6; group.add(sight);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ff9be8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.visible = false; group.add(ring);

    // State of the round.
    let t = 0, hp = T.player.hp, iframes = 0, outcome = null, endT = 0, hurt = 0, lots = 0, weakDealt = 0, fallT = 0, ringT = 0, thud = false, hot = false;
    let hudT = 0, flushT = 0.8, queuedAt = 0, blastT = 0, lastSteps = 0, timeAtEnd = null, startLeft = null, hallGone = false;
    const rubble = new Set(), queue = [], near = [];
    const origin = V(0, 44, 0), dir0 = V(0, 0, -1), dir = V(0, 0, -1), endP = V(0, 0, 0), tmp = V(0, 0, 0), foot = V(0, 0, 0), lockAim = V(0, 0, -1), guideV = V(0, 0, 0);
    const input = { player: { x: 0, y: 0, z: 0 }, damage: 0, ice: 0 };
    const ex = { roar: 0, breath: 0, hurt: 0, frozen: 0, swipe: 0, aimYaw: 0, aimPitch: 0 };
    const bossAt = V(0, 0, 0);

    const callout = (s) => { hud.callout(s); };
    const topple = (b) => {
      if (!b || b === hallLot || rubble.has(b.id) || queue.includes(b)) return;
      if (!queue.length) queuedAt = t;
      queue.push(b);
      puff(b.x, b.z, 8, 4);
    };
    const crush = (x, z, r) => { for (const b of lotsInCircle(briefs, x, z, r, near)) topple(b); };
    const puff = (x, z, h, n = 12) => {
      for (let i = 0; i < n; i++) dust.emit(x + rand(-8, 8), rand(0, Math.min(h, 20)), z + rand(-8, 8), rand(-5, 5), rand(4, 14), rand(-5, 5), rand(1.6, 3), rand(5, 9), rand(20, 34));
    };
    // Knock the queued lots down in one rebuild (the rebuild is the expensive part): at most every 0.6 s, and not for a lone lot until it has waited ~1 s, so more fall per rebuild.
    function flush() {
      if (!queue.length) return;
      if (flushT > 0 || (queue.length < 5 && t - queuedAt < 0.9)) return;
      queue.sort((a, b) => flat(a.x, a.z, bossAt.x, bossAt.z) - flat(b.x, b.z, bossAt.x, bossAt.z));
      const batch = queue.splice(0, 6);
      for (const b of batch) { rubble.add(b.id); lots++; puff(b.x, b.z, lotHeight.get(b.id) || 20); }
      if (ctx.destroyLot) {
        if (ctx.destroyedLots) for (let i = 0; i < batch.length - 1; i++) ctx.destroyedLots.add(batch[i].id);
        ctx.destroyLot(batch[batch.length - 1].id);
      }
      flushT = 0.6; queuedAt = t;
    }
    function hurtPlayer(amount, why) {
      if (iframes > 0 || outcome) return false;
      hp = Math.max(0, hp - amount * armour); iframes = T.player.iframes;
      hud.toast(`${why}  ${hearts(hp, T.player.hp)}`, 'bad');
      return true;
    }
    const finish = (what, secs, text) => { outcome = what; endT = secs; fallT = 0; timeAtEnd = round.timeLeft ?? 0; callout(text); };

    const round = {
      spawn: { at: V(140, 62, -262), heading: -Math.PI / 2 },
      objective: 'Stop the kaiju before it reaches City Hall',
      guide() {
        if (outcome) return null;
        return flat(fight.x, fight.z, HALL.x, HALL.z) < 110 ? guideV.set(HALL.x, roof + 14, HALL.z) : guideV.set(fight.x, 30, fight.z);
      },
      update(dt, m, _hud, mover) {
        if (this.done) return;
        t += dt; iframes = Math.max(0, iframes - dt); flushT -= dt; hurt = Math.max(0, hurt - dt * 3);
        if (startLeft === null) startLeft = this.timeLeft ?? ROUND_SECS;
        const alive = !outcome, p = mover.position;
        input.player.x = p.x; input.player.y = p.y; input.player.z = p.z;

        // 1. The hero's powers, and what they hit on the kaiju's body as it was last frame.
        for (const tg of targets) tg.node.getWorldPosition(tg.position);
        const hits = powers.update(dt, mover, controls, alive ? targets : []);
        let damage = 0, ice = 0;
        const frozen = fight.state === 'frozen';
        for (const h of hits) {
          if (h.kind === 'laser') { const d = laserDamage(h.dt, h.weak, frozen); damage += d; if (h.weak) weakDealt += d; hurt = Math.max(hurt, h.weak ? 0.22 : 0.12); }
          else ice = Math.max(ice, h.dt);
        }
        // It is solid: flying into its body slides you off the surface instead of through it.
        for (const tg of targets) {
          if (tg.weak) continue;
          const dx = p.x - tg.position.x, dy = p.y - tg.position.y, dz = p.z - tg.position.z, d = Math.hypot(dx, dy, dz), r = tg.radius * 0.8 + 1;
          if (d < r && d > 0.01) { const k = r / d; p.set(tg.position.x + dx * k, tg.position.y + dy * k, tg.position.z + dz * k); mover.velocity.multiplyScalar(0.6); }
        }
        if (powers.laser.overheated && !hot) hud.toast('Eyes overheated. Let them cool.', 'bad');
        hot = powers.laser.overheated;
        input.damage = damage; input.ice = ice;

        // 2. The kaiju decides.
        const hpBefore = fight.hp;
        for (const e of fight.step(dt, input)) {
          switch (e) {
            case 'engage': hud.toast('It has seen you!', 'bad'); break;
            case 'disengage': hud.toast('It lost interest. It is marching again.'); break;
            case 'phase': callout(fight.phase === 1 ? 'IT\'S ANGRY' : 'ENRAGED'); hurt = 0.9; break;
            case 'frozen': hurt = 0.6; callout('FROZEN!'); hud.toast('Frozen solid. It takes extra damage.', 'good'); break;
            case 'thaw': hud.toast('It thawed.'); break;
            case 'breath:windup': hud.toast('Its plates are glowing. Breath incoming!', 'bad'); break;
            case 'swipe:windup': hud.toast('Tail! Get away from behind it!', 'bad'); break;
            case 'roar:windup': hud.toast('It is winding up a roar. Back off!', 'bad'); break;
            case 'smash:start': callout('IT\'S AT CITY HALL'); hud.toast('Make it look at you!', 'bad'); break;
            case 'breath:lock': lockAim.copy(dir0); break;
            case 'roar:blast':
              if (flat(p.x, p.z, fight.x, fight.z) < T.roar.range) {
                tmp.set(p.x - fight.x, 0, p.z - fight.z).normalize();
                mover.velocity.addScaledVector(tmp, T.roar.knock).y += 12;
                hurtPlayer(T.roar.damage, 'Roar');
              }
              ring.position.set(fight.x, 1, fight.z); ringT = 0; ring.visible = true;
              break;
            case 'swipe:hit':
              ud.tailTip.getWorldPosition(tmp);
              crush(tmp.x, tmp.z, 16); puff(tmp.x, tmp.z, 20, 8);
              if (inTailZone(fight, p, { ...T.swipe, range: T.swipe.range + 8 })) {
                tmp.set(p.x - fight.x, 0, p.z - fight.z).normalize();
                mover.velocity.addScaledVector(tmp, 55).y += 10;
                hurtPlayer(T.swipe.damage, 'Tail swipe');
              }
              break;
            case 'hall:destroyed': finish('hall', 3.4, 'CITY HALL IS GONE'); break;
            case 'dead': finish('win', 3.6, 'IT FALLS!'); break;
            default: break;
          }
        }
        
        // 3. Pose it.
        const kx = fight.x, kz = fight.z;
        bossAt.set(kx, 0, kz);
        boss.position.set(kx, 0, kz);
        boss.rotation.y = fight.heading;
        const A = fight.anim, aiming = fight.state === 'breath' || fight.state === 'stalk';
        ex.roar = A.roar; ex.breath = A.breath; ex.frozen = A.frozen; ex.swipe = A.swipe; ex.hurt = hurt; ex.aimYaw = A.aimYaw;
        ex.aimPitch = aiming ? THREE.MathUtils.clamp(Math.atan2(p.y - origin.y, Math.max(30, flat(p.x, p.z, kx, kz))), -0.55, 0.5) : 0;
        if (outcome === 'win') {
          fallT += dt;
          const u = Math.min(1, fallT / 2.3);
          boss.rotation.x = -(u * u) * (Math.PI / 2 - 0.1);
          ex.roar = 0.6 * (1 - u); ex.breath = 0; ex.frozen = 0.5 * u;
          if (fallT > 2.15 && !thud) {
            thud = true; ud.mouth.getWorldPosition(tmp);
            for (let k = 0; k < 6; k++) { const d = k * 9 + 12; crush(kx - Math.sin(fight.heading) * d, kz - Math.cos(fight.heading) * d, 14); }
            puff(tmp.x, tmp.z, 30, 40);
          }
        }
        ud.animate(t, outcome === 'win' ? 0 : fight.speed, ex);
        boss.updateMatrixWorld(true);

        // 4. Footfalls crush buildings, or throw river spray.
        if (ud.steps !== lastSteps) {
          lastSteps = ud.steps;
          ud.feet[ud.lastStep].getWorldPosition(foot);
          if (inRiver(foot.x)) for (let i = 0; i < 18; i++) spray.emit(foot.x + rand(-5, 5), 0.5, foot.z + rand(-5, 5), rand(-6, 6), rand(8, 24), rand(-6, 6), rand(0.7, 1.4), 2.5, 6);
          else { crush(foot.x, foot.z, 13); puff(foot.x, foot.z, 6, 5); }
        }
        if (!inRiver(kx) && fight.speed > 0.5) crush(kx, kz, 9);

        // 5. The breath: a red sight line while it aims, then the blast.
        ud.mouth.getWorldPosition(origin);
        if (fight.state === 'breath' && !fight.lock) dir0.set(p.x - origin.x, p.y - origin.y, p.z - origin.z).normalize();
        else if (fight.state === 'smash') dir0.set(HALL.x - origin.x, roof + 10 - origin.y, HALL.z - origin.z).normalize();
        else if (fight.state === 'breath') dir0.copy(lockAim);
        const aimingNow = alive && fight.state === 'breath' && !fight.firing && fight.t < fight.W;
        sight.visible = aimingNow;
        if (aimingNow) {
          const len = dir0.y < -0.01 ? Math.min(220, origin.y / -dir0.y) : 220, w = fight.lock ? 2 : 0.8;
          sight.position.copy(origin); sight.quaternion.setFromUnitVectors(UP, dir0); sight.scale.set(w, len, w);
          sightMat.opacity = fight.lock ? 0.9 : 0.35 + 0.3 * Math.sin(t * 24);
        }
        const firing = alive && (fight.firing || (fight.state === 'smash' && fight.smash > 1.2));
        if (firing) {
          const ang = fight.firing ? sweepAngle(fight.fireU, fight.sweepDir) : Math.sin(t * 5) * 0.1, c = Math.cos(ang), s = Math.sin(ang);
          dir.set(dir0.x * c - dir0.z * s, dir0.y, dir0.x * s + dir0.z * c).normalize();
          const len = dir.y < -0.01 ? Math.min(T.breath.length, origin.y / -dir.y) : T.breath.length;
          endP.copy(origin).addScaledVector(dir, len);
          const edge = fight.firing ? Math.min(1, fight.fireU * 12, (1 - fight.fireU) * 8) : 0.85, w = Math.max(0.05, edge) * (0.88 + 0.12 * Math.sin(t * 60));
          beam.visible = true; beam.position.copy(origin); beam.quaternion.setFromUnitVectors(UP, dir); beam.scale.set(w, len, w); beamMat.opacity = 0.95;
          blast.visible = true; blast.position.copy(endP); blast.scale.setScalar(26 * Math.max(0.2, edge) + Math.sin(t * 40) * 3);
          maw.visible = true; maw.position.copy(origin); maw.scale.setScalar(10 * Math.max(0.2, edge));
          if (endP.y < 3) for (let i = 0; i < 4; i++) fire.emit(endP.x, 1, endP.z, rand(-22, 22), rand(8, 38), rand(-22, 22), rand(0.5, 1.1), 2.6, 0.4, i & 1);
          // Anything under the beam comes down, and the ground where it lands burns.
          if (t - blastT > 0.25) {
            blastT = t;
            for (let d = 20; d <= len; d += 22) {
              const bx = origin.x + dir.x * d, by = origin.y + dir.y * d, bz = origin.z + dir.z * d;
              for (const b of lotsInCircle(briefs, bx, bz, 6, near)) if ((lotHeight.get(b.id) || 20) > by - 2) topple(b);
            }
            crush(endP.x, endP.z, 12);
          }
          if (fight.firing && pointSegDist(p.x, p.y, p.z, origin.x, origin.y, origin.z, endP.x, endP.y, endP.z) < T.breath.radius + 1) hurtPlayer(T.breath.damage, 'Atomic breath');
        } else { beam.visible = false; blast.visible = false; maw.visible = false; }
        if (ring.visible) {
          ringT += dt;
          const u = ringT / 0.9;
          ring.scale.setScalar(4 + u * 90); ringMat.opacity = 0.8 * (1 - u);
          if (u >= 1) ring.visible = false;
        }

        // 6. Rubble and dust.
        flush();
        dust.update(dt, ctx.camera); spray.update(dt, ctx.camera); fire.update(dt, ctx.camera);

        // 7. The end of the round, and the HUD.
        if (alive && hp <= 0) finish('ko', 2.2, 'KNOCKED OUT');
        if (outcome && (endT -= dt) <= 0) this.done = true;
        const near110 = flat(kx, kz, HALL.x, HALL.z) < 140;
        hall.userData.animate(t, 0, outcome === 'hall' ? { alarm: 1, fall: Math.min(1, (3.4 - endT) / 1.2) } : { alarm: fight.state === 'smash' ? 1 : near110 && !fight.engaged ? 0.5 : 0 });
        // The only lot the kaiju is not allowed to flatten comes down once the office is lost.
        if (outcome === 'hall' && !hallGone && 3.4 - endT > 1.1) {
          hallGone = true; hall.visible = false; lots++; rubble.add(hallLot.id);
          puff(hallLot.x, hallLot.z, 60, 70);
          for (let i = 0; i < 40; i++) fire.emit(hallLot.x + rand(-8, 8), roof + rand(0, 10), hallLot.z + rand(-8, 8), rand(-18, 18), rand(6, 30), rand(-18, 18), rand(0.8, 1.6), 3, 0.6, i & 1);
          if (ctx.destroyLot) { ctx.destroyLot(hallLot.id); }
        }
        hud.meter('Kaiju', fight.hp / fight.max);
        if ((hudT -= dt) <= 0) {   // the text only needs to change a few times a second
          hudT = 0.12;
          const left = Math.round(fight.hallHp * 100);
          const status = fight.state === 'smash' ? `IT IS AT CITY HALL · hall ${left}%`
            : fight.engaged ? `It is after you · hall ${left}%` : `It is ${Math.round(flat(kx, kz, HALL.x, HALL.z))} m from City Hall`;
          hud.set({ score: Math.round(fight.dealt * 0.6), objective: `${hearts(hp, T.player.hp)}  ·  ${status}` });
        }
      },
      // Takes the powers down (listeners, particles). results() calls it too, since main.js has no end-of-round hook.
      dispose() { powers.dispose(); for (const o of [dust, spray, fire]) o.dispose(); for (const s of [blast, maw]) { s.removeFromParent(); s.material.dispose(); } for (const m of [beam, sight, ring]) m.removeFromParent(); beamGeo.dispose(); beamMat.dispose(); sightGeo.dispose(); sightMat.dispose(); ringGeo.dispose(); ringMat.dispose(); glowTex?.dispose(); },
      results() {
        this.dispose();
        const won = outcome === 'win';
        const weakShare = fight.dealt ? weakDealt / fight.dealt : 0, timeLeft = Math.max(0, timeAtEnd ?? this.timeLeft ?? 0);
        const score = Math.round(scoreFor({ won, dealt: fight.dealt, weakShare, timeLeft, lots, hall: fight.hallHp, hpLeft: hp }) * practice);
        const rank = rankOf(score, won);
        const subtitle = won ? (fight.hallHp === 1 && lots < 12 ? 'The city never knew what was coming.' : lots > 40 ? 'You won. The city will take a while to forgive you.' : 'It fell. Barely a window left to wash.')
          : outcome === 'hall' ? 'It took the mayor\'s office. At least the flag came down gracefully.' : outcome === 'ko' ? 'It was bigger than you thought.' : 'The sun came up, and it was still standing.';
        return {
          score, rank, subtitle,
          lines: [
            { label: 'Kaiju', value: won ? 'Down' : `${Math.round(fight.hp / fight.max * 100)}% left` },
            { label: 'City Hall', value: fight.hallHp <= 0 ? 'Destroyed' : fight.hallHp === 1 ? 'Untouched' : `${Math.round(fight.hallHp * 100)}%` },
            { label: 'Buildings lost', value: String(lots) },
            { label: 'Hearts left', value: `${Math.ceil(hp / (T.player.hp / 5))}/5` },
            { label: 'Weak-point damage', value: `${Math.round(weakShare * 100)}%` },
            { label: 'Time', value: mmss((startLeft ?? ROUND_SECS) - timeLeft) },
          ],
        };
      },
      // Read-only peek for tests and the preview harness.
      debug: { fight, powers, boss, hall, targets, get hp() { return hp; }, set hp(v) { hp = v; }, get lots() { return lots; }, get outcome() { return outcome; }, queue, rubble },
    };
    return round;
  },
};
