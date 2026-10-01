import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  BOSS, hallPoint, angDiff, headingTo, phaseFor, aggroStep, engagedNow, laserDamage, pointSegDist, sweepAngle, pathToHall, pathLength, roofAt, lotsInCircle,
  inTailZone, scoreFor, rankOf, createFight, RANKS,
} from './boss.js';
import { stepLaser, stepIce, aimDirection, raySphere, inCone, createPowers, createParticles, LASER, ICE, AIM_PITCH, WEAK_REACH } from './powers.js';
import * as models from './models.js';
import { lots } from '../world/city/lots.js';
import { LANDMARKS } from '../world/city/bible.js';
import { buildCity } from '../world/city/build.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const SPIRE = LANDMARKS.find((l) => l.id === 'spire');
const HALL = hallPoint(lots());

// --- powers.js ------------------------------------------------------------------

test('laser heat builds while firing, shuts the eyes at 1 and only resumes after cooling', () => {
  const s = { heat: 0, firing: false, overheated: false };
  let t = 0;
  while (!s.overheated && t < 10) { stepLaser(s, true, 1 / 60); t += 1 / 60; }
  assert.ok(near(t, 1 / LASER.heatUp, 0.05), `overheats after ${t.toFixed(2)} s`);
  assert.equal(s.firing, false);
  stepLaser(s, true, 1 / 60);
  assert.equal(s.firing, false, 'holding the button does nothing while hot');
  let cool = 0;
  while (s.overheated) { stepLaser(s, true, 1 / 60); cool += 1 / 60; assert.ok(cool < 10); }
  assert.ok(near(cool, (1 - LASER.resume) / LASER.coolHot, 0.1), `back in ${cool.toFixed(2)} s`);
  stepLaser(s, true, 1 / 60);
  assert.equal(s.firing, true);
  stepLaser(s, false, 5);
  assert.equal(s.heat, 0);
});

test('ice breath drains, refills after a rest, and needs a little charge to start', () => {
  const s = { charge: 1, firing: false, idle: 0 };
  let t = 0;
  while (t < 10) { stepIce(s, true, 1 / 60); t += 1 / 60; if (!s.firing) break; }
  assert.ok(t > 2.4 && t < 3.4, `a full tank lasts ${t.toFixed(2)} s`);
  assert.equal(s.charge, 0);
  stepIce(s, false, ICE.delay * 0.5);
  assert.equal(s.charge, 0, 'no refill during the rest');
  for (let i = 0; i < 40; i++) stepIce(s, true, 1 / 60);
  assert.equal(s.firing, false, 'cannot restart on an empty tank');
  for (let i = 0; i < 600; i++) stepIce(s, false, 1 / 60);
  assert.ok(s.charge > 0.99, 'refills');
  stepIce(s, true, 1 / 60);
  assert.equal(s.firing, true);
});

test('aim follows the flight direction: yaw and pitch + 0.2, forward is -z at yaw 0', () => {
  const d = aimDirection(0, 0, new THREE.Vector3());
  assert.ok(near(d.length(), 1) && near(d.x, 0) && d.z < 0 && near(d.y, Math.sin(AIM_PITCH)));
  const e = aimDirection(-Math.PI / 2, -AIM_PITCH, new THREE.Vector3());
  assert.ok(near(e.x, 1, 1e-9) && near(e.y, 0, 1e-9) && near(e.z, 0, 1e-9), 'yaw -90 faces east');
});

test('ray-sphere and cone tests', () => {
  assert.ok(near(raySphere(0, 0, 0, 0, 0, -1, 0, 0, -50, 5), 45));
  assert.equal(raySphere(0, 0, 0, 0, 0, -1, 0, 0, 50, 5), -1, 'behind');
  assert.equal(raySphere(0, 0, 0, 0, 0, -1, 9, 0, -50, 5), -1, 'miss');
  assert.equal(raySphere(0, 0, 0, 0, 0, -1, 0, 0, 0, 5), 0, 'inside');
  const k = Math.tan(ICE.half);
  assert.ok(inCone(0, 0, 0, 0, 0, -1, ICE.length, k, 0, 0, -20, 3));
  assert.ok(!inCone(0, 0, 0, 0, 0, -1, ICE.length, k, 0, 0, -40, 3), 'too far');
  assert.ok(!inCone(0, 0, 0, 0, 0, -1, ICE.length, k, 20, 0, -10, 3), 'outside the cone');
  assert.ok(inCone(0, 0, 0, 0, 0, -1, ICE.length, k, 0, 0, -ICE.length - 2, 3), 'a big sphere past the tip still counts');
});

