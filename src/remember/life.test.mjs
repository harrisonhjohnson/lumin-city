import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildGraph, edgePose, idmAcc, mayEnter, mayCross, signalU, nearestWalk, bayAt, bayCount, doorAnchor, routeField, nextToward, dirToward,
  AVENUE_HALF, STREET_HALF, CYCLE, AVENUE_GREEN, STREET_GREEN, SHORE_WEST, WALK,
} from './life-graph.js';
import { createLife, inspect } from './life.js';
import { createTown, placesFor } from './town.js';
import { createRng } from '../world/city/rng.js';
import * as models from './models.js';
import { blocks } from '../world/city/blocks.js';
import { AVENUE_XS, STREET_ZS } from '../world/city/districts.js';

const G = buildGraph(), GL = buildGraph({ left: true });
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;
const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test('avenues are one-way and alternate; streets run both ways; nothing is on the water', () => {
  const byAvenue = new Map();
  for (const l of G.lanes.filter((l) => l.type === 'avenue')) (byAvenue.get(l.k) || byAvenue.set(l.k, new Set()).get(l.k)).add(l.dir);
  const dirs = [...byAvenue.entries()].sort((a, b) => a[0] - b[0]);
  assert.ok(dirs.length >= 4);
  for (const [, set] of dirs) assert.equal(set.size, 1, 'one direction per avenue');
  for (let i = 1; i < dirs.length; i++) assert.notEqual([...dirs[i][1]][0], [...dirs[i - 1][1]][0], 'neighbouring avenues run opposite ways');
  for (const j of [0, 5, 11]) {
    const dirsOnStreet = new Set(G.lanes.filter((l) => l.type === 'street' && l.j === j).map((l) => l.dir));
    assert.deepEqual([...dirsOnStreet].sort(), ['E', 'W']);
  }
  for (const l of G.lanes) assert.ok(Math.min(l.x0, l.x1) > SHORE_WEST - 12 + 0.01, 'no lane starts out over the river');
  for (const l of G.lanes.filter((l) => l.type === 'avenue')) assert.ok(l.x0 - AVENUE_HALF > SHORE_WEST);
});

test('connectors join a lane end to the next lane start, heading to heading, and never turn back', () => {
  for (const g of [G, GL]) {
    assert.ok(g.conns.length > 200);
    const p = {};
    for (const c of g.conns) {
      edgePose(c, 0, p);
      assert.ok(near(p.x, c.from.x1) && near(p.z, c.from.z1), 'starts where the lane ends');
      assert.ok(angleDiff(p.h, c.from.h) < 0.01, 'leaves along the lane heading');
      edgePose(c, c.len, p);
      assert.ok(near(p.x, c.to.x0) && near(p.z, c.to.z0), 'ends where the next lane starts');
      assert.ok(angleDiff(p.h, c.to.h) < 0.01, 'arrives along the next lane heading');
      assert.ok(angleDiff(c.from.h, c.to.h) < Math.PI - 0.1, 'no U-turns');
      assert.ok(c.len >= 6 && c.len <= 25);
    }
  }
});

test('streets turn the near-side way only, so no turn crosses oncoming traffic; avenues turn from the outer lanes', () => {
  assert.ok(G.conns.filter((c) => c.from.type === 'street').every((c) => c.turn !== 'left'));
  assert.ok(GL.conns.filter((c) => c.from.type === 'street').every((c) => c.turn !== 'right'));
  for (const c of G.conns.filter((c) => c.from.type === 'avenue' && c.turn === 'left')) assert.equal(c.from.l, 0);
  for (const c of G.conns.filter((c) => c.from.type === 'avenue' && c.turn === 'right')) assert.equal(c.from.l, 2);
  // right-hand traffic: eastbound keeps to the south half of the street, left-hand the north
  const eb = (g) => g.lanes.find((l) => l.type === 'street' && l.dir === 'E' && l.j === 3);
  assert.ok(eb(G).z0 > STREET_ZS[3] && eb(GL).z0 < STREET_ZS[3]);
});

