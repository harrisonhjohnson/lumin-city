import * as THREE from 'three';
import * as models from './models.js';
import {
  buildGraph, edgePose, edgeY, walkY, nearestWalk, nearestOnGraph, doorAnchor, routeField, nextToward, dirToward, idmAcc, mayEnter, mayCross, signalU, bayAt, bayCount,
  AVENUE_HALF, STREET_HALF,
} from './life-graph.js';
import { AVENUE_XS, STREET_ZS } from '../world/city/districts.js';
import { createRng } from '../world/city/rng.js';

// The living city: traffic that keeps to its lanes and pedestrians on the sidewalks, around the
// player. Everything lives within RANGE of the player and is recycled, never reallocated.
// Graph, signals and car-following are pure and live in life-graph.js.
//   update(dt, player)  player = { position (feet), velocity, speed, radius, vehicle }. Cars brake for
//                       a player on the road ahead, a fast player vehicle shoves them and scatters
//                       walkers; a player more than 3 m up (swinging, flying) is ignored. The first
//                       call places everything around the player, so make it before the round starts.
//   vehicle.position is the model origin; obstacles() boxes follow the vehicles as they move.
// With a `town` (town.js) the walkers are its residents: each frame the outdoor residents near the
// player get a body (their own look, cached per id), walk the sidewalks to the door the town says
// they are heading for, and go in when the town sends them indoors. Without one, anonymous walkers.
const RANGE = 240, RING_MIN = 110, NEAR = 72, DETAIL = 80, HIDE = 200, HIDE_PED = 150;
const MAX_VEHICLE_SPAWNS = 3, MAX_PED_SPAWNS = 6, TRACK_EVERY = 0.12, MODEL_CACHE = 140, MIN_CROWD = 36, TOWN_NEAR = 175, TOWN_FAR = 205, VISITOR_RING = [100, 148], VISITOR_FAR = 170;

const IDM = {
  car: { a: 2.2, b: 3.2, T: 1.0, s0: 2.0 }, taxi: { a: 2.4, b: 3.2, T: 0.95, s0: 2.0 },
  bus: { a: 1.2, b: 2.4, T: 1.2, s0: 2.5 }, carriage: { a: 1.2, b: 2.6, T: 1.1, s0: 2.5 }, hover: { a: 3, b: 3, T: 0.9, s0: 3 },
};
const SPEED = { car: [11, 14], taxi: [11.5, 14.5], bus: [8.5, 10.5], carriage: [6, 8], hover: [14, 20] };
const DIMS = { carriage: { len: 5.5, wid: 1.85, h: 3.1, zc: -0.96 }, hover: { len: 4.5, wid: 2, h: 1.8, zc: 0.05 } };   // measured from the existing models
const TURN_W = { straight: 6, left: 1, right: 1.4 };
const CAR_COLOURS = ['#c23b32', '#2f6fdb', '#e8e6df', '#23262c', '#8a97ab', '#3fae5a', '#d9a33a', '#6e4a2e', '#5b3a7a', '#e8e6df', '#23262c'];
const HOVER_COLOURS = ['#39e6ff', '#ff3d8b', '#e8eef2', '#6dff8a', '#ffb03a', '#b08aff'];

// [kind, count] per era at density 1. 1900 has no motor vehicles at all.
function composition(era, city) {
  if (era === '1900') return { moving: [['carriage', 20]], parked: [['carriage', 6]], peds: 118 };
  if (era === '2100') return { moving: [['hover', 52], ['taxi', 7]], parked: [], peds: 76 };
  return city === 'tokyo'
    ? { moving: [['car', 28], ['taxi', 19], ['bus', 5]], parked: [['car', 29], ['taxi', 2]], peds: 76 }
    : { moving: [['car', 24], ['taxi', 20], ['bus', 7]], parked: [['car', 28], ['taxi', 3]], peds: 76 };
}

const internals = new WeakMap();
// Everything the contract does not expose (graph, clock, counters), for the preview and the tests.
export const inspect = (life) => internals.get(life);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dampAngle = (a, b, k, dt) => a + wrap(b - a) * (1 - Math.exp(-k * dt));
const listInsert = (list, v) => { let i = list.length; while (i > 0 && list[i - 1].s > v.s) i--; list.splice(i, 0, v); };
const listRemove = (list, v) => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); };
const headingOf = (dx, dz) => Math.atan2(-dx, -dz);