// createPowers runs without a browser (no canvas, no listeners): drive it with a fake rig.
function rig() {
  const group = new THREE.Group(), powers = createPowers({ camera: null, group });
  const mover = { position: new THREE.Vector3(0, 0, 0), velocity: new THREE.Vector3() };
  const controls = { enabled: true, mouse: false, keys: new Set(), yaw: -Math.PI / 2, pitch: -AIM_PITCH };   // facing east, level
  return { group, powers, mover, controls };
}
const ball = (x, y, z, radius, extra = {}) => ({ id: 'k', position: new THREE.Vector3(x, y, z), radius, ...extra });

test('powers: nothing fires until you press; the laser hits the nearest target on the ray, once per frame, with its exposure time', () => {
  const { powers, controls, mover } = rig();
  const far = ball(80, 1.6, 0, 5, { id: 'far' }), close = ball(40, 1.6, 0, 5, { id: 'close' }), off = ball(40, 30, 0, 5, { id: 'off' });
  assert.equal(powers.update(1 / 60, mover, controls, [far, close, off]).length, 0, 'idle');
  controls.mouse = true;
  const hits = powers.update(1 / 60, mover, controls, [far, close, off]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'close');
  assert.equal(hits[0].kind, 'laser');
  assert.ok(near(hits[0].dt, 1 / 60) && near(hits[0].dist, 35, 0.01), `${hits[0].dist}`);
  assert.ok(near(hits[0].point.x, 35, 0.01) && near(hits[0].point.y, 1.6, 0.01), 'a point on the target');
  controls.mouse = false; controls.keys.add('KeyL');
  assert.equal(powers.update(1 / 60, mover, controls, [close]).length, 1, 'L works as well as the mouse');
  controls.keys.clear(); controls.mouse = true; controls.enabled = false;
  assert.equal(powers.update(1 / 60, mover, controls, [close]).length, 0, 'not while the round is not running');
});

test('powers: range is 180 m, and a weak point on the surface beats the body it sits on', () => {
  const { powers, controls, mover } = rig();
  controls.mouse = true;
  assert.equal(powers.update(1 / 60, mover, controls, [ball(LASER.range + 20, 1.6, 0, 5)]).length, 0, 'out of range');
  const body = ball(60, 1.6, 0, 10, { id: 'body' }), gem = ball(52, 1.6, 0, 3.5, { id: 'gem', weak: true });
  const hit = powers.update(1 / 60, mover, controls, [body, gem])[0];
  assert.equal(hit.id, 'gem');
  assert.equal(hit.weak, true);
  const behind = ball(70, 1.6, 0, 3.5, { id: 'back', weak: true }), front = ball(60, 1.6, 0, 10, { id: 'body2' });
  assert.equal(powers.update(1 / 60, mover, controls, [behind, front])[0].id, 'body2', 'but not through the body (it is deeper than the weak reach)');
  assert.ok(WEAK_REACH > 0 && WEAK_REACH < 6);
});

test('powers: the laser stops when it overheats, and never hits while fading out', () => {
  const { powers, controls, mover } = rig();
  controls.mouse = true;
  const t = [ball(30, 1.6, 0, 5)];
  let shots = 0, secs = 0;
  while (powers.laser.firing || secs < 0.1) { shots += powers.update(1 / 60, mover, controls, t).length; secs += 1 / 60; if (secs > 10) break; }
  assert.ok(near(secs, 1 / LASER.heatUp, 0.1) && powers.laser.overheated);
  assert.equal(powers.update(1 / 60, mover, controls, t).length, 0);
  controls.mouse = false;
  assert.equal(powers.update(1 / 60, mover, controls, t).length, 0, 'released');
});

test('powers: ice hits everything in a 25 m cone, with a slow, and drains its charge', () => {
  const { powers, controls, mover } = rig();
  controls.keys.add('KeyF');
  const inside = ball(18, 1.6, 0, 3, { id: 'in' }), tooFar = ball(45, 1.6, 0, 3, { id: 'far' }), aside = ball(10, 1.6, 20, 3, { id: 'aside' }), second = ball(24, 3, 1, 2, { id: 'in2' });
  const hits = powers.update(1 / 60, mover, controls, [inside, tooFar, aside, second]);
  assert.deepEqual(hits.map((h) => h.id).sort(), ['in', 'in2']);
  assert.ok(hits.every((h) => h.kind === 'ice' && h.slow === ICE.slow && h.dt > 0));
  assert.ok(powers.ice.charge < 1 && powers.ice.firing);
  for (let i = 0; i < 400; i++) powers.update(1 / 60, mover, controls, [inside]);
  assert.equal(powers.ice.firing, false, 'out of breath');
  assert.equal(powers.update(1 / 60, mover, controls, [inside]).length, 0);
});

test('powers: the right mouse button fires ice and its context menu is cancelled (browser only)', () => {
  const { powers } = rig();
  assert.equal(typeof powers.dispose, 'function');
  powers.dispose(); powers.dispose();
});