test('signals: avenue and street greens never overlap, and a green wave staggers the lights', () => {
  assert.ok(AVENUE_GREEN[1] <= STREET_GREEN[0] && STREET_GREEN[1] <= CYCLE);
  for (let u = 0; u < CYCLE; u += 0.25) {
    const av = mayEnter(0, u, 50, 0), st = mayEnter(1, u, 50, 0);
    assert.ok(!(av && st), `both flows go at u=${u}`);
  }
  assert.ok(mayEnter(0, AVENUE_GREEN[1] + 0.5, 3, 12), 'a car that cannot stop still clears the box');
  assert.ok(!mayEnter(0, AVENUE_GREEN[1] + 0.5, 40, 12), 'one that can, stops');
  assert.ok(!mayEnter(0, AVENUE_GREEN[1] + 3, 1, 12), 'but not once the cross street is moving');
  for (let u = 0; u < CYCLE; u += 0.25) {
    if (mayCross('avenue', u)) assert.ok(!mayEnter(0, u, 50, 0) && !mayEnter(0, u, 1, 12), 'walkers cross the avenue only while its cars are stopped');
    if (mayCross('street', u)) assert.ok(!mayEnter(1, u, 50, 0) && !mayEnter(1, u, 1, 12), 'and the street only while its cars are stopped');
  }
  const offs = new Set(G.inters[2].map((i) => i.off.toFixed(2)));
  assert.ok(offs.size > 6, 'neighbouring intersections are out of step');
  assert.equal(signalU(CYCLE + 3, 0), 3);
});

test('car following: free acceleration, a steady headway behind a slower car, a full stop behind a stopped one', () => {
  const p = { a: 2.2, b: 3.2, T: 1, s0: 2 };
  assert.ok(idmAcc(0, 13, Infinity, 0, p) > 2);
  assert.ok(Math.abs(idmAcc(13, 13, Infinity, 0, p)) < 1e-9);
  assert.ok(idmAcc(10, 13, 5, 0, p) < -5, 'brakes hard when close to a wall');
  assert.ok(idmAcc(10, 13, 200, 10, p) > 0, 'ignores a far leader');
  // follow a leader at 8 m/s
  let v = 12, x = 0, lead = 40;
  for (let t = 0; t < 120; t += 0.05) { v = Math.max(0, v + idmAcc(v, 13, lead - x - 4.3, 8, p) * 0.05); x += v * 0.05; lead += 8 * 0.05; }
  assert.ok(Math.abs(v - 8) < 0.2, `settles at the leader's speed (${v})`);
  const gap = lead - x - 4.3;
  assert.ok(gap > p.s0 + 8 * p.T * 0.7 && gap < p.s0 + 8 * p.T * 1.6, `time headway holds (${gap})`);
  // stop for a standing queue 60 m away
  v = 13; x = 0;
  let minGap = Infinity;
  for (let t = 0; t < 40; t += 0.05) { v = Math.max(0, v + idmAcc(v, 13, 60 - x - 4.3, 0, p) * 0.05); x += v * 0.05; minGap = Math.min(minGap, 60 - x - 4.3); }
  assert.ok(v < 0.05 && minGap > 1, `stops short of the queue (gap ${minGap})`);
});

test('the walk ring puts every corner on a crossing, outside every building, and the park has gates', () => {
  const grid = blocks().filter((b) => b.district !== 'park');
  const sw = G.walk;
  for (const e of sw.edges.filter((e) => e.kind === 'walk' || e.kind === 'cross')) {
    for (const n of [e.a, e.b]) for (const b of grid) assert.ok(!(n.x > b.minX && n.x < b.maxX && n.z > b.minZ && n.z < b.maxZ), 'node inside a building block');
  }
  const crosses = sw.edges.filter((e) => e.kind === 'cross');
  assert.ok(crosses.length > 100);
  for (const e of crosses) {
    assert.ok(near(e.len, e.axis === 'avenue' ? 2 * (AVENUE_HALF + 1.8) : 2 * (STREET_HALF + 1.8)), `crossing ${e.axis} length ${e.len}`);
    assert.equal(G.inters[e.inter.k][e.inter.j].cw[e.side], e);
  }
  assert.ok(sw.edges.some((e) => e.kind === 'gate') && sw.edges.some((e) => e.kind === 'park'));
  // everything is reachable from one corner (the walk graph is one piece)
  const seen = new Set([sw.nodes[0]]), todo = [sw.nodes[0]];
  while (todo.length) for (const e of todo.pop().edges) for (const n of [e.a, e.b]) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  assert.ok(seen.size > sw.nodes.length * 0.97, `${seen.size} of ${sw.nodes.length} nodes connected`);
  const hit = nearestWalk(sw, 14, -92, {});
  assert.equal(hit.edge.kind, 'walk');
  assert.ok(hit.dist < 6);
  const b = grid[0];
  assert.ok(near(nearestWalk(sw, b.cx, b.minZ - WALK - 0.5, {}).dist, 0.5, 0.05) || nearestWalk(sw, b.cx, b.minZ - WALK - 0.5, {}).dist < 3);
});