export function createLife({ era = '2000', city = 'nyc', rng = createRng(1), density = 1, town = null } = {}) {
  const left = city === 'tokyo', G = buildGraph({ left }), S = G.walk;
  const group = new THREE.Group();
  group.name = 'life';
  const vehicles = [], pedestrians = [], obstList = [];
  const comp = composition(era, city);
  let seq = 0, clock = 0, seeded = false, last = null;

  const mkSet = (lanes, weight) => { let c = 0; return { lanes, cum: lanes.map((l) => (c += l.len * weight(l))), total: c }; };
  const allLanes = mkSet(G.lanes, (l) => (l.type === 'avenue' ? 1.6 : 1));
  const avenueLanes = mkSet(G.lanes.filter((l) => l.type === 'avenue'), () => 1);
  const pickLane = (set) => {
    const r = rng() * set.total;
    let lo = 0, hi = set.cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (set.cum[m] < r) lo = m + 1; else hi = m; }
    return set.lanes[lo];
  };
  const bayWeights = [0, 1, 2, 3].map(bayCount), bayTotal = bayWeights.reduce((a, b) => a + b, 0);
  const taken = new Set();

  // --- The player, read once a frame ---------------------------------------------
  const PL = { x: 0, z: 0, vx: 0, vz: 0, speed: 0, r: 0.5, vehicle: false, fx: 0, fz: 0, fast: false, active: false, low: true };
  function readPlayer(p) {
    PL.active = !!p;
    if (!p) return;
    PL.x = p.position.x; PL.z = p.position.z;
    PL.vx = p.velocity?.x || 0; PL.vz = p.velocity?.z || 0;
    const flat = Math.hypot(PL.vx, PL.vz);
    PL.speed = p.speed ?? flat; PL.r = p.radius ?? 0.5; PL.vehicle = !!p.vehicle;
    PL.fx = flat > 0.5 ? PL.vx / flat : 0; PL.fz = flat > 0.5 ? PL.vz / flat : 0;
    PL.low = p.position.y < 3;
    PL.fast = PL.low && PL.vehicle && PL.speed > 8 && flat > 0.5;
  }

  // --- Models ---------------------------------------------------------------------
  const genericNear = (model) => {
    const out = [];
    model.traverse((o) => { if (o.isMesh && (o.material.transparent || o.material.emissiveIntensity > 0)) out.push(o); });
    return out;
  };
  function buildModel(kind) {
    let m;
    switch (kind) {
      case 'car': m = models.makeCar(rng.pick(CAR_COLOURS)); break;
      case 'taxi': m = models.makeTaxi(city, era === '2100' ? rng.pick(['#e6edf2', '#cfd8e0', '#39e6ff']) : city === 'tokyo' ? (rng() < 0.28 ? '#4d1220' : '#17181d') : undefined); break;
      case 'bus': m = models.makeBus(rng.pick(city === 'tokyo' ? ['#2f9e6a', '#e8e6df', '#2b62a6'] : ['#2b62a6', '#2b62a6', '#d9d6cc'])); break;
      case 'carriage': m = models.makeHorseCarriage(); break;
      default: m = models.makeHoverCar(rng.pick(HOVER_COLOURS));
    }
    if (!m.userData.near) m.userData.near = genericNear(m);
    return m;
  }
  const setLod = (m, near) => {
    const ud = m.userData;
    if (ud.near) for (const o of ud.near) o.visible = near;
    if (ud.far) for (const o of ud.far) o.visible = !near;
  };

  function makeVehicle(kind, parked) {
    const model = buildModel(kind), d = model.userData.dims || DIMS[kind], hover = kind === 'hover';
    const [a, b] = SPEED[kind];
    const v = {
      id: ++seq, kind, parked, hover, layer: hover ? 1 : 0, model, position: new THREE.Vector3(), heading: 0, speed: 0,
      len: d.len, wid: d.wid, half: d.len / 2, zc: d.zc, h: d.h, p: IDM[kind], base: a + rng() * (b - a), lat: (rng() - 0.5) * (hover ? 1.2 : kind === 'bus' ? 0.1 : 0.5),
      edge: null, s: 0, next: null, stuck: 0, lod: -1, cx: 0, cz: 0, cx0: 0, cz0: 0, h0: 0, bay: -1, placed: false, inBox: -1, boxI: null, exiting: false, prev: null,
      ox: 0, oz: 0, ovx: 0, ovz: 0, yaw: 0, yawv: 0, ov: false, hitCool: 0,
      box: hover ? null : { minX: 0, maxX: 0, minZ: 0, maxZ: 0, bottom: 0, height: d.h },
    };
    model.visible = false;
    setLod(model, true);
    group.add(model);
    vehicles.push(v);
    if (v.box) obstList.push(v.box);
    return v;
  }

  // Put a vehicle's footprint centre at (x, z) facing h; the model origin sits zc behind it.
  function applyPose(v, x, z, h, y) {
    const sh = Math.sin(h), ch = Math.cos(h);
    v.cx = x; v.cz = z; v.heading = h;
    v.position.set(x - v.zc * sh, y, z - v.zc * ch);
    v.model.position.copy(v.position);
    v.model.rotation.y = h;
    const b = v.box;
    if (b) {
      const hx = Math.abs(sh) * v.half + Math.abs(ch) * v.wid / 2, hz = Math.abs(ch) * v.half + Math.abs(sh) * v.wid / 2;
      b.minX = x - hx; b.maxX = x + hx; b.minZ = z - hz; b.maxZ = z + hz;
    }
  }

  // --- Traffic --------------------------------------------------------------------
  const POSE = { x: 0, z: 0, h: 0 };
  const LG = { gap: Infinity, vl: 0 };
  const ACC = { acc: 0, lead: Infinity, leadV: 0 };

  function detach(v) {
    if (v.edge) {
      listRemove(v.edge.lists[v.layer], v);
      v.edge = null;
    }
    if (v.inBox >= 0) { v.boxI.box[v.inBox]--; v.inBox = -1; v.exiting = false; }
    if (v.bay >= 0) { taken.delete(v.bay); v.bay = -1; }
  }
  function chooseNext(v) {
    const outs = v.edge.out;
    if (!outs.length) return null;
    if (outs.length === 1) return outs[0];
    const w = (c) => (v.hover && c.turn !== 'straight' ? 0.5 : v.kind === 'bus' && c.turn !== 'straight' ? 0.03 : TURN_W[c.turn]);   // a bus's tail swings too far through a corner
    let tot = 0;
    for (const c of outs) tot += w(c);
    let r = rng() * tot;
    for (const c of outs) { r -= w(c); if (r <= 0) return c; }
    return outs[0];
  }

  // The gap to whatever is ahead in this lane or the next two pieces of road. Connectors that
  // leave the same lane end share their first few metres, so vehicles on them see each other.
  const found = (g, vl) => { if (g < LG.gap) { LG.gap = g; LG.vl = vl; } };
  function leader(v) {
    LG.gap = Infinity;
    const e = v.edge, list = e.lists[v.layer], i = list.indexOf(v);
    if (i < list.length - 1) { const o = list[i + 1]; found(o.s - o.half - v.s - v.half, o.speed); }
    else {
      let d = e.len - v.s - v.half, nx = e.kind === 'lane' ? v.next : e.to;
      for (let hop = 0; hop < 2 && nx; hop++) {
        const l2 = nx.lists[v.layer];
        if (l2.length) { const o = l2[0]; found(d + o.s - o.half, o.speed); break; }
        d += nx.len;
        nx = nx.kind === 'conn' ? nx.to : null;
      }
    }
    if (e.kind === 'lane') {
      const d = e.len - v.s - v.half;
      for (const c of e.out) {
        if (c === v.next) continue;
        const l2 = c.lists[v.layer];
        if (l2.length && l2[0].s - l2[0].half < 8) found(d + l2[0].s - l2[0].half, l2[0].speed);
      }
    } else if (v.s < 9) {
      for (const c of e.from.out) {
        if (c === e) continue;
        for (const o of c.lists[v.layer]) if (o.s > v.s && o.s - o.half < 12) found(o.s - o.half - v.s - v.half, o.speed);
      }
    }
  }
  function consider(v, vcap, gap, vl) {
    const a = idmAcc(v.speed, vcap, gap, vl, v.p);
    if (a < ACC.acc) ACC.acc = a;
    if (gap < ACC.lead) { ACC.lead = gap; ACC.leadV = vl; }
  }
  // Brake only when slowing to `vl` by `d` metres out needs more than a comfortable 2.2 m/s^2.
  function slowFor(v, d, vl) {
    const need = (v.speed * v.speed - vl * vl) / (2 * Math.max(d, 0.1));
    if (need > 2.2 && -need < ACC.acc) ACC.acc = -need;
  }
  function mayGo(v, c, dFront) {
    if (c.cwOut && c.cwOut.occ > 0) return false;
    const e = v.edge;
    if (e.cwIn && e.cwIn.occ > 0) return false;
    if (!mayEnter(e.type === 'street' ? 1 : 0, signalU(clock, c.inter.off), dFront, v.speed)) return false;
    const exit = c.to.lists[0];
    return !(exit.length && exit[0].s - exit[0].half < v.len + 2);
  }

  // Vehicle-local longitudinal / lateral position of the player, from the footprint centre.
  function playerLocal(v) {
    const dx = PL.x - v.cx, dz = PL.z - v.cz, sh = Math.sin(v.heading), ch = Math.cos(v.heading);
    LOC.f = -dx * sh - dz * ch; LOC.l = dx * ch - dz * sh; LOC.d = Math.hypot(dx, dz);
    return LOC;
  }
  const LOC = { f: 0, l: 0, d: 0 };

  // Ramming: a fast player shoves a vehicle sideways and spins it a little; the overlay springs back.
  function ram(v, vvx, vvz) {
    const L = playerLocal(v);
    if (L.d > v.len + 4 || v.hitCool > 0) return;
    if (Math.abs(L.f) > v.half + PL.r + 0.9 || Math.abs(L.l) > v.wid / 2 + PL.r + 0.9) return;
    const nx = -(PL.x - v.cx) / (L.d || 1), nz = -(PL.z - v.cz) / (L.d || 1);
    const closing = (PL.vx - vvx) * nx + (PL.vz - vvz) * nz;
    if (closing < 3.5 || PL.speed < 6) return;
    const J = Math.min(closing, 30) * 0.5 * (PL.vehicle ? 1 : 0.2);
    v.ovx += nx * J; v.ovz += nz * J;
    v.yawv += (L.l >= 0 ? 1 : -1) * (L.f >= 0 ? 1 : -1) * Math.min(1.8, J * 0.12);
    v.speed *= 0.35; v.hitCool = 1.2; v.ov = true;
  }
  function relax(v, dt) {
    v.ovx += (-7 * v.ox - 5.5 * v.ovx) * dt; v.ovz += (-7 * v.oz - 5.5 * v.ovz) * dt;
    v.ox += v.ovx * dt; v.oz += v.ovz * dt;
    v.yawv += (-9 * v.yaw - 6 * v.yawv) * dt; v.yaw += v.yawv * dt;
    if (Math.abs(v.ox) + Math.abs(v.oz) + Math.abs(v.ovx) + Math.abs(v.ovz) + Math.abs(v.yaw) + Math.abs(v.yawv) < 0.03) { v.ox = v.oz = v.ovx = v.ovz = v.yaw = v.yawv = 0; v.ov = false; }
  }

  function stepVehicle(v, dt) {
    const e = v.edge, vcap = v.hover ? (e.kind === 'conn' ? Math.min(v.base, e.vmax * 1.6) : v.base) : Math.min(v.base, e.vmax);
    ACC.acc = idmAcc(v.speed, vcap, Infinity, 0, v.p); ACC.lead = Infinity; ACC.leadV = 0;
    leader(v);
    if (LG.gap < Infinity) consider(v, vcap, LG.gap, LG.vl);
    const toEnd = e.len - v.s - v.half;
    let wall = Infinity;
    if (e.kind === 'lane') {
      const c = v.next;
      if (!c) consider(v, vcap, toEnd - 0.8, 0);
      else {
        if (!v.hover) {
          // the other flow still has the box: wait at the lane end however late we noticed
          const blocked = v.inBox < 0 && c.inter.box[e.type === 'street' ? 0 : 1] > 0;
          if (blocked) wall = toEnd - 1.2;
          if (toEnd > 3.1 ? blocked || !mayGo(v, c, toEnd) : blocked) consider(v, vcap, toEnd > 3.1 ? toEnd - 2.2 : toEnd + 1.5, 0);
        }
        if (c.vmax < v.speed + 1) slowFor(v, Math.max(toEnd, 0.5), c.vmax);
      }
    } else if (e.cwOut && e.cwOut.occ > 0 && !v.hover) consider(v, vcap, toEnd - 0.4, 0);
    if (PL.active && PL.low && !v.hover) {
      const L = playerLocal(v);
      if (L.f > 0 && L.f < 5 + v.speed * 1.4 + v.half && Math.abs(L.l) < v.wid / 2 + PL.r + 0.6 + L.f * 0.06) {
        const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
        consider(v, vcap, L.f - v.half - PL.r, Math.max(0, -PL.vx * sh - PL.vz * ch));
      }
      ram(v, -Math.sin(v.heading) * v.speed, -Math.cos(v.heading) * v.speed);
    }
    v.speed = Math.min(Math.max(0, v.speed + ACC.acc * dt), vcap * 1.15 + 0.5);
    let ds = v.speed * dt;
    if (ACC.lead < Infinity) {
      const room = Math.max(0, ACC.lead - 0.35);
      if (ds > room) { ds = room; v.speed = Math.min(v.speed, ACC.leadV); }
    }
    if (ds > Math.max(0, wall - 0.05)) { ds = Math.max(0, wall - 0.05); v.speed = 0; }
    v.s += ds;
    v.stuck = v.speed < 0.3 ? v.stuck + dt : 0;
    if (v.inBox < 0 && !v.hover && v.edge.kind === 'lane' && v.next && v.s + v.half > v.edge.len) { v.inBox = v.edge.type === 'street' ? 1 : 0; v.boxI = v.next.inter; v.boxI.box[v.inBox]++; }
    while (v.s >= v.edge.len) {
      const ed = v.edge;
      if (ed.kind === 'lane') {
        const c = v.next;
        if (!c) { v.s = ed.len; break; }
        v.s -= ed.len; listRemove(ed.lists[v.layer], v); v.edge = c; listInsert(c.lists[v.layer], v);
        v.next = null;
      } else {
        v.s -= ed.len; listRemove(ed.lists[v.layer], v);
        v.edge = ed.to; listInsert(ed.to.lists[v.layer], v); v.next = chooseNext(v); v.exiting = true; v.prev = ed;
      }
    }
    if (v.exiting && v.edge.kind === 'lane' && v.s >= v.half + 3.6) { if (v.inBox >= 0) { v.boxI.box[v.inBox]--; v.inBox = -1; } v.exiting = false; }
    poseMoving(v);
  }
  // The body sits between its axles, each following the road: a long bus swings its tail in
  // through a turn instead of sweeping it out across the next lane.
  const AX = { x: 0, z: 0, h: 0 }, AR = { x: 0, z: 0, h: 0 };
  function pathPoint(v, ds, out) {
    let e = v.edge, s = v.s + ds;
    if (s < 0) { const p = e.kind === 'conn' ? e.from : v.prev; if (p) { e = p; s += p.len; } }
    else if (s > e.len) { const n = e.kind === 'conn' ? e.to : v.next; if (n) { s -= e.len; e = n; } }
    return edgePose(e, s, out);
  }
  function poseMoving(v) {
    const k = v.half * 0.56;
    pathPoint(v, k, AX); pathPoint(v, -k, AR);
    const h = headingOf(AX.x - AR.x, AX.z - AR.z);
    let x = (AX.x + AR.x) / 2 + Math.cos(h) * v.lat, z = (AX.z + AR.z) / 2 - Math.sin(h) * v.lat;
    if (v.ov) { x += v.ox; z += v.oz; }
    applyPose(v, x, z, h + v.yaw, v.hover ? edgeY(v.edge, v.s) : 0);
  }

  // Put a moving vehicle on a lane `minD`..`maxD` from the player, clear of other traffic.
  function placeMoving(v, minD, maxD, avoid) {
    const set = v.kind === 'bus' ? avenueLanes : allLanes;
    for (let tries = 0; tries < 40; tries++) {
      const L = pickLane(set), span = L.len - 2 * v.half - 8;
      if (span <= 0) continue;
      const s = v.half + 4 + rng() * span;   // wholly inside the lane, so never already in a crossing
      edgePose(L, s, POSE);
      const dx = POSE.x - PL.x, dz = POSE.z - PL.z, d = Math.hypot(dx, dz);
      if (d < minD || d > maxD) continue;
      if (avoid && tries < 24 && (PL.fx || PL.fz) && (dx * PL.fx + dz * PL.fz) / d > 0.5) continue;
      const list = L.lists[v.layer];
      if (list.some((o) => o !== v && Math.abs(o.s - s) < (o.half + v.half) + 7)) continue;
      // nor right behind a car leaving a crossing, or right in front of one about to enter it
      if (s < 30 && L.feeders.some((c) => c.lists[v.layer].length)) continue;
      if (s > L.len - 30 && L.out.some((c) => c.lists[v.layer].length)) continue;
      detach(v);
      v.edge = L; v.s = s; v.stuck = 0; v.prev = null; v.ox = v.oz = v.ovx = v.ovz = v.yaw = v.yawv = 0; v.ov = false;
      listInsert(list, v);
      v.next = chooseNext(v);
      leader(v);
      v.speed = Math.min(LG.gap < 40 ? Math.min(LG.vl, v.base * 0.5) : Math.min(v.base, L.vmax) * 0.85, Math.sqrt(6 * Math.max(0, L.len - s - v.half - 6)));   // able to stop at the line
      poseMoving(v);
      v.placed = true; v.model.visible = true; v.lod = -1;
      return true;
    }
    return false;
  }
  // Parked cars gather in runs, like a real kerb: most new ones take a bay next to a car already there.
  function neighbourBay(stride) {
    let k = Math.floor(rng() * parkedCount()), key = -1;
    for (const o of vehicles) if (o.parked && o.bay >= 0 && k-- === 0) { key = o.bay; break; }
    if (key < 0) return -1;
    const i = key % 32, rest = (key - i) / 32, a = Math.floor(rest / 2 / 12);
    const n = i + (rng() < 0.5 ? 1 : -1) * stride;
    return n < 0 || n >= bayWeights[a] ? -1 : key - i + n;
  }
  const parkedCount = () => { let n = 0; for (const o of vehicles) if (o.parked && o.bay >= 0) n++; return n; };
  function placeParked(v, minD, maxD, avoid) {
    for (let tries = 0; tries < 40; tries++) {
      const stride = v.len > 5 ? 2 : 1;
      let key = rng() < 0.75 && tries < 30 ? neighbourBay(stride) : -1;
      if (key < 0) {
        let r = rng() * bayTotal, a = 0;
        while (a < 3 && r >= bayWeights[a]) r -= bayWeights[a++];
        const j = Math.floor(rng() * STREET_ZS.length), side = rng() < 0.5 ? 1 : -1, i = Math.min(bayWeights[a] - 1, Math.floor(r));
        key = ((a * 12 + j) * 2 + (side > 0 ? 1 : 0)) * 32 + i;
      }
      if (taken.has(key) || (stride > 1 && (taken.has(key - 1) || taken.has(key + 1)))) continue;
      const i = key % 32, rest = (key - i) / 32, side = rest % 2 ? 1 : -1, aj = (rest - rest % 2) / 2, j = aj % 12, a = (aj - j) / 12;
      bayAt(a, j, side, i, left, POSE);
      const dx = POSE.x - PL.x, dz = POSE.z - PL.z, d = Math.hypot(dx, dz);
      if (d < minD || d > maxD) continue;
      if (avoid && tries < 24 && (PL.fx || PL.fz) && (dx * PL.fx + dz * PL.fz) / d > 0.5) continue;
      detach(v);
      taken.add(key); v.bay = key; v.speed = 0; v.ox = v.oz = v.ovx = v.ovz = v.yaw = v.yawv = 0; v.ov = false;
      applyPose(v, POSE.x + (rng() - 0.5) * 0.5, POSE.z + side * rng() * 0.12, POSE.h + (rng() - 0.5) * 0.05, 0);
      v.cx0 = v.cx; v.cz0 = v.cz; v.h0 = v.heading;
      v.placed = true; v.model.visible = true; v.lod = -1;
      return true;
    }
    return false;
  }
  const placeVehicle = (v, minD, maxD, avoid) => (v.parked ? placeParked(v, minD, maxD, avoid) : placeMoving(v, minD, maxD, avoid));

  function stepParked(v, dt) {
    if (PL.active && PL.low && PL.speed > 6) {
      const dx = PL.x - v.cx, dz = PL.z - v.cz;
      if (dx * dx + dz * dz < 100) ram(v, 0, 0);
    }
    if (v.hitCool > 0) v.hitCool -= dt;
    if (!v.ov) return;
    relax(v, dt);
    applyPose(v, v.cx0 + v.ox, v.cz0 + v.oz, v.h0 + v.yaw, 0);
  }

  // --- Pedestrians ----------------------------------------------------------------
  const EX = { wave: false, dive: 0 };
  function holdOcc(p, e) {
    if (p.occ) p.occ.occ--;
    p.occ = e && e.kind === 'cross' ? (e.occ++, e) : null;
  }
  // A walker. `res` is the town resident it stands for (null for anonymous ones).
  function newPed(seed, residentId, res) {
    const model = models.makePedestrian({ seed, era, city });
    const p = {
      id: ++seq, residentId, res, position: new THREE.Vector3(), heading: 0, model, state: 'walk', edge: null, dir: 1, s: 0, lat: 0, latT: 0, jit: (rng() - 0.5) * 0.5,
      vWalk: 1.0 + rng() * 0.55, speed: 0, wait: 0, waitFor: null, t: 0, occ: null, lod: -1,
      d0s: 0, d0l: 0, d1s: 0, d1l: 0, faceH: 0, diving: false, waitNode: null,
      embodied: false, seen: false, vanished: false, route: null, leaving: false, entering: false, loiter: false, stayPark: false, statik: false, pacer: false, pacing: false,
      bs: [model.scale.x, model.scale.y, model.scale.z], fx: 1, grow: false, used: 0, gone: null,
    };
    model.visible = false;
    setLod(model, true);
    group.add(model);
    return p;
  }
  function makePed() {
    const p = newPed(1 + Math.floor(rng() * 1e6), null, null);
    p.embodied = true;
    pedestrians.push(p);
    return p;
  }
  const setScale = (p, f) => { p.fx = f; p.model.scale.set(p.bs[0] * f, p.bs[1] * f, p.bs[2] * f); };
  function onEdge(p, e, dir, s) {
    p.edge = e; p.dir = dir; p.s = s;
    p.latT = clamp(0.35 * e.rs * dir + p.jit, e.latMin + 0.15, e.latMax - 0.15);
    holdOcc(p, e);
  }
  function posePed(p) {
    const e = p.edge;
    p.position.set(e.x0 + e.tx * p.s + e.nx * p.lat, walkY(e, p.s), e.z0 + e.tz * p.s + e.nz * p.lat);
    p.model.position.copy(p.position);
    p.model.rotation.y = p.heading;
  }
  function placePed(p, minD, maxD, avoid) {
    for (let tries = 0; tries < 40; tries++) {
      const r = rng() * S.spawnTotal;
      let lo = 0, hi = S.spawn.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (S.spawn[m].c < r) lo = m + 1; else hi = m; }
      const e = S.spawn[lo].e, s = rng() * e.len;
      const x = e.x0 + e.tx * s, z = e.z0 + e.tz * s, dx = x - PL.x, dz = z - PL.z, d = Math.hypot(dx, dz);
      if (d < minD || d > maxD) continue;
      if (avoid && tries < 24 && (PL.fx || PL.fz) && (dx * PL.fx + dz * PL.fz) / d > 0.5) continue;
      p.state = 'walk'; p.diving = false; p.t = 0; p.wait = 0; p.waitFor = null; p.speed = p.vWalk;
      onEdge(p, e, rng() < 0.5 ? 1 : -1, s);
      p.lat = p.latT;
      p.heading = headingOf(e.tx * p.dir, e.tz * p.dir);
      posePed(p);
      p.model.visible = true; p.lod = -1;
      return true;
    }
    return false;
  }
  const DIVE = { s: 0, l: 0, room: 0 };
  // Where a dive to `side` ends up once walls and kerbs have their say. The body lies along the
  // dive for about 1.7 m, so a dive toward a building needs that much sidewalk to land on.
  function diveTo(p, side) {
    const e = p.edge, ddx = -PL.fz * side * 2.6, ddz = PL.fx * side * 2.6, dn = (ddx * e.nx + ddz * e.nz) / 2.6;
    DIVE.s = clamp(p.s + ddx * e.tx + ddz * e.tz, 0.3, Math.max(0.3, e.len - 0.3));
    DIVE.l = clamp(p.lat + dn * 2.6, e.latMin, e.latMax);
    DIVE.room = Math.hypot(DIVE.s - p.s, DIVE.l - p.lat);
    if (e.kind === 'walk' && DIVE.l + 1.7 * dn < -1.45) DIVE.room = 0;
  }
  function startDive(p, l) {
    let side = Math.abs(l) < 0.25 ? (rng() < 0.5 ? 1 : -1) : Math.sign(l);
    diveTo(p, -side);
    const other = DIVE.room;
    diveTo(p, side);
    if (DIVE.room < 1.3 && other > DIVE.room + 0.5) { side = -side; diveTo(p, side); }
    p.d0s = p.s; p.d0l = p.lat; p.d1s = DIVE.s; p.d1l = DIVE.l;
    p.faceH = Math.atan2(-PL.fx * side, -PL.fz * side);   // the model dives toward its local +x
    p.state = 'flee'; p.t = 0; p.waitFor = null; p.speed = 0;
  }
  // At the end of an edge: pick where to go next (not straight back unless it is a dead end).
  function chooseEdge(p, node, from) {
    let tot = 0;
    const w = (e) => (e === from ? 0 : e.kind === 'walk' ? (Math.abs(e.tx * from.tx + e.tz * from.tz) > 0.9 ? 3.2 : 2.2) : e.kind === 'cross' ? 0.8 : e.kind === 'park' ? 2 : p.stayPark ? 0 : 0.7);
    for (const e of node.edges) tot += w(e);
    if (tot <= 0) return from;
    let r = rng() * tot;
    for (const e of node.edges) { r -= w(e); if (r <= 0 && w(e) > 0) return e; }
    return from;
  }
  // A stopped vehicle in the way (a bus with its tail over the zebra) keeps walkers on the kerb.
  function blockedByVehicle(e) {
    for (const v of vehicles) {
      if (!v.placed || v.hover || v.parked || v.speed > 1.5) continue;
      const mx = (e.x0 + e.x1) / 2 - v.cx, mz = (e.z0 + e.z1) / 2 - v.cz;
      if (Math.abs(mx) > v.half + e.len / 2 + 2 || Math.abs(mz) > v.half + e.len / 2 + 2) continue;
      const sh = Math.sin(v.heading), ch = Math.cos(v.heading);
      for (let t = 0; t <= e.len; t += 2) {
        const dx = e.x0 + e.tx * t - v.cx, dz = e.z0 + e.tz * t - v.cz;
        if (Math.abs(-dx * sh - dz * ch) < v.half + 0.8 && Math.abs(dx * ch - dz * sh) < v.wid / 2 + 1.2) return true;
      }
    }
    return false;
  }
  // ...and so do cars that are already committed to crossing, or too close to stop for it.
  function crosswalkBusy(e) {
    for (const c of e.exits) {
      if (c.lists[0].length) return true;
      const l = c.to.lists[0];
      if (l.length && l[0].s - l[0].half < 4.5) return true;
    }
    for (const l of e.feeds) for (const o of l.lists[0]) {
      const toEnd = l.len - o.s - o.half;
      if (toEnd < 3.4 || (toEnd < 16 && o.speed > 2.5)) return true;
    }
    return false;
  }
  const canCross = (e) => mayCross(e.axis, signalU(clock, e.inter.off)) && !crosswalkBusy(e) && !blockedByVehicle(e);
  function setFace(p, h, dt, k = 10) { p.heading = dampAngle(p.heading, h, k, dt); }

  function setDir(p, dir) {
    p.dir = dir;
    p.latT = clamp(0.35 * p.edge.rs * dir + p.jit, p.edge.latMin + 0.15, p.edge.latMax - 0.15);
  }
  // Head for the door at (x, z): the nearest point on the walk graph, with a distance field to steer by.
  // `ref` is the town's door object, so a walker already heading for it is left alone.
  function aimAt(p, x, z, ref = null) {
    if (ref && p.route && p.route.ref === ref) return;
    const a = doorAnchor(S, x, z);
    if (p.route && p.route.anchor === a) { p.route.ref = ref; return; }
    routeField(S, a);
    p.route = { anchor: a, ref };
    if (p.state === 'wait' && p.loiter) { p.loiter = false; p.state = 'walk'; p.wait = 0; }
    if (!p.waitFor && p.state !== 'flee' && p.state !== 'claimed' && p.edge.kind !== 'cross') setDir(p, dirToward(p.edge, p.s, a));
  }
  // Street workers shuffle a few metres along their stretch of sidewalk now and then.
  function pace(p) {
    const e = p.edge, s = clamp(p.s + (rng() - 0.5) * 26, 1.5, e.len - 1.5);
    p.loiter = false; p.state = 'walk'; p.wait = 0;
    p.route = { anchor: { edge: e, s, field: null, key: 'pace' }, ref: null };
    setDir(p, s >= p.s ? 1 : -1);
  }
  function startEnter(p) { p.entering = true; p.loiter = false; p.state = 'walk'; p.speed = 0.9; p.waitFor = null; }
  // Reached the door: go in if the town has sent them indoors, else wait outside it (or wander the lawn).
  function arrivedDoor(p) {
    const e = p.route.anchor.edge;
    if (p.leaving) { startEnter(p); return; }
    if (e.kind === 'park') { p.route = null; p.stayPark = true; return; }
    p.state = 'wait'; p.loiter = true; p.speed = 0;
    if (p.pacer) p.pacing = true;
    p.wait = p.pacer ? 4 + rng() * 9 : 1e9;
    p.faceH = p.res?.act.kind === 'street' ? headingOf(e.nx, e.nz) : headingOf(-e.nx, -e.nz);
  }

  function stepPed(p, dt) {
    let st = p.state;
    if (st === 'ride') return;
    const e = p.edge;
    if (p.grow) { const f = Math.min(1, p.fx + dt * 2.5); setScale(p, f); if (f >= 1) p.grow = false; }
    if (PL.fast && !p.entering && (st === 'walk' || st === 'wait')) {
      const dx = p.position.x - PL.x, dz = p.position.z - PL.z, f = dx * PL.fx + dz * PL.fz;
      if (f > -0.5 && f < 7 + PL.speed * 0.25) {
        const l = -dx * PL.fz + dz * PL.fx;
        if (Math.abs(l) < 3.2 + PL.r) { startDive(p, l); st = 'flee'; }
      }
    }
    if (st === 'flee') {
      p.t += dt;
      const u = Math.min(1, p.t / 0.45), k = 1 - (1 - u) * (1 - u);
      p.s = p.d0s + (p.d1s - p.d0s) * k; p.lat = p.d0l + (p.d1l - p.d0l) * k;
      p.heading = dampAngle(p.heading, p.faceH, 30, dt);
      p.diving = p.t < 1.15;
      if (p.t > 1.8) { p.state = 'walk'; p.diving = false; p.speed = p.vWalk; }
      posePed(p);
      return;
    }
    if (st === 'claimed') {
      setFace(p, p.faceH, dt, 8);
      p.model.rotation.y = p.heading;
      return;
    }
    if (p.entering) {   // in through the door: step into the wall and shrink away
      const f = p.fx - dt / 0.4;
      p.lat += clamp(-1.3 - p.lat, -3 * dt, 3 * dt);
      setFace(p, headingOf(-e.nx, -e.nz), dt, 14);
      if (f <= 0.04) { setScale(p, 0.04); p.vanished = true; } else setScale(p, f);
      posePed(p);
      return;
    }
    if (st === 'wait') {
      p.speed = 0;
      p.wait -= dt;
      const w = p.waitFor;
      if (w) {
        setFace(p, p.faceH, dt);
        if (canCross(w)) { const n = p.waitNode; p.waitFor = null; p.state = 'walk'; onEdge(p, w, w.a === n ? 1 : -1, w.a === n ? 0 : w.len); }
      } else if (p.loiter) { setFace(p, p.faceH, dt); if (p.pacer && p.wait <= 0) pace(p); }
      else if (p.wait <= 0) p.state = 'walk';
      posePed(p);
      return;
    }
    // walking
    p.speed = (e.kind === 'cross' ? p.vWalk * 1.25 : p.vWalk) * (p.leaving ? 1.45 : 1);
    if (!p.res && e.kind === 'walk' && rng() < dt * 0.012) { p.state = 'wait'; p.wait = 2 + rng() * 4; p.speed = 0; posePed(p); return; }
    const rt = p.route;
    if (rt && e === rt.anchor.edge) {   // the door is on this stretch
      const tgt = rt.anchor.s, want = tgt >= p.s ? 1 : -1;
      if (want !== p.dir) setDir(p, want);
      p.s += p.dir * p.speed * dt;
      p.lat += clamp(p.latT - p.lat, -(p.fx < 1 ? 3 : 1.2) * dt, (p.fx < 1 ? 3 : 1.2) * dt);
      setFace(p, headingOf(e.tx * p.dir, e.tz * p.dir), dt);
      if ((p.dir > 0 && p.s >= tgt) || (p.dir < 0 && p.s <= tgt)) { p.s = tgt; arrivedDoor(p); }
      posePed(p);
      return;
    }
    p.s += p.dir * p.speed * dt;
    p.lat += clamp(p.latT - p.lat, -(p.fx < 1 ? 3 : 1.2) * dt, (p.fx < 1 ? 3 : 1.2) * dt);
    setFace(p, headingOf(e.tx * p.dir, e.tz * p.dir), dt);
    if (p.s >= e.len || p.s <= 0) {
      const node = p.dir > 0 ? e.b : e.a;
      p.s = p.dir > 0 ? e.len : 0;
      const nx = rt ? nextToward(node, e, rt.anchor) : chooseEdge(p, node, e);
      if (nx.kind === 'cross' && !canCross(nx)) { p.state = 'wait'; p.waitFor = nx; p.waitNode = node; p.wait = 0; p.speed = 0; p.faceH = headingOf(nx.tx * (nx.a === node ? 1 : -1), nx.tz * (nx.a === node ? 1 : -1)); }
      else onEdge(p, nx, nx.a === node ? 1 : -1, nx.a === node ? 0 : nx.len);
    }
    posePed(p);
  }

  // --- Residents: the town's outdoor people get bodies near the player -----------------------
  const resPeds = new Map(), spare = [], PLP = { x: 0, z: 0 }, NG = {};
  const parkEdges = S.edges.filter((e) => e.kind === 'park');
  const cap = Math.round(comp.peds * density), minCrowd = Math.round(MIN_CROWD * density), staticCap = Math.round(cap * 0.4);   // standing workers never crowd out walkers
  let trackT = 0, evictT = 0;
  function disembody(p, why = 'range') {
    p.gone = why;
    const i = pedestrians.indexOf(p);
    if (i >= 0) pedestrians.splice(i, 1);
    holdOcc(p, null);
    p.embodied = false; p.vanished = false; p.entering = false; p.leaving = false; p.loiter = false; p.route = null; p.diving = false;
    p.model.visible = false; p.lod = -1; p.used = clock;
    setScale(p, 1); p.grow = false;
    if (!p.res) spare.push(p);
  }
  function embody(p, edge, s, emerge, soft) {
    p.embodied = true; p.vanished = false; p.state = 'walk'; p.entering = false; p.leaving = false; p.loiter = false; p.stayPark = false;
    p.diving = false; p.waitFor = null; p.t = 0; p.wait = 0; p.route = null; p.speed = p.vWalk;
    onEdge(p, edge, 1, s);
    p.lat = emerge ? -1.3 : p.latT;
    p.heading = headingOf(edge.tx, edge.tz);
    setScale(p, soft ? 0.05 : 1); p.grow = soft;
    posePed(p);
    p.model.visible = true; p.lod = -1;
    pedestrians.push(p);
  }
  // The resident is outdoors per the town: keep their walker pointed at the right door.
  function retarget(p, o) {
    if (p.state === 'claimed' || p.state === 'ride') return;
    if (p.entering) { p.entering = false; p.grow = true; }
    p.leaving = false;
    p.statik = o.kind !== 'walk'; p.pacer = o.kind === 'street';
    if (!p.pacer) p.pacing = false;
    if (o.kind === 'park') {
      p.stayPark = true;
      if (p.edge.kind === 'park') { p.route = null; if (p.loiter) { p.loiter = false; p.state = 'walk'; } } else aimAt(p, o.x, o.z, o.to);
    } else { p.stayPark = false; if (!p.pacing) aimAt(p, o.to.x, o.to.z, o.to); }
  }
  // The resident is no longer in the town's outdoor list: gone in, hailed, or just out of range.
  function afterOutdoors(p) {
    if (p.state === 'claimed' || p.state === 'ride') return;
    const dx = p.position.x - PL.x, dz = p.position.z - PL.z, w = town.where(p.res);
    if (dx * dx + dz * dz > TOWN_FAR * TOWN_FAR || w.riding) { disembody(p, w.riding ? 'ride' : 'range'); return; }
    if (w.outdoors) { p.leaving = false; if (p.res.act.kind === 'walk') aimAt(p, w.to.x, w.to.z, w.to); return; }
    p.leaving = true; p.pacing = false;
    aimAt(p, w.x, w.z, w.from);
    if (p.loiter && p.route.anchor.edge === p.edge) startEnter(p);
  }
  // Where a newly outdoor resident's body appears: at the door they came out of, or on the sidewalk nearest the town's estimate.
  function spotFor(o, force) {
    if (o.kind === 'park') {
      const e = parkEdges[Math.floor(rng() * parkEdges.length)];
      NG.edge = e; NG.s = rng() * e.len; NG.emerge = false;
    } else if (o.kind === 'street' || o.progress < 0.25) {
      const a = doorAnchor(S, o.from.x, o.from.z);
      NG.edge = a.edge; NG.s = a.s; NG.emerge = o.kind === 'walk' && !force;
    } else {
      if (!force && Math.hypot(o.x - PL.x, o.z - PL.z) < 70) return null;   // mid-walk near the player: let them stay unseen rather than pop in
      nearestOnGraph(S, o.x, o.z, NG, false);
      NG.emerge = false;
    }
    NG.x = NG.edge.x0 + NG.edge.tx * NG.s; NG.z = NG.edge.z0 + NG.edge.tz * NG.s;
    return NG;
  }
  function trackTown(dt, force) {
    trackT -= dt;
    if (!force && trackT > 0) return;
    trackT = TRACK_EVERY;
    PLP.x = PL.x; PLP.z = PL.z;
    const list = town.outdoors(PLP, TOWN_NEAR);   // bodies only where they could be seen soon: a little beyond where walkers become visible
    list.sort((a, b) => (a.x - PL.x) ** 2 + (a.z - PL.z) ** 2 - (b.x - PL.x) ** 2 - (b.z - PL.z) ** 2);
    const seeable = HIDE_PED * HIDE_PED;
    let creates = force ? 1e9 : 1, resNear = 0, resFar = 0, statics = 0;
    for (const p of resPeds.values()) {
      p.seen = false;
      if (!p.embodied) continue;
      if ((p.position.x - PL.x) ** 2 + (p.position.z - PL.z) ** 2 < seeable) resNear++; else resFar++;
      if (p.statik && !p.leaving) statics++;
    }
    for (const o of list) {
      const id = o.resident.id;
      let p = resPeds.get(id);
      if (p && p.embodied) { p.seen = true; retarget(p, o); continue; }
      const stat = o.kind !== 'walk';
      if (stat && statics >= staticCap) continue;
      const spot = spotFor(o, force);
      if (!spot) continue;
      const seen = (spot.x - PL.x) ** 2 + (spot.z - PL.z) ** 2 < seeable;   // the cap is for bodies you can see
      if (seen ? resNear >= cap : resFar >= cap) continue;
      if (!p) { if (creates <= 0) continue; creates--; p = newPed(o.resident.look.seed, id, o.resident); resPeds.set(id, p); }
      embody(p, spot.edge, spot.s, spot.emerge, !force);
      p.seen = true; if (seen) resNear++; else resFar++; if (stat) statics++;
      retarget(p, o);
      if (p.route) p.heading = headingOf(p.edge.tx * p.dir, p.edge.tz * p.dir);
    }
    for (const p of resPeds.values()) if (p.embodied && !p.seen) afterOutdoors(p);
    // anonymous visitors top the street up to a minimum crowd, and step aside as residents arrive
    let have = 0;
    for (const p of pedestrians) if (!p.res) have++;
    const want = Math.max(0, Math.min(cap - resNear, minCrowd - resNear));
    for (let n = force ? 1e9 : 2; have < want && n > 0; n--) {
      let v = spare.pop();
      if (!v) { if (creates <= 0) break; creates--; v = newPed(1 + Math.floor(rng() * 1e6), null, null); }
      if (!placePed(v, force ? 6 : VISITOR_RING[0], VISITOR_RING[1], !force)) { spare.push(v); break; }
      v.embodied = true; pedestrians.push(v); have++;
    }
    for (let n = 2; have > want && n > 0; n--) {
      let far = null, fd = -1;
      for (const p of pedestrians) if (!p.res && p.state !== 'claimed' && p.state !== 'ride') { const d = (p.position.x - PL.x) ** 2 + (p.position.z - PL.z) ** 2; if (d > fd) { fd = d; far = p; } }
      if (!far) break;
      disembody(far); have--;
    }
    evictT -= TRACK_EVERY;
    if (evictT <= 0) { evictT = 2; evictModels(); }
  }
  // Models are cached per resident while they are likely to come back, then let go.
  function dropModel(p) { group.remove(p.model); models.disposeModel(p.model); }
  function evictModels() {
    for (const [id, p] of resPeds) if (!p.embodied && clock - p.used > 60) { dropModel(p); resPeds.delete(id); }
    if (resPeds.size > MODEL_CACHE) {
      const old = [...resPeds].filter(([, p]) => !p.embodied).sort((a, b) => a[1].used - b[1].used);
      for (const [id, p] of old) { if (resPeds.size <= MODEL_CACHE) break; dropModel(p); resPeds.delete(id); }
    }
    while (spare.length > 30) dropModel(spare.shift());
  }

  // --- Placement, recycling, level of detail ---------------------------------------
  function seedAll() {
    for (const v of vehicles) placeVehicle(v, 14, RANGE, false);
    if (town) {
      for (const p of [...pedestrians]) if (p.state !== 'claimed' && p.state !== 'ride') disembody(p);
      trackTown(0, true);
    } else for (const p of pedestrians) placePed(p, 3, RANGE, false);
  }
  function lodPass() {
    for (const v of vehicles) {
      const dx = v.position.x - PL.x, dz = v.position.z - PL.z, d2 = dx * dx + dz * dz, near = v.hover ? DETAIL : NEAR;
      const lvl = d2 < near * near ? 2 : d2 < HIDE * HIDE ? 1 : 0;
      if (lvl !== v.lod) { v.lod = lvl; v.model.visible = lvl > 0 && v.placed; setLod(v.model, lvl === 2); }
    }
    for (const p of pedestrians) {
      if (p.state === 'ride' || !p.edge) continue;
      const dx = p.position.x - PL.x, dz = p.position.z - PL.z, d2 = dx * dx + dz * dz;
      const lvl = d2 < NEAR * NEAR * 0.7 ? 2 : d2 < HIDE_PED * HIDE_PED ? 1 : 0;
      if (lvl !== p.lod) { p.lod = lvl; p.model.visible = lvl > 0; setLod(p.model, lvl === 2); }
    }
  }

  function update(dt, player) {
    dt = Math.min(dt, 0.1);
    clock += dt;
    readPlayer(player);
    if (PL.active) {
      if (!seeded || (last && Math.hypot(PL.x - last.x, PL.z - last.z) > 90)) { seedAll(); seeded = true; }
      last = last || { x: 0, z: 0 }; last.x = PL.x; last.z = PL.z;
    } else if (!seeded) { seedAll(); seeded = true; }
    let vs = 0, ps = 0;
    for (const v of vehicles) {
      if (!v.placed) { if (PL.active && vs < MAX_VEHICLE_SPAWNS && placeVehicle(v, RING_MIN, RANGE, true)) vs++; continue; }
      if (v.parked) stepParked(v, dt);
      else {
        if (v.hitCool > 0) v.hitCool -= dt;
        if (v.ov) relax(v, dt);
        if (v.edge) stepVehicle(v, dt);
      }
      if (PL.active && vs < MAX_VEHICLE_SPAWNS) {
        const dx = v.position.x - PL.x, dz = v.position.z - PL.z, d2 = dx * dx + dz * dz;
        const far = d2 > RANGE * RANGE, jam = !v.parked && ((v.stuck > 20 && d2 > 90 * 90) || (v.stuck > 45 && d2 > 40 * 40));
        if (far || jam) { if (placeVehicle(v, RING_MIN, RANGE, true)) vs++; }
      }
    }
    if (town && PL.active) trackTown(dt, false);
    for (const p of pedestrians) {
      stepPed(p, dt);
      if (PL.active && ps < MAX_PED_SPAWNS && p.state !== 'ride' && !p.res) {
        const dx = p.position.x - PL.x, dz = p.position.z - PL.z, d2 = dx * dx + dz * dz, out = town ? VISITOR_FAR : RANGE, lost = p.state === 'claimed' && d2 > (out + 80) * (out + 80);
        if ((lost || (d2 > out * out && p.state !== 'claimed')) && (town ? placePed(p, VISITOR_RING[0], VISITOR_RING[1], true) : placePed(p, RING_MIN, RANGE, true))) ps++;
      }
    }
    if (town) for (let i = pedestrians.length - 1; i >= 0; i--) { const q = pedestrians[i]; if (q.vanished) disembody(q, 'door'); else if (q.leaving && q.lod === 0 && q.state === 'walk') disembody(q, 'unseen'); }   // nobody watches a resident walk home from afar
    // animate what can be seen; far pieces stay still
    for (const v of vehicles) if (v.lod === 2 && !v.parked) v.model.userData.animate?.(clock, v.speed);
    for (const p of pedestrians) {
      if (p.lod !== 2 || p.state === 'ride') continue;
      EX.wave = p.state === 'claimed'; EX.dive = p.diving ? 1 : 0;
      p.model.userData.animate(clock, p.state === 'walk' ? p.speed : 0, EX);
    }
    lodPass();
  }

  // --- Contract ---------------------------------------------------------------------
  const obstacles = () => obstList;
  function nearestVehicle(pos, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const v of vehicles) {
      if (v.hover) continue;
      const dx = v.position.x - pos.x, dz = v.position.z - pos.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  function take(v) {
    const i = vehicles.indexOf(v);
    if (i < 0) return v.model;
    detach(v);
    vehicles.splice(i, 1);
    if (v.box) listRemove(obstList, v.box);
    group.remove(v.model);
    v.model.visible = true; setLod(v.model, true);
    makeVehicle(v.kind, v.parked);
    return v.model;
  }
  function claim(p) {
    if (p.state === 'ride') return;
    const e = p.edge;
    holdOcc(p, null);
    p.state = 'claimed'; p.speed = 0; p.diving = false; p.waitFor = null; p.entering = false; p.loiter = false; p.route = null;
    if (p.fx !== 1) { setScale(p, 1); p.grow = false; }
    p.faceH = e.kind === 'walk' ? headingOf(e.nx, e.nz) : p.heading;
  }
  function board(p) {
    holdOcc(p, null);
    p.state = 'ride'; p.model.visible = false; p.diving = false;
  }
  const NEAR_OUT = {};
  // A resident let out at `at` walks from there; the town's next tick says where they are really going.
  function release(p, at) {
    const hit = nearestWalk(S, at.x, at.z, NEAR_OUT);
    p.state = 'walk'; p.diving = false; p.waitFor = null; p.t = 0; p.speed = p.vWalk;
    p.route = null; p.leaving = false; p.entering = false; p.loiter = false; p.stayPark = false; p.vanished = false;
    if (p.fx !== 1) setScale(p, 1);
    p.grow = false;
    if (!pedestrians.includes(p)) { pedestrians.push(p); p.embodied = true; }
    onEdge(p, hit.edge, rng() < 0.5 ? 1 : -1, hit.s);
    p.lat = p.latT;
    p.heading = headingOf(hit.edge.tx * p.dir, hit.edge.tz * p.dir);
    posePed(p);
    p.model.visible = true; p.lod = -1;
    trackT = 0;
  }
  // A walker on a sidewalk in the band, residents before strangers.
  function pickFare(near, minDist, maxDist) {
    let pick = null, n = 0, rank = -1;
    for (const p of pedestrians) {
      if (p.state !== 'walk' || p.edge.kind !== 'walk' || p.entering) continue;
      const d = Math.hypot(p.position.x - near.x, p.position.z - near.z);
      if (d < minDist || d > maxDist) continue;
      const r = p.res ? 1 : 0;
      if (r < rank) continue;
      if (r > rank) { rank = r; n = 0; }
      if (rng() * ++n < 1) pick = p;
    }
    return pick;
  }
  const pedFor = (residentId) => { const p = resPeds.get(residentId); return p && p.embodied ? p : null; };
  function nearestPed(pos, maxDist, { residentsOnly = true } = {}) {
    let best = null, bd = maxDist * maxDist;
    for (const p of pedestrians) {
      if (p.state === 'ride' || (residentsOnly && !p.res)) continue;
      const dx = p.position.x - pos.x, dz = p.position.z - pos.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function dispose() {
    for (const v of vehicles) { detach(v); group.remove(v.model); models.disposeModel(v.model); }
    const bodies = new Set([...pedestrians, ...resPeds.values(), ...spare]);
    for (const p of bodies) { holdOcc(p, null); group.remove(p.model); models.disposeModel(p.model); }
    resPeds.clear(); spare.length = 0;
    vehicles.length = pedestrians.length = obstList.length = 0;
    group.parent?.remove(group);
  }

  for (const [kind, n] of comp.moving) for (let i = 0; i < Math.round(n * density); i++) makeVehicle(kind, false);
  for (const [kind, n] of comp.parked) for (let i = 0; i < Math.round(n * density); i++) makeVehicle(kind, true);
  if (!town) for (let i = 0; i < Math.round(comp.peds * density); i++) makePed();

  const life = { group, update, vehicles, pedestrians, obstacles, nearestVehicle, take, claim, board, release, pickFare, pedFor, nearestPed, dispose };
  internals.set(life, { graph: G, walk: S, town, resPeds, spare, cap, minCrowd, clock: () => clock, ranges: { RANGE, RING_MIN, NEAR, DETAIL, HIDE, HIDE_PED }, AVENUE_HALF, STREET_HALF, AVENUE_XS });
  return life;
}