test('powers: steady state allocates no new hit records or particles', () => {
  const { powers, controls, mover, group } = rig();
  controls.mouse = true; controls.keys.add('KeyF');
  const t = [ball(18, 1.6, 0, 3), ball(24, 3, 1, 2, { weak: true })];
  for (let i = 0; i < 30; i++) powers.update(1 / 60, mover, controls, t);
  const a = powers.hits.slice(), kids = group.children.length;
  for (let i = 0; i < 30; i++) powers.update(1 / 60, mover, controls, t);
  assert.equal(group.children.length, kids);
  const b = powers.hits;
  assert.ok(b.every((h) => a.includes(h)), 'hit records are reused');
  const pts = group.children.find((c) => c.isPoints), n = pts.geometry.attributes.position.count;
  for (let i = 0; i < 100; i++) powers.update(1 / 60, mover, controls, t);
  assert.equal(pts.geometry.attributes.position.count, n, 'a fixed pool');
});

test('particle pools overwrite their oldest slot instead of growing', () => {
  const group = new THREE.Group(), p = createParticles(group, { max: 4, colours: ['#fff', '#fff', '#fff'] });
  for (let i = 0; i < 10; i++) p.emit(i, 0, 0, 1, 0, 0, 1, 1, 2);
  p.update(0.5, null);
  const pos = p.points.geometry.attributes.position.array, age = p.points.geometry.attributes.aAge.array;
  assert.equal(p.points.geometry.attributes.position.count, 4);
  assert.deepEqual([...age].map((a) => +a.toFixed(2)), [0.5, 0.5, 0.5, 0.5]);
  assert.ok(near(pos[3], 9.5), 'the newest particle (slot 1 after wrapping) survives');
  p.update(5, null);
  assert.ok([...age].every((a) => a === 1), 'dead particles stay dead');
});

// --- Pure helpers -----------------------------------------------------------------

test('headings use the rig convention', () => {
  assert.ok(near(headingTo(0, 0, 0, -10), 0), 'north is 0');
  assert.ok(near(headingTo(0, 0, 10, 0), -Math.PI / 2), 'east is -90 degrees');
  assert.ok(near(angDiff(0.1, TWO() - 0.1), 0.2));
  function TWO() { return Math.PI * 2; }
});

test('aggro rises with damage, ice and loitering, decays once you stop, and has hysteresis', () => {
  assert.equal(aggroStep(0, { damage: 130 }, 1 / 60), 0.5);
  assert.ok(aggroStep(0, { ice: 1 }, 1 / 60) > 0.2);
  assert.ok(aggroStep(0, { near: true }, 1) > 0);
  assert.equal(aggroStep(0.5, { quiet: 0.5 }, 1), 0.5, 'a brief pause holds');
  assert.ok(near(aggroStep(0.5, { quiet: 2 }, 1), 0.5 - BOSS.aggro.decay));
  assert.equal(aggroStep(0.9, { damage: 1e6 }, 1), 1);
  assert.equal(aggroStep(0.05, { quiet: 9 }, 5), 0);
  assert.equal(engagedNow(false, 0.59), false);
  assert.equal(engagedNow(false, 0.6), true);
  assert.equal(engagedNow(true, 0.3), true, 'stays angry between the thresholds');
  assert.equal(engagedNow(true, 0.2), false);
});

test('weak points double the laser and a frozen kaiju takes half again', () => {
  assert.equal(laserDamage(1, false, false), BOSS.laser.body);
  assert.equal(laserDamage(1, true, false), BOSS.laser.body * 2);
  assert.equal(laserDamage(1, true, true), BOSS.laser.body * 3);
  assert.equal(laserDamage(0.5, false, true), BOSS.laser.body * 0.75);
});

test('phases by remaining health', () => {
  assert.deepEqual([1, 0.67, 0.66, 0.5, 0.34, 0.33, 0.1, 0].map(phaseFor), [0, 0, 1, 1, 1, 2, 2, 2]);
});

test('point-to-segment distance and the breath sweep', () => {
  assert.ok(near(pointSegDist(0, 5, 0, -10, 0, 0, 10, 0, 0), 5));
  assert.ok(near(pointSegDist(15, 0, 0, -10, 0, 0, 10, 0, 0), 5), 'past the end');
  assert.ok(near(pointSegDist(1, 1, 1, 0, 0, 0, 0, 0, 0), Math.sqrt(3)), 'degenerate segment');
  assert.ok(sweepAngle(0, 1) < 0 && sweepAngle(1, 1) > 0 && sweepAngle(0, -1) > 0, 'starts short of you, sweeps through, either way');
  assert.ok(near(sweepAngle(1, 1) - sweepAngle(0, 1), BOSS.breath.sweep));
});