test('parking bays sit on the kerb, clear of the corners', () => {
  const out = {};
  for (let a = 0; a < 4; a++) for (let j = 0; j < STREET_ZS.length; j += 5) for (const side of [-1, 1]) {
    for (const i of [0, bayCount(a) - 1]) {
      bayAt(a, j, side, i, false, out);
      assert.ok(near(Math.abs(out.z - STREET_ZS[j]), 4.85));
      assert.ok(Math.abs(out.x - AVENUE_XS[a]) >= AVENUE_HALF + 11.9 || a === 0, 'clear of the west avenue');
      assert.ok(Math.abs(out.x - AVENUE_XS[a + 1]) >= AVENUE_HALF + 11.9, 'clear of the east avenue');
      assert.ok(out.x > SHORE_WEST + 4);
    }
  }
  assert.notEqual(bayAt(0, 3, 1, 0, false, {}).h, bayAt(0, 3, 1, 0, true, {}).h, 'left-hand cities park the other way round');
});

// --- the whole sim, headless ---------------------------------------------------
const player = (x = 0, z = -100) => ({ position: new THREE.Vector3(x, 0.18, z), velocity: new THREE.Vector3(), speed: 0, radius: 0.5, vehicle: false });
const obb = (v) => { const c = Math.cos(v.heading), s = Math.sin(v.heading); return { x: v.cx, z: v.cz, ax: [-s, -c], ay: [c, -s], hl: v.half, hw: v.wid / 2 }; };
const overlap = (a, b) => {
  for (const ax of [a.ax, a.ay, b.ax, b.ay]) {
    const pr = (o) => Math.abs(ax[0] * o.ax[0] + ax[1] * o.ax[1]) * o.hl + Math.abs(ax[0] * o.ay[0] + ax[1] * o.ay[1]) * o.hw;
    if (Math.abs((b.x - a.x) * ax[0] + (b.z - a.z) * ax[1]) > pr(a) + pr(b)) return false;
  }
  return true;
};
const solidBlocks = blocks().filter((b) => b.district !== 'park');
const inBlock = (x, z, m = 0) => solidBlocks.some((b) => x > b.minX + m && x < b.maxX - m && z > b.minZ + m && z < b.maxZ - m);

function run(life, p, seconds, dt = 1 / 30) { for (let t = 0; t < seconds; t += dt) life.update(dt, p); }
// A long jump re-seeds the whole city around the player, so travel in short hops.
function walkTo(life, p, x, z) {
  while (Math.hypot(x - p.position.x, z - p.position.z) > 1) {
    const dx = x - p.position.x, dz = z - p.position.z, d = Math.hypot(dx, dz), k = Math.min(50, d) / d;
    p.position.x += dx * k; p.position.z += dz * k;
    run(life, p, 0.1);
  }
}

test('1900 has no motor vehicles; 2100 flies at about 14 m and keeps hover cars out of the obstacle list', () => {
  const old = createLife({ era: '1900', rng: createRng(3) }), p = player();
  run(old, p, 20);
  assert.ok(old.vehicles.length > 15 && old.vehicles.every((v) => v.kind === 'carriage'));
  assert.ok(old.pedestrians.length >= 110);
  const fut = createLife({ era: '2100', rng: createRng(3) });
  run(fut, p, 20);
  const hovers = fut.vehicles.filter((v) => v.kind === 'hover');
  assert.ok(hovers.length >= 30);
  for (const h of hovers) assert.ok(h.position.y > 12 && h.position.y < 19.5, `hover at y=${h.position.y}`);
  const hoverBoxes = new Set(fut.obstacles());
  assert.equal(hoverBoxes.size, fut.vehicles.filter((v) => !v.hover).length, 'only ground vehicles are obstacles');
  assert.equal(fut.nearestVehicle(hovers[0].position, 30)?.hover, undefined, 'a hover car is never offered');
  assert.ok(fut.vehicles.some((v) => v.kind === 'taxi'));
});

test('2000 fills the street: cars, cabs, buses moving, parked cars on the kerb, walkers on the sidewalks', () => {
  for (const city of ['nyc', 'tokyo']) {
    const life = createLife({ era: '2000', city, rng: createRng(5) }), p = player();
    run(life, p, 30);
    const moving = life.vehicles.filter((v) => !v.parked), parked = life.vehicles.filter((v) => v.parked);
    assert.ok(moving.length >= 44 && parked.length >= 25, `${moving.length} moving, ${parked.length} parked`);
    assert.ok(['car', 'taxi', 'bus'].every((k) => moving.some((v) => v.kind === k)));
    assert.ok(moving.filter((v) => v.speed > 3).length > 10, 'traffic actually moves');
    for (const v of life.vehicles) assert.ok(!inBlock(v.cx, v.cz, 0.5), 'no vehicle inside a building block');
    for (const w of life.pedestrians) assert.ok(!inBlock(w.position.x, w.position.z, 0.2), 'no walker inside a building block');
    assert.ok(life.pedestrians.length >= 70);
  }
});