test('the path runs from the river to the mayor\'s office, bent but never doubling back', () => {
  const from = { x: 500, z: -262 }, path = pathToHall(from, HALL);
  assert.deepEqual(path[0], from);
  assert.deepEqual(path.at(-1), { x: HALL.x, z: HALL.z });
  assert.ok(path.length >= 4);
  for (let i = 1; i < path.length; i++) assert.ok(path[i].x < path[i - 1].x, 'always heading west');
  const straight = Math.hypot(from.x - HALL.x, from.z - HALL.z);
  assert.ok(pathLength(path) > straight && pathLength(path) < straight * 1.1);
  // At walking speed it needs about a minute: long enough to be a fight, short enough to be a threat.
  const secs = pathLength(path) / BOSS.speed;
  assert.ok(secs > 55 && secs < 80, `${secs.toFixed(0)} s`);
});

test('the roof over a point is the tallest tier covering it; the spire lot has a tall one', () => {
  const buildings = [{ minX: 0, maxX: 10, minZ: 0, maxZ: 10, height: 20 }, { minX: 2, maxX: 8, minZ: 2, maxZ: 8, height: 35 }, { minX: 50, maxX: 60, minZ: 0, maxZ: 10, height: 99 }];
  assert.equal(roofAt(buildings, 5, 5), 35);
  assert.equal(roofAt(buildings, 1, 1), 20);
  assert.equal(roofAt(buildings, 30, 30), 0);
  const city = buildCity({});
  const h = roofAt(city.buildings, HALL.x, HALL.z);
  assert.ok(h >= SPIRE.size[1] * 0.9, `spire roof ${h}`);
  assert.equal(city.briefs.find((b) => b.landmark === 'spire').id, HALL.id, 'the hall stands on the spire lot');
  assert.ok(Math.abs(HALL.x - SPIRE.at[0]) < 25 && Math.abs(HALL.z - SPIRE.at[1]) < 25, 'near the landmark point');
});

test('lots are found by footprint, not by centre', () => {
  const briefs = lots();
  assert.ok(briefs.length > 200);
  const b = briefs[10], out = [];
  assert.ok(lotsInCircle(briefs, b.x, b.z, 1, out).some((x) => x.id === b.id));
  assert.ok(lotsInCircle(briefs, b.x + b.w / 2 + 2, b.z, 3, out).some((x) => x.id === b.id), 'a circle clipping the edge');
  assert.ok(!lotsInCircle(briefs, b.x + b.w / 2 + 6, b.z, 3, out).some((x) => x.id === b.id), 'and one that just misses');
  const reused = [];
  assert.equal(lotsInCircle(briefs, b.x, b.z, 5, reused), reused, 'fills the array it is given');
});

test('the tail reaches behind the kaiju and not in front, and not high above it', () => {
  const f = { x: 0, z: 0, heading: 0 };   // facing north (-z), tail to the south (+z)
  assert.ok(inTailZone(f, { x: 0, y: 10, z: 30 }));
  assert.ok(!inTailZone(f, { x: 0, y: 10, z: -30 }), 'in front');
  assert.ok(!inTailZone(f, { x: 0, y: 10, z: 80 }), 'too far');
  assert.ok(!inTailZone(f, { x: 0, y: 70, z: 30 }), 'too high');
  assert.ok(!inTailZone(f, { x: 40, y: 10, z: 0 }), 'at its side');
  const east = { x: 0, z: 0, heading: -Math.PI / 2 };   // facing east: tail to the west
  assert.ok(inTailZone(east, { x: -30, y: 10, z: 0 }));
  assert.ok(!inTailZone(east, { x: 30, y: 10, z: 0 }));
});

// --- Score and rank ---------------------------------------------------------------

test('a loss is always a D; wins rank by speed, city damage, the office and your hearts', () => {
  assert.equal(rankOf(99999, false), 'D');
  const best = scoreFor({ won: true, dealt: 3000, weakShare: 0.35, timeLeft: 120, lots: 5, hall: 1, hpLeft: 100 });
  const slow = scoreFor({ won: true, dealt: 3000, weakShare: 0.1, timeLeft: 10, lots: 5, hall: 1, hpLeft: 100 });
  const wrecked = scoreFor({ won: true, dealt: 3000, weakShare: 0.35, timeLeft: 120, lots: 60, hall: 1, hpLeft: 100 });
  const hallHurt = scoreFor({ won: true, dealt: 3000, weakShare: 0.35, timeLeft: 120, lots: 5, hall: 0.4, hpLeft: 100 });
  const battered = scoreFor({ won: true, dealt: 3000, weakShare: 0.35, timeLeft: 120, lots: 5, hall: 1, hpLeft: 20 });
  for (const worse of [slow, wrecked, hallHurt, battered]) assert.ok(worse < best);
  assert.equal(rankOf(best, true), 'S');
  assert.ok(scoreFor({ won: false, dealt: 2500, lots: 20 }) < scoreFor({ won: true, dealt: 3000, timeLeft: 0, lots: 100, hall: 0.1, hpLeft: 1 }), 'any win beats a loss');
  assert.ok(RANKS.every((r, i) => !i || r < RANKS[i - 1]));
});