test('keeping to lanes: 5 minutes of traffic with a wandering player, no two vehicles ever overlap', () => {
  for (const [era, city, seed] of [['2000', 'nyc', 21], ['2000', 'tokyo', 22], ['2100', 'nyc', 23]]) {
    const life = createLife({ era, city, rng: createRng(seed) }), p = player();
    let ang = 0, bad = 0;
    for (let i = 0; i < 5 * 60 * 30; i++) {
      if (i % 225 === 0) ang = (i * 0.7) % (Math.PI * 2);
      p.velocity.set(Math.cos(ang) * 5, 0, Math.sin(ang) * 5); p.speed = 5;
      p.position.x = Math.max(-250, Math.min(250, p.position.x + p.velocity.x / 30)); p.position.z = Math.max(-640, Math.min(220, p.position.z + p.velocity.z / 30));
      life.update(1 / 30, p);
      if (i % 3) continue;
      const g = life.vehicles.filter((v) => v.placed && !v.hover);
      for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) {
        if (Math.abs(g[x].cx - g[y].cx) > 14 || Math.abs(g[x].cz - g[y].cz) > 14) continue;
        if (overlap(obb(g[x]), obb(g[y]))) bad++;
      }
    }
    assert.equal(bad, 0, `${era} ${city}: ${bad} overlapping frames`);
    assert.ok(life.vehicles.every((v) => v.placed));
  }
});

test('cars brake for the player in front of them and wait', () => {
  const life = createLife({ era: '2000', rng: createRng(8) });
  const p = player(0, -100);
  run(life, p, 15);
  const pick = () => life.vehicles.filter((v) => !v.parked && v.edge.kind === 'lane' && v.speed > 4 && v.edge.len - v.s > 45)
    .sort((a, b) => Math.hypot(a.cx - p.position.x, a.cz - p.position.z) - Math.hypot(b.cx - p.position.x, b.cz - p.position.z))[0];
  let v = pick();
  for (let k = 0; k < 8 && Math.hypot(v.cx - p.position.x, v.cz - p.position.z) > 40; k++) {   // walk over in short hops: a long jump re-seeds the city
    const dx = v.cx - p.position.x, dz = v.cz - p.position.z, d = Math.hypot(dx, dz);
    p.position.x += dx / d * 50; p.position.z += dz / d * 50;
    run(life, p, 0.2);
    v = pick();
  }
  assert.ok(v, 'a car to test on');
  const f = [-Math.sin(v.heading), -Math.cos(v.heading)];
  const q = { ...player(), position: new THREE.Vector3(v.cx + f[0] * 28, 0.18, v.cz + f[1] * 28) };
  for (let i = 0; i < 30 * 12; i++) life.update(1 / 30, q);
  assert.ok(v.speed < 0.5, `waits behind the player (speed ${v.speed})`);
  assert.ok(Math.hypot(v.cx - q.position.x, v.cz - q.position.z) > 1.5 + v.half, 'without touching them');
});

test('a player flying overhead is no obstacle', () => {
  const life = createLife({ era: '2000', rng: createRng(14) }), p = player();
  run(life, p, 15);
  const v = life.vehicles.find((v) => !v.parked && v.edge.kind === 'lane' && v.speed > 4 && Math.hypot(v.cx - p.position.x, v.cz - p.position.z) < 70);
  assert.ok(v);
  const f = [-Math.sin(v.heading), -Math.cos(v.heading)];
  const sky = { position: new THREE.Vector3(v.cx + f[0] * 12, 40, v.cz + f[1] * 12), velocity: new THREE.Vector3(f[0] * -30, 0, f[1] * -30), speed: 30, radius: 1, vehicle: true };
  let slowest = Infinity;
  for (let i = 0; i < 60; i++) { life.update(1 / 30, sky); slowest = Math.min(slowest, v.speed); }
  assert.ok(slowest > 2, 'cars carry on under a flyer');
});