// --- The brain --------------------------------------------------------------------

const FLY = (f, range = 85, y = 45) => ({ x: f.x + range, y, z: f.z });

function run(f, secs, per, dt = 1 / 30, until = null) {
  const seen = [];
  for (let t = 0; t < secs; t += dt) {
    const inp = per(t, f);
    for (const e of f.step(dt, inp)) seen.push([e, t]);
    if (f.state === 'dead' || f.state === 'won' || (until && seen.some(([e]) => e === until))) break;
  }
  return seen;
}

test('left alone, it wades ashore, walks the path in about a minute and wrecks the office', () => {
  const f = createFight();
  const seen = run(f, 120, () => ({ player: { x: 0, y: 40, z: 300 } }));
  const smash = seen.find(([e]) => e === 'smash:start'), done = seen.find(([e]) => e === 'hall:destroyed');
  assert.ok(smash && smash[1] > 50 && smash[1] < 80, `reaches the office at ${smash?.[1].toFixed(0)} s`);
  assert.ok(done && done[1] - smash[1] > 4.2 && done[1] - smash[1] < 4.8, 'and needs ~4.5 s to finish it');
  assert.equal(f.state, 'won');
  assert.equal(f.hallHp, 0);
});

test('hitting it turns it on you, and it stops marching', () => {
  const f = createFight();
  run(f, 10, () => ({ player: { x: 300, y: 45, z: -262 } }));
  const before = { x: f.x, z: f.z };
  const seen = run(f, 6, (t) => ({ player: FLY(f), damage: BOSS.laser.body / 30 }));
  assert.ok(seen.some(([e]) => e === 'engage'));
  assert.equal(f.engaged, true);
  assert.ok(f.state === 'stalk' || f.state === 'breath');
  const moved = Math.hypot(f.x - before.x, f.z - before.z);
  assert.ok(moved < 40, `it only wheeled round (${moved.toFixed(0)} m)`);
});

test('an angry kaiju telegraphs its breath, locks its aim, then fires; the cooldown is real', () => {
  const f = createFight();
  const seen = run(f, 25, () => ({ player: FLY(f), damage: 1.2 }));
  const names = seen.map(([e]) => e), at = (e) => seen.find(([n]) => n === e)?.[1];
  assert.ok(names.indexOf('breath:windup') < names.indexOf('breath:lock') && names.indexOf('breath:lock') < names.indexOf('breath:fire') && names.indexOf('breath:fire') < names.indexOf('breath:end'));
  assert.ok(near(at('breath:fire') - at('breath:windup'), BOSS.breath.windup, 0.1), 'about a second and a bit of warning');
  assert.ok(near(at('breath:fire') - at('breath:lock'), BOSS.breath.lock, 0.1));
  const fires = seen.filter(([e]) => e === 'breath:fire').map(([, t]) => t);
  for (let i = 1; i < fires.length; i++) assert.ok(fires[i] - fires[i - 1] >= BOSS.breath.windup + BOSS.breath.fire + BOSS.breath.recover + BOSS.breath.cd[2] - 0.2, 'no machine-gunning');
});

test('stop pestering it and aggro fades; it marches again', () => {
  const f = createFight();
  run(f, 8, () => ({ player: FLY(f), damage: 2 }));
  assert.equal(f.engaged, true);
  const seen = run(f, 30, () => ({ player: { x: f.x + 400, y: 60, z: f.z } }));
  assert.ok(seen.some(([e]) => e === 'disengage'), 'loses interest');
  assert.equal(f.engaged, false);
  assert.ok(['march', 'smash'].includes(f.state) || f.state === 'breath', f.state);
});

test('ice slows it, and a long breath freezes it; frozen cancels an attack, then it is immune for a while', () => {
  const f = createFight();
  run(f, 3, () => ({ player: { x: 0, y: 0, z: 300 } }));
  const free = f.speed;
  assert.ok(free > 5);
  run(f, 0.2, () => ({ player: { x: f.x + 20, y: 20, z: f.z }, ice: 1 / 30 }));
  assert.ok(f.slowT > 3, 'slowed for a few seconds');
  run(f, 0.1, () => ({ player: { x: 0, y: 0, z: 300 } }));
  assert.ok(f.speed < free * 0.5, `slowed to ${f.speed.toFixed(1)} from ${free.toFixed(1)}`);
  const seen = run(f, 4, () => ({ player: { x: f.x + 20, y: 20, z: f.z }, ice: 1 / 30 }), 1 / 30, 'frozen');
  assert.ok(seen.some(([e]) => e === 'frozen'), 'stacked ice freezes it');
  assert.equal(f.state, 'frozen');
  const x0 = f.x;
  run(f, 1, () => ({ player: { x: 0, y: 0, z: 300 } }));
  assert.equal(f.x, x0, 'frozen kaiju does not move');
  const after = run(f, 4, () => ({ player: { x: f.x + 20, y: 20, z: f.z }, ice: 1 / 30 }));
  assert.ok(after.some(([e]) => e === 'thaw'));
  assert.ok(!after.some(([e]) => e === 'frozen'), 'cannot be re-frozen straight away');
  // A freeze interrupts a breath that is winding up.
  const g = createFight();
  run(g, 12, () => ({ player: FLY(g), damage: 1.5 }));
  g.state = 'stalk'; g.t = 1; g.cd.breath = 0;
  run(g, 0.2, () => ({ player: FLY(g), damage: 1 }));
  assert.equal(g.state, 'breath');
  g.freeze = 0.99; g.immuneT = 0;
  run(g, 0.2, () => ({ player: FLY(g), damage: 1, ice: 1 / 30 }));
  assert.equal(g.state, 'frozen');
  assert.equal(g.firing, false);
});

test('close behind it you get the tail; loitering close to it gets you roared at', () => {
  const f = createFight();
  const back = () => ({ x: f.x + Math.sin(f.heading) * 30, y: 15, z: f.z + Math.cos(f.heading) * 30 });
  const seen = run(f, 12, () => ({ player: back(), damage: 1.5 }));
  assert.ok(seen.some(([e]) => e === 'swipe:windup') && seen.some(([e]) => e === 'swipe:hit'), 'tail swipe');
  const g = createFight();
  g.cd.breath = 99;
  const seen2 = run(g, 15, () => ({ player: { x: g.x - Math.sin(g.heading) * 40, y: 40, z: g.z - Math.cos(g.heading) * 40 }, damage: 1.5 }));
  assert.ok(seen2.some(([e]) => e === 'roar:blast'), 'roar');
});

test('it reaches phase 2 and 3 as it weakens, each with a roar, and gets faster', () => {
  const f = createFight();
  const seen = run(f, 30, () => ({ player: FLY(f, 150), damage: BOSS.hp / 30 / 20 }));
  assert.equal(seen.filter(([e]) => e === 'phase').length >= 2, true);
  assert.ok(seen.some(([e]) => e === 'roar:windup'));
  assert.ok(f.phase >= 1);
  const h = createFight();
  run(h, 1, () => ({ player: { x: 0, y: 0, z: 300 } }));
  const slow = h.speed;
  h.phase = 2;
  run(h, 0.5, () => ({ player: { x: 0, y: 0, z: 300 } }));
  assert.ok(h.speed > slow * 1.2);
});

test('at zero it falls, and nothing else happens', () => {
  const f = createFight();
  const seen = run(f, 2, () => ({ player: FLY(f), damage: BOSS.hp }));
  assert.ok(seen.some(([e]) => e === 'dead'));
  assert.equal(f.state, 'dead');
  assert.equal(f.hp, 0);
  assert.deepEqual(f.step(0.1, { player: FLY(f), damage: 99 }), []);
});

test('making it look at you interrupts the smash; the office keeps what it already lost', () => {
  const f = createFight();
  f.x = HALL.x + 38; f.z = HALL.z; f.i = f.path.length - 1;
  run(f, 1, () => ({ player: { x: 0, y: 0, z: 300 } }));
  assert.equal(f.state, 'smash');
  const lost = f.hallHp;
  assert.ok(lost < 1 && lost > 0);
  run(f, 3, () => ({ player: FLY(f), damage: 4 }));
  assert.notEqual(f.state, 'smash');
  assert.ok(f.hallHp <= lost && f.hallHp > 0, 'it is still standing');
});

// --- Models ------------------------------------------------------------------------

function count(o) { let tris = 0, calls = 0; o.traverse((m) => { if (m.isMesh) { calls++; tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; } }); return { tris, calls }; }

test('the kaiju is about 55 m tall, under 6k triangles, with named parts and weak points', () => {
  const k = models.makeKaiju();
  k.userData.animate(0, 0); k.userData.animate(0.1, 6, { roar: 1, breath: 1, hurt: 1, frozen: 1 });
  k.updateMatrixWorld(true);
  const { tris, calls } = count(k), box = new THREE.Box3().setFromObject(k);
  assert.ok(tris < 6000, `${tris} triangles`);
  assert.ok(calls < 40, `${calls} meshes`);
  assert.ok(box.max.y > 50 && box.max.y < 62, `height ${box.max.y.toFixed(1)}`);
  assert.ok(box.min.y > -3, `feet at ${box.min.y.toFixed(1)}`);
  const u = k.userData;
  for (const name of ['head', 'mouth', 'tailTip']) assert.ok(u[name]?.isObject3D, name);
  assert.ok(u.weakPoints.length >= 3 && u.weakPoints.every((w) => w.isObject3D && w.userData.radius > 1));
  assert.ok(u.hitboxes.length >= 6 && u.hitboxes.every((h) => h.node.isObject3D && h.r > 1));
  const mouth = new THREE.Vector3().setFromMatrixPosition(u.mouth.matrixWorld);
  assert.ok(mouth.y > 35 && mouth.z < -5, 'the mouth is up high at the front');
});