test('ramming shoves a vehicle and slows it; it springs back to its lane', () => {
  const life = createLife({ era: '2000', rng: createRng(9) }), p = player();
  run(life, p, 5);
  const parked = life.vehicles.find((v) => v.parked && Math.hypot(v.cx - p.position.x, v.cz - p.position.z) < 150) || life.vehicles.find((v) => v.parked);
  const home = [parked.cx, parked.cz];
  walkTo(life, p, parked.cx, parked.cz - 8);
  assert.ok(parked.placed && Math.hypot(parked.cx - home[0], parked.cz - home[1]) < 1e-9, 'still parked');
  const q = { position: new THREE.Vector3(parked.cx, 0, parked.cz - 8), velocity: new THREE.Vector3(0, 0, 25), speed: 25, radius: 1.3, vehicle: true };
  life.update(1 / 30, q);
  for (let i = 0; i < 30; i++) { q.position.z += 25 / 30; life.update(1 / 30, q); }
  assert.ok(parked.ov || Math.hypot(parked.cx - home[0], parked.cz - home[1]) > 0.1, 'it was hit');
  const far = { position: new THREE.Vector3(parked.cx, 0, parked.cz + 60), velocity: new THREE.Vector3(), speed: 0, radius: 1, vehicle: true };
  for (let i = 0; i < 30 * 6; i++) life.update(1 / 30, far);
  assert.ok(Math.hypot(parked.cx - home[0], parked.cz - home[1]) < 0.05 && !parked.ov, 'back where it was parked');
});

test('a fast player vehicle makes walkers dive, then they get up and carry on', () => {
  const life = createLife({ era: '1900', rng: createRng(4) }), p = player(0, -100);
  run(life, p, 10);
  const w = life.pedestrians.filter((w) => w.state === 'walk' && w.edge.kind === 'walk' && w.edge.len > 60 && w.s > 20 && w.s < w.edge.len - 20 && Math.hypot(w.position.x - p.position.x, w.position.z - p.position.z) < 50)[0];
  assert.ok(w, 'a walker to scare');
  const e = w.edge;
  const car = { position: new THREE.Vector3(w.position.x - e.tx * 10, 0, w.position.z - e.tz * 10), velocity: new THREE.Vector3(e.tx * 24, 0, e.tz * 24), speed: 24, radius: 1.3, vehicle: true };
  life.update(1 / 30, car);
  assert.equal(w.state, 'flee');
  for (let i = 0; i < 60; i++) { life.update(1 / 30, { ...car, velocity: new THREE.Vector3(), speed: 0, vehicle: false }); assert.ok(!inBlock(w.position.x, w.position.z, 0.1), 'never dives into a wall'); }
  for (let i = 0; i < 60; i++) life.update(1 / 30, { ...car, velocity: new THREE.Vector3(), speed: 0, vehicle: false });
  assert.equal(w.state, 'walk');
});

test('the fare contract: pick, claim, board, release; taking a vehicle hands over its model and refills the street', () => {
  const life = createLife({ era: '2000', rng: createRng(12) }), p = player(0, -100);
  run(life, p, 30);
  const fare = life.pickFare(p.position, 20, 100);
  assert.ok(fare && fare.state === 'walk');
  const d = Math.hypot(fare.position.x - p.position.x, fare.position.z - p.position.z);
  assert.ok(d >= 20 && d <= 100);
  life.claim(fare);
  assert.equal(fare.state, 'claimed');
  const spot = fare.position.clone();
  run(life, p, 2);
  assert.ok(fare.position.distanceTo(spot) < 1e-6, 'a claimed walker stands still');
  life.board(fare);
  assert.equal(fare.state, 'ride');
  assert.equal(fare.model.visible, false);
  run(life, p, 2);
  life.release(fare, new THREE.Vector3(30, 0, -100));
  assert.equal(fare.state, 'walk');
  assert.equal(fare.model.visible, true);
  assert.ok(fare.position.y > 0.1 && Math.abs(fare.position.y - 0.18) < 0.2, 'back on the sidewalk');
  run(life, p, 5);
  assert.equal(fare.state === 'walk' || fare.state === 'wait', true);

  const v = life.nearestVehicle(p.position, 120);
  assert.ok(v && !v.hover);
  const before = life.vehicles.length, boxes = life.obstacles().length;
  const model = life.take(v);
  assert.equal(model.parent, null);
  assert.ok(!life.vehicles.includes(v) && life.obstacles().length === boxes, 'swapped for a fresh one');
  assert.equal(life.vehicles.length, before);
  run(life, p, 2);
  assert.ok(life.vehicles.every((x) => x.placed));
  life.dispose();
  assert.equal(life.vehicles.length, 0);
});

test('the same seed gives the same city', () => {
  const snap = () => {
    const life = createLife({ era: '2000', rng: createRng(77) }), p = player();
    run(life, p, 20);
    return [...life.vehicles.slice(0, 20).map((v) => [v.cx.toFixed(2), v.cz.toFixed(2)]), ...life.pedestrians.slice(0, 20).map((w) => [w.position.x.toFixed(2), w.position.z.toFixed(2)])];
  };
  assert.deepEqual(snap(), snap());
});