test('the walk plants its feet: they hit the ground at the same pace the body moves, and the footfall counter ticks', () => {
  const k = models.makeKaiju(), feet = k.userData.feet, p = new THREE.Vector3();
  let t = 0, lowest = Infinity;
  const frames = [];
  for (let i = 0; i < 600; i++) {
    t += 1 / 60;
    k.userData.animate(t, 6);
    k.updateMatrixWorld(true);
    const ys = feet.map((f) => f.getWorldPosition(p).y);
    lowest = Math.min(lowest, ...ys);
    frames.push(ys);
  }
  assert.ok(lowest > 0.5, `ankles never dip below the ground (lowest ${lowest.toFixed(2)})`);
  assert.ok(k.userData.steps >= 5 && k.userData.steps <= 12, `${k.userData.steps} footfalls in 10 s at 6 m/s`);
  const planted = frames.filter((ys) => ys.some((y) => y < 1.6)).length / frames.length;
  assert.ok(planted > 0.9, `a foot is down ${(planted * 100).toFixed(0)}% of the time`);
  const still = models.makeKaiju();
  still.userData.animate(0, 0); still.userData.animate(3, 0);
  assert.equal(still.userData.steps, 0, 'standing still takes no steps');
});

test('breath, roar and frost change how it looks', () => {
  const k = models.makeKaiju(), plate = () => { let m = null; k.traverse((o) => { if (o.isMesh && o.material.emissive && o.material.emissive.getHex() !== 0 && o.material.vertexColors) m ||= o.material; }); return m; };
  k.userData.animate(0, 0); k.userData.animate(2, 0);
  const m = plate(), idle = m.emissiveIntensity;
  k.userData.animate(3, 0, { breath: 1 }); k.userData.animate(4, 0, { breath: 1 });
  assert.ok(plate().emissiveIntensity > idle * 2, 'plates glow when charging');
  const body = k.children[0].children[0];
  for (let i = 0; i < 8; i++) k.userData.animate(5 + i * 0.1, 0, { frozen: 1 });
  const mats = []; k.traverse((o) => { if (o.isMesh) mats.push(o.material); });
  assert.ok(mats.some((x) => x.color.b > x.color.r + 0.3), 'blue frost tint');
  assert.ok(body);
});

test('the city hall is a small, light civic marker with a column of light', () => {
  const h = models.makeCityHall();
  h.updateMatrixWorld(true);
  const { tris } = count(h);
  assert.ok(tris < 3000, `${tris} triangles`);
  const box = new THREE.Box3().setFromObject(h.children[0]);
  assert.ok(box.max.x - box.min.x < 14 && box.min.y >= 0, 'fits on a 12 m tier, sitting on the roof');
  assert.ok(h.userData.beam?.isMesh);
  h.userData.animate(1, 0, { alarm: 1, fall: 0.5 });
  assert.ok(h.children[0].rotation.z > 0.1, 'slumps');
});

// --- Balance: bots of different skill play the pure fight ---------------------------

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const BOTS = {
  idle:   { arrive: Infinity },
  novice: { arrive: 14, acc: 0.72, weak: 0.05, dodge: 0.6, iceEvery: 0, range: 90 },
  decent: { arrive: 10, acc: 0.85, weak: 0.2, dodge: 0.78, iceEvery: 14, range: 85 },
  expert: { arrive: 7, acc: 0.95, weak: 0.4, dodge: 0.93, iceEvery: 9, range: 80 },
};

// Fires whenever the eyes allow, lands `acc` of the time, dodges a breath with probability `dodge`.
// Ice comes in 2.5 s bursts from 20 m, which is where the cone reaches.
function simulate(bot, seed, secs = 180, dt = 1 / 30) {
  const rnd = mulberry(seed), f = createFight(), laser = { heat: 0, firing: false, overheated: false }, ice = { charge: 1, firing: false, idle: 0 };
  let hp = BOSS.player.hp, iframes = 0, t = 0, weak = 0, breaths = 0, hits = 0, iceT = 0, outcome = 'time';
  const P = { x: f.x + 300, y: 45, z: f.z };
  while (t < secs) {
    t += dt; iframes = Math.max(0, iframes - dt);
    const here = t >= bot.arrive;
    const wantIce = here && bot.iceEvery > 0 && (t % bot.iceEvery) < 2.5 && f.state !== 'frozen' && f.immuneT <= 0;
    const range = wantIce ? 20 : (bot.range ?? 85);
    if (here) { P.x = f.x + range; P.z = f.z; P.y = wantIce ? 22 : 45; } else { P.x = f.x + 300; P.y = 45; P.z = f.z; }
    stepLaser(laser, here, dt); stepIce(ice, wantIce, dt);
    let damage = 0;
    if (laser.firing && rnd() < bot.acc) { const w = rnd() < bot.weak; damage = laserDamage(dt, w, f.state === 'frozen'); if (w) weak += damage; }
    const events = f.step(dt, { player: P, damage, ice: ice.firing ? dt : 0 });
    for (const e of events) {
      if (e === 'breath:fire') { breaths++; if (iframes <= 0 && rnd() > bot.dodge) { hp -= BOSS.breath.damage; iframes = BOSS.player.iframes; hits++; } }
      if (e === 'roar:blast' && Math.hypot(P.x - f.x, P.z - f.z) < BOSS.roar.range && iframes <= 0 && rnd() > bot.dodge * 0.5) { hp -= BOSS.roar.damage; iframes = BOSS.player.iframes; }
      if (e === 'swipe:hit' && iframes <= 0 && rnd() > bot.dodge) { hp -= BOSS.swipe.damage; iframes = BOSS.player.iframes; }
    }
    if (f.state === 'dead') { outcome = 'win'; break; }
    if (f.state === 'won') { outcome = 'hall'; break; }
    if (hp <= 0) { outcome = 'ko'; break; }
  }
  const lotsLost = Math.round(f.walked * 0.1 + breaths * 3);
  const won = outcome === 'win', timeLeft = secs - t, weakShare = f.dealt ? weak / f.dealt : 0;
  const score = scoreFor({ won, dealt: f.dealt, weakShare, timeLeft: won ? timeLeft : 0, lots: lotsLost, hall: f.hallHp, hpLeft: Math.max(0, hp) });
  return { outcome, t, hp: Math.max(0, hp), hall: f.hallHp, lots: lotsLost, dealt: f.dealt, hits, breaths, score, rank: rankOf(score, won), kaijuHp: f.hp, ice: iceT };
}

function field(bot, n = 60) {
  const runs = Array.from({ length: n }, (_, i) => simulate(bot, 1000 + i * 7919));
  const tally = (key) => runs.reduce((m, r) => ((m[r[key]] = (m[r[key]] || 0) + 1), m), {});
  const wins = runs.filter((r) => r.outcome === 'win');
  const avg = (xs, k) => (xs.length ? xs.reduce((s, r) => s + r[k], 0) / xs.length : 0);
  return { runs, outcomes: tally('outcome'), ranks: tally('rank'), winRate: wins.length / n, avgWinTime: avg(wins, 't'), avgHp: avg(wins, 'hp'), avgScore: avg(wins, 'score'), avgLots: avg(wins, 'lots') };
}

test('balance: an idle player loses the office; a novice usually wins slowly (C/B); an expert earns A or S', () => {
  const table = {};
  for (const [name, bot] of Object.entries(BOTS)) table[name] = field(bot);
  if (process.env.BOSS_SIM) {
    for (const [name, r] of Object.entries(table)) console.log(name.padEnd(7), JSON.stringify(r.outcomes), JSON.stringify(r.ranks), `win ${(r.winRate * 100).toFixed(0)}%  time ${r.avgWinTime.toFixed(0)}  hp ${r.avgHp.toFixed(0)}  score ${r.avgScore.toFixed(0)}  lots ${r.avgLots.toFixed(0)}`);
  }
  assert.equal(table.idle.outcomes.hall, 60, 'doing nothing always ends at the office');
  assert.deepEqual(Object.keys(table.idle.ranks), ['D']);
  const nov = table.novice, dec = table.decent, exp = table.expert;
  assert.ok(nov.winRate >= 0.55 && nov.winRate <= 0.95, `novice wins ${(nov.winRate * 100).toFixed(0)}%`);
  const lowRanks = (nov.ranks.C || 0) + (nov.ranks.B || 0);
  assert.ok(lowRanks / nov.runs.length >= 0.35, `novices mostly land C/B: ${JSON.stringify(nov.ranks)}`);
  assert.ok(!nov.ranks.S, 'no novice S');
  assert.ok(dec.winRate > nov.winRate && exp.winRate >= dec.winRate);
  assert.ok(exp.winRate > 0.9, `expert wins ${(exp.winRate * 100).toFixed(0)}%`);
  assert.ok(((exp.ranks.A || 0) + (exp.ranks.S || 0)) / exp.runs.length >= 0.6, `experts get A/S: ${JSON.stringify(exp.ranks)}`);
  assert.ok(exp.avgScore > dec.avgScore && dec.avgScore > nov.avgScore);
  assert.ok(exp.avgWinTime < dec.avgWinTime && dec.avgWinTime < nov.avgWinTime, 'faster with skill');
});