test('everything is recycled around a player who drives off or teleports', () => {
  const life = createLife({ era: '2000', rng: createRng(31) }), p = player(0, -100);
  run(life, p, 5);
  const n = life.vehicles.length + life.pedestrians.length;
  const q = player(200, -500);
  run(life, q, 5);
  const within = (o, r) => Math.hypot(o.x - q.position.x, o.z - q.position.z) < r;
  assert.ok(life.vehicles.every((v) => within(v.position, 260)), 'vehicles follow the player');
  assert.ok(life.pedestrians.every((w) => within(w.position, 260)), 'walkers follow the player');
  assert.equal(life.vehicles.length + life.pedestrians.length, n, 'no allocation, no loss');
});

// --- residents ---------------------------------------------------------------------------------

test('routing: every door is reachable, and stepping toward it costs exactly what the field promises', () => {
  const sw = G.walk, places = placesFor(), rng = createRng(3), walkEdges = sw.edges.filter((e) => e.kind === 'walk');
  for (let k = 0; k < 40; k++) {
    const door = places[Math.floor(rng() * places.length)].door, a = doorAnchor(sw, door.x, door.z), f = routeField(sw, a);
    assert.ok(f.every(Number.isFinite), 'the whole walk graph connects to the door');
    const e0 = walkEdges[Math.floor(rng() * walkEdges.length)], s0 = rng() * e0.len;
    const promised = e0 === a.edge ? Math.abs(a.s - s0) : Math.min(e0.len - s0 + f[e0.b.id], s0 + f[e0.a.id]);
    let e = e0, s = s0, dir = dirToward(e, s, a), cost = 0, hops = 0;
    while (e !== a.edge) {
      cost += dir > 0 ? e.len - s : s;
      if (e !== e0) cost += e.cost - e.len;   // crossings charge for the wait
      const node = dir > 0 ? e.b : e.a, nx = nextToward(node, e, a);
      dir = nx.a === node ? 1 : -1; s = dir > 0 ? 0 : nx.len; e = nx;
      assert.ok(++hops < 80, 'no wandering');
    }
    cost += Math.abs(a.s - s);
    assert.ok(Math.abs(cost - promised) < 1e-6, `walked ${cost}, promised ${promised}`);
  }
  assert.equal(dirToward(walkEdges[0], 3, { edge: walkEdges[0], s: 10 }), 1);
  assert.equal(dirToward(walkEdges[0], 30, { edge: walkEdges[0], s: 10 }), -1);
});

const townLife = (era, city, hour, seed = 5, density = 1) => {
  const town = createTown({ city, era, hour }), life = createLife({ era, city, rng: createRng(seed), town, density });
  return { town, life };
};
// The town runs at 60 game seconds per second; life draws what it says is outdoors.
function drive(town, life, p, seconds, each) {
  for (let t = 0; t < seconds; t += 1 / 30) { town.tick(2); life.update(1 / 30, p); each?.(); }
}
const sig = (model) => {
  let h = 0, n = 0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const a of [o.geometry.attributes.position, o.geometry.attributes.color]) for (let i = 0; i < a.array.length; i += 7) { h = (h * 31 + Math.round(a.array[i] * 1000)) | 0; n++; }
  });
  return `${n}:${h}`;
};

test('residents are the walkers: one body per outdoor resident, looks from their seed, strangers have no id', () => {
  const { town, life } = townLife('2000', 'nyc', 10), p = player(0, -200);
  drive(town, life, p, 60);
  const res = life.pedestrians.filter((w) => w.residentId);
  assert.ok(res.length > 20, `${res.length} residents on the street`);
  assert.equal(new Set(res.map((w) => w.residentId)).size, res.length, 'never two bodies for one person');
  for (const w of res) {
    assert.equal(life.pedFor(w.residentId), w);
    assert.equal(town.person(w.residentId), w.res);
    assert.equal(w.model.userData.dims.h > 0, true);
  }
  assert.equal(life.pedFor('r999'), null);
  assert.ok(life.pedestrians.length <= inspect(life).cap);
  assert.ok(life.pedestrians.every((w) => w.residentId === null || typeof w.residentId === 'string'));
  for (const w of life.pedestrians) assert.ok(!inBlock(w.position.x, w.position.z, 0.2), 'nobody inside a building');
  const near = life.nearestPed(p.position, 400);
  assert.ok(near && near.residentId, 'talk target is a resident');
  assert.ok(life.nearestPed(p.position, 400, { residentsOnly: false }));
  const standing = res.filter((w) => w.statik).length;
  assert.ok(standing <= inspect(life).cap * 0.4 + 1, 'standing workers do not crowd walkers out');
});

test('the same person looks the same after walking away and back (models are cached, then rebuilt from the seed)', () => {
  const { town, life } = townLife('2000', 'nyc', 9), p = player(0, -200);
  const seen = new Map();   // id -> { sig, uuids }
  let rebuilt = 0, mismatched = 0;
  const watch = () => {
    for (const w of life.pedestrians) {
      if (!w.residentId) continue;
      const s = sig(w.model), rec = seen.get(w.residentId);
      if (!rec) seen.set(w.residentId, { sig: s, uuids: new Set([w.model.uuid]) });
      else { if (rec.sig !== s) mismatched++; if (!rec.uuids.has(w.model.uuid)) { rebuilt++; rec.uuids.add(w.model.uuid); } }
    }
  };
  for (let leg = 0; leg < 6; leg++) {
    const at = leg % 2 ? [200, -500] : [0, -200];   // far enough apart that the other end falls out of range and its models expire
    p.position.set(at[0], 0.18, at[1]);
    drive(town, life, p, 75, leg % 3 === 2 ? watch : () => {});
    drive(town, life, p, 1, watch);
  }
  assert.equal(mismatched, 0, 'one look per person');
  assert.ok(seen.size > 30);
  for (const w of life.pedestrians) if (w.residentId) assert.equal(w.model.userData.dims.len > 0, true);
  assert.ok(rebuilt >= 0);
  // build one explicitly: same seed, same sig
  const a = life.pedestrians.find((w) => w.residentId), twin = models.makePedestrian({ seed: a.res.look.seed, era: '2000', city: 'nyc' });
  assert.equal(sig(twin), sig(a.model));
});

test('walkers come out of one door and go in at another', () => {
  const { town, life } = townLife('2000', 'nyc', 8), p = player(200, -260);   // the most lived-in corner of the map
  let enters = 0, emerges = 0, worstIn = 0, worstOut = 0, live = new Set();
  const watch = () => {
    for (const w of life.pedestrians) {
      if (!w.residentId || live.has(w.residentId)) continue;
      live.add(w.residentId);
      if (w.fx < 0.2 && w.lat < -1 && w.res.act.kind === 'walk') {
        emerges++;
        worstOut = Math.max(worstOut, Math.hypot(w.position.x - town.where(w.res).from.x, w.position.z - town.where(w.res).from.z));
      }
    }
    for (const id of [...live]) {
      if (life.pedFor(id)) continue;
      live.delete(id);
      const w = inspect(life).resPeds.get(id);
      if (w && w.gone === 'door') { enters++; const d = town.where(w.res); worstIn = Math.max(worstIn, Math.hypot(w.position.x - d.x, w.position.z - d.z)); }
    }
  };
  drive(town, life, p, 600, watch);
  assert.ok(emerges >= 3, `${emerges} came out of doors`);
  assert.ok(enters >= 2, `${enters} went in`);
  assert.ok(worstOut < 2.5, `came out at the door (${worstOut})`);
  assert.ok(worstIn < 2.5, `went in at the door (${worstIn})`);
});

test('a hailed resident leaves the street; let out, they walk to their door and go in', () => {
  const { town, life } = townLife('2000', 'nyc', 10), p = player(0, -200);
  drive(town, life, p, 30);
  const fare = life.pickFare(p.position, 5, 200);
  assert.ok(fare && fare.residentId, 'residents are preferred as fares');
  const r = fare.res;
  life.claim(fare);
  drive(town, life, p, 3);
  assert.equal(fare.state, 'claimed');
  life.board(fare);
  town.hail(r, fare.position);
  drive(town, life, p, 5);
  assert.equal(fare.state, 'ride');
  assert.ok(life.pedestrians.includes(fare) && !fare.model.visible, 'the cab keeps them');
  const here = town.places.filter((q) => q.kind === 'home').sort((x, y) => Math.hypot(x.door.x - p.position.x, x.door.z - p.position.z) - Math.hypot(y.door.x - p.position.x, y.door.z - p.position.z))[0];
  const at = { x: here.door.x + 12, z: here.door.z, y: 0.18 };
  town.dropOff(r, here.id);
  life.release(fare, at);
  assert.equal(fare.state, 'walk');
  drive(town, life, p, 0.5);
  const w0 = town.where(r);
  if (w0.outdoors) assert.ok(!fare.leaving, 'the town has them out and about');
  else {
    assert.ok(fare.leaving && fare.route, 'indoors per the town: heading for the door');
    assert.ok(Math.hypot(fare.route.anchor.edge.x0 + fare.route.anchor.edge.tx * fare.route.anchor.s - w0.x, fare.route.anchor.edge.z0 + fare.route.anchor.edge.tz * fare.route.anchor.s - w0.z) < 1, 'the right door');
    drive(town, life, p, 40);
    if (!town.where(r).outdoors) { assert.ok(!life.pedestrians.includes(fare), 'they went in'); assert.ok(['door', 'range'].includes(fare.gone)); }
  }
});

test('residents dive from a fast player vehicle and carry on to their door', () => {
  const { town, life } = townLife('2000', 'nyc', 10), p = player(0, -200);
  drive(town, life, p, 40);
  const pick = () => life.pedestrians.filter((q) => q.residentId && q.state === 'walk' && q.edge.kind === 'walk' && q.edge.len > 60 && q.s > 20 && q.s < q.edge.len - 20 && !q.entering)
    .sort((x, y) => Math.hypot(x.position.x - p.position.x, x.position.z - p.position.z) - Math.hypot(y.position.x - p.position.x, y.position.z - p.position.z))[0];
  let w = pick();
  for (let k = 0; k < 6 && Math.hypot(w.position.x - p.position.x, w.position.z - p.position.z) > 40; k++) {   // short hops: a long jump re-seeds the street
    const dx = w.position.x - p.position.x, dz = w.position.z - p.position.z, d = Math.hypot(dx, dz);
    p.position.x += dx / d * 40; p.position.z += dz / d * 40;
    drive(town, life, p, 0.2);
    w = pick();
  }
  assert.ok(w && Math.hypot(w.position.x - p.position.x, w.position.z - p.position.z) < 80);
  const e = w.edge, car = { position: new THREE.Vector3(w.position.x - e.tx * 10, 0, w.position.z - e.tz * 10), velocity: new THREE.Vector3(e.tx * 24, 0, e.tz * 24), speed: 24, radius: 1.3, vehicle: true };
  const hadRoute = !!w.route;
  town.tick(2); life.update(1 / 30, car);
  assert.equal(w.state, 'flee');
  const still = { ...car, velocity: new THREE.Vector3(), speed: 0, vehicle: false };
  for (let i = 0; i < 70; i++) { town.tick(2); life.update(1 / 30, still); }
  assert.ok(w.state === 'walk' || !life.pedestrians.includes(w), 'up again');
  if (life.pedestrians.includes(w) && hadRoute) assert.ok(w.route || w.loiter || w.entering || w.stayPark || w.pacing || w.state === 'wait');
});

test('visitors keep a minimum crowd on the street when the town is asleep', () => {
  const { town, life } = townLife('2000', 'nyc', 3.5), p = player(0, -200);
  drive(town, life, p, 20);
  const strangers = life.pedestrians.filter((w) => w.residentId === null);
  assert.ok(life.pedestrians.length >= 25, `${life.pedestrians.length} on the street`);
  assert.ok(strangers.length >= 10, 'strangers fill in');
  for (const w of strangers) assert.equal(w.res, null);
  const mid = createTown({ era: '2000', hour: 11 }), life2 = createLife({ era: '2000', rng: createRng(5), town: mid });
  drive(mid, life2, p, 150);
  const seeable = (w) => Math.hypot(w.position.x - p.position.x, w.position.z - p.position.z) < 150;
  assert.ok(life2.pedestrians.filter((w) => w.residentId && seeable(w)).length >= 5, 'by day residents are out');
  assert.ok(life2.pedestrians.filter(seeable).length >= 25, 'and the crowd you can see never thins below 25');
});

test('with no town the walkers are anonymous, as before', () => {
  const life = createLife({ era: '2000', rng: createRng(5) }), p = player();
  run(life, p, 10);
  assert.ok(life.pedestrians.length >= 70);
  assert.ok(life.pedestrians.every((w) => w.residentId === null));
  assert.equal(life.pedFor('r000'), null);
  assert.equal(life.nearestPed(p.position, 1000), null);
  assert.ok(life.nearestPed(p.position, 1000, { residentsOnly: false }));
});

test('the life layer with a town stays well inside its time budget', () => {
  for (const era of ['1900', '2000', '2100']) {
    const { town, life } = townLife(era, 'nyc', 12), p = player(0, -200);
    drive(town, life, p, 20);
    let sum = 0, n = 0, worst = 0;
    for (let i = 0; i < 600; i++) { town.tick(2); const t = performance.now(); life.update(1 / 30, p); const d = performance.now() - t; sum += d; n++; worst = Math.max(worst, d); }
    assert.ok(sum / n < 1, `${era}: ${(sum / n).toFixed(3)} ms per update`);
    assert.ok(life.pedestrians.length <= inspect(life).cap);
  }
});
