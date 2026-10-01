import { BLOCK, BUILDABLE, LANDMARKS } from '../world/city/bible.js';
import { AVENUE_XS, STREET_ZS } from '../world/city/districts.js';
import { blocks } from '../world/city/blocks.js';

// Pure geometry and rules for the street-life layer (no three.js, runs under node):
//   buildGraph()   one-way avenue lanes, two-way street lanes, the connectors that turn between
//                  them, and the sidewalk/crosswalk graph pedestrians walk
//   idmAcc()       car-following (intelligent driver model)
//   signal helpers a fixed two-phase cycle per intersection that vehicles and walkers share
// Metres, +x east, -z north. A heading h faces (-sin h, -cos h), like every model.
export const AVENUE_HALF = (BLOCK.avenuePitch - BUILDABLE.x - 2 * BLOCK.sidewalk) / 2;   // 12
export const STREET_HALF = (BLOCK.streetPitch - BUILDABLE.z - 2 * BLOCK.sidewalk) / 2;   // 6
export const AVENUE_LANES = [-8, 0, 8];       // x offsets, as street.js paints them
export const STREET_LANE = 2;                 // lane centre from the street's centreline
export const KERB_BAY = 4.85;                  // parked-car centre from the centreline
export const WALK = 1.2;                      // walk line outside a block: puts ring corners on the zebra crossings
export const SHORE_WEST = -262;
export const BAY_PITCH = 5.8;

const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' }, LEFT = { N: 'W', W: 'S', S: 'E', E: 'N' }, BACK = { N: 'S', S: 'N', E: 'W', W: 'E' };
const mod = (a, n) => ((a % n) + n) % n;
const smooth = (u) => u * u * (3 - 2 * u);
const headingOf = (dx, dz) => Math.atan2(-dx, -dz);

// --- Signals ------------------------------------------------------------------
// avenue green, clearance, street green, clearance. Walkers cross the road whose cars are stopped.
export const CYCLE = 37, AVENUE_GREEN = [0, 19], STREET_GREEN = [21, 34.5];
export const signalU = (t, off) => mod(t + off, CYCLE);

// May a vehicle on `group` (0 avenue, 1 street) pass the stop line, dFront metres away at `speed`?
// During the two seconds after its green ends it still goes if it cannot stop at 3.5 m/s^2.
export function mayEnter(group, u, dFront, speed) {
  const [a, b] = group ? STREET_GREEN : AVENUE_GREEN;
  if (u >= a && u < b) return true;
  const since = u - b;
  return since >= 0 && since < 2 && speed * speed > 7 * Math.max(dFront, 0.1);
}
export const mayCross = (axis, u) => (axis === 'avenue' ? u >= STREET_GREEN[0] && u < 28 : u < 13);

// --- Car following ------------------------------------------------------------
//   a comfortable acceleration, b comfortable braking, T time headway, s0 standstill gap
export function idmAcc(v, v0, gap, vLead, { a, b, T, s0 }) {
  const free = 1 - (v / Math.max(v0, 0.1)) ** 4;
  if (!(gap < Infinity)) return a * free;
  const sStar = s0 + Math.max(0, v * T + (v * (v - vLead)) / (2 * Math.sqrt(a * b)));
  return Math.max(-9, a * (free - (sStar / Math.max(gap, 0.05)) ** 2));
}

// --- Lanes --------------------------------------------------------------------
function laneRecord(o) {
  const dx = Math.sign(o.x1 - o.x0), dz = Math.sign(o.z1 - o.z0);
  return { kind: 'lane', dx, dz, len: Math.hypot(o.x1 - o.x0, o.z1 - o.z0), h: headingOf(dx, dz), out: [], lists: [[], []], y0: o.y, y1: o.y, cwIn: null, ...o };
}

const LUT = 12;
function connRecord(I, L, O, turn) {
  const c = { kind: 'conn', turn, inter: I, from: L, to: O, x0: L.x1, z0: L.z1, x1: O.x0, z1: O.z0, lists: [[], []], y0: L.y1, y1: O.y0, cwOut: null };
  if (turn === 'straight') {
    c.len = Math.hypot(c.x1 - c.x0, c.z1 - c.z0);
    c.dx = (c.x1 - c.x0) / c.len; c.dz = (c.z1 - c.z0) / c.len; c.h = headingOf(c.dx, c.dz);
    c.vmax = L.type === 'avenue' ? 14 : 10;
    return c;
  }
  // the control point sits where the two lane lines cross
  c.cx = L.dx !== 0 ? O.x0 : L.x1;
  c.cz = L.dx !== 0 ? L.z1 : O.z0;
  const lut = new Float32Array(LUT + 1);
  let px = c.x0, pz = c.z0;
  for (let i = 1; i <= LUT; i++) {
    const u = i / LUT, m = 1 - u;
    const x = m * m * c.x0 + 2 * m * u * c.cx + u * u * c.x1, z = m * m * c.z0 + 2 * m * u * c.cz + u * u * c.z1;
    lut[i] = lut[i - 1] + Math.hypot(x - px, z - pz); px = x; pz = z;
  }
  c.lut = lut; c.len = lut[LUT];
  c.vmax = turn === 'left' ? 5.6 : 4.8;
  return c;
}

// Position and heading `s` metres along a lane or connector. Writes into `out`.
export function edgePose(e, s, out) {
  if (!e.lut) { out.x = e.x0 + e.dx * s; out.z = e.z0 + e.dz * s; out.h = e.h; return out; }
  const lut = e.lut;
  let i = 1;
  while (i < LUT && lut[i] < s) i++;
  const u = (i - 1 + Math.min(1, Math.max(0, (s - lut[i - 1]) / (lut[i] - lut[i - 1] || 1)))) / LUT, m = 1 - u;
  out.x = m * m * e.x0 + 2 * m * u * e.cx + u * u * e.x1;
  out.z = m * m * e.z0 + 2 * m * u * e.cz + u * u * e.z1;
  out.h = headingOf(2 * m * (e.cx - e.x0) + 2 * u * (e.x1 - e.cx), 2 * m * (e.cz - e.z0) + 2 * u * (e.z1 - e.cz));
  return out;
}
// Hover altitude along an edge (lanes are level; connectors ease between their two lanes).
export const edgeY = (e, s) => (e.y0 === e.y1 ? e.y0 : e.y0 + (e.y1 - e.y0) * smooth(Math.min(1, Math.max(0, s / e.len))));

function buildLanes(inters, left) {
  const lanes = [], conns = [];
  const avs = AVENUE_XS.map((x, k) => ({ x, k, north: k % 2 === 1, land: x - AVENUE_HALF > SHORE_WEST }));
  // Avenues: one way, direction alternating, three lanes, between consecutive streets.
  for (const a of avs) if (a.land) for (let j = 0; j < STREET_ZS.length - 1; j++) {
    const zs = STREET_ZS[j], zn = STREET_ZS[j + 1];
    for (let l = 0; l < 3; l++) {
      const x = a.x + (a.north ? AVENUE_LANES[l] : -AVENUE_LANES[l]);
      const lane = laneRecord({
        type: 'avenue', dir: a.north ? 'N' : 'S', k: a.k, j, l, x0: x, x1: x,
        z0: a.north ? zs - STREET_HALF : zn + STREET_HALF, z1: a.north ? zn + STREET_HALF : zs - STREET_HALF, vmax: 13.5, y: 13.2 + l * 0.6,
      });
      lane.from = inters[a.k][a.north ? j : j + 1]; lane.to = inters[a.k][a.north ? j + 1 : j];
      lanes.push(lane); lane.from.out.push(lane); lane.to.in.push(lane);
    }
  }
  // Streets: two ways, one lane each. Where an avenue is water the street just runs out at the shore.
  for (let j = 0; j < STREET_ZS.length; j++) for (let i = 0; i < avs.length - 1; i++) {
    const A = avs[i], B = avs[i + 1];
    for (const dir of ['E', 'W']) {
      const east = dir === 'E';
      const xa = Math.max(A.x + AVENUE_HALF, A.land ? -Infinity : -250), xb = B.x - AVENUE_HALF;
      const lane = laneRecord({
        type: 'street', dir, k: A.k, j, l: east ? 0 : 1, x0: east ? xa : xb, x1: east ? xb : xa,
        z0: STREET_ZS[j] + (east ? 1 : -1) * (left ? -1 : 1) * STREET_LANE, z1: STREET_ZS[j] + (east ? 1 : -1) * (left ? -1 : 1) * STREET_LANE, vmax: 10, y: 16.6 + (east ? 0 : 0.6),
      });
      lane.from = inters[east ? A.k : B.k][j]; lane.to = inters[east ? B.k : A.k][j];
      lanes.push(lane); lane.from.out.push(lane); lane.to.in.push(lane);
    }
  }
  // Connectors: avenue left lane may turn left, right lane right; streets go straight or turn the near-side way.
  for (const row of inters) for (const I of row) for (const L of I.in) {
    const want = [];
    const straight = I.out.find((o) => o.type === L.type && o.dir === L.dir && (L.type === 'street' || o.l === L.l));
    if (straight) want.push(['straight', straight]);
    if (L.type === 'avenue') {
      const lt = L.l === 0 && I.out.find((o) => o.type === 'street' && o.dir === LEFT[L.dir]);
      const rt = L.l === 2 && I.out.find((o) => o.type === 'street' && o.dir === RIGHT[L.dir]);
      if (lt) want.push(['left', lt]);
      if (rt) want.push(['right', rt]);
    } else {
      // streets turn only the near-side way (right where cars keep right, left where they keep left), so no turn crosses oncoming traffic
      const rt = I.out.find((o) => o.type === 'avenue' && o.dir === (left ? LEFT : RIGHT)[L.dir] && o.l === (left ? 0 : 2));
      if (rt) want.push([left ? 'left' : 'right', rt]);
    }
    for (const [turn, O] of want) { const c = connRecord(I, L, O, turn); L.out.push(c); conns.push(c); }
  }
  // Green waves: lights stagger by the time a car takes to drive one block.
  for (const row of inters) for (const I of row) I.off = mod((I.k % 2 === 1 ? -I.j : I.j) * 6.7 + I.k * 9, CYCLE);
  return { lanes, conns };
}

// --- Sidewalks ----------------------------------------------------------------
// Each block gets a walk line WALK metres outside its buildable edge; its four corners are the
// ends of the zebra crossings, so crossings are just edges between neighbouring blocks' corners.
// Edge kinds: walk (sidewalk, y .18), cross (road), park (lawn .36), gate (kerb up to the lawn).
function buildSidewalks(inters) {
  const nodes = [], edges = [], ring = new Map();
  const node = (x, z) => { const n = { id: nodes.length, x, z, edges: [] }; nodes.push(n); return n; };
  const link = (a, b, kind, extra = {}) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z), tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
    const e = { id: edges.length, a, b, x0: a.x, z0: a.z, x1: b.x, z1: b.z, len, tx, tz, nx: -tz, nz: tx, rs: 1, latMin: -1.1, latMax: 1.1, kind, occ: 0, cost: len + (kind === 'cross' ? 20 : 0), ...extra };
    edges.push(e); a.edges.push(e); b.edges.push(e);
    return e;
  };
  const grid = blocks(), byId = new Map(grid.map((b) => [`${b.col},${b.row}`, b]));
  const tower = LANDMARKS.find((l) => l.kind === 'bridgeTower');
  const corner = (b, name) => {
    const key = `${b.col},${b.row},${name}`;
    if (!ring.has(key)) ring.set(key, node(name[1] === 'W' ? b.minX - WALK : b.maxX + WALK, name[0] === 'N' ? b.minZ - WALK : b.maxZ + WALK));
    return ring.get(key);
  };
  const SIDES = [['N', 'NW', 'NE', 0, -1], ['S', 'SW', 'SE', 0, 1], ['W', 'NW', 'SW', -1, 0], ['E', 'NE', 'SE', 1, 0]];
  for (const b of grid) {
    const park = b.district === 'park';
    for (const [side, c0, c1, ox, oz] of SIDES) {
      if (side === 'W' && tower && b.col === 0 && Math.abs(tower.at[1] - b.cz) < BUILDABLE.z / 2 + 2) continue;   // the bridge tower stands on this sidewalk
      const chain = [corner(b, c0)];
      let gate = null;
      if (park && side !== 'W') { gate = node(side === 'E' ? b.maxX + WALK : b.cx, side === 'N' ? b.minZ - WALK : side === 'S' ? b.maxZ + WALK : b.cz); chain.push(gate); }
      chain.push(corner(b, c1));
      for (let i = 0; i < chain.length - 1; i++) {
        const e = link(chain[i], chain[i + 1], 'walk', { block: b.id, side, ox, oz, latMin: -0.7, latMax: 1.25 });
        e.nx = ox; e.nz = oz; e.rs = Math.sign(-e.tz * ox + e.tx * oz) || 1;
      }
      if (gate) b.gates = Object.assign(b.gates || {}, { [side]: gate });
    }
    if (!park) continue;
    // The lawn: a walk ringed inside the trees, a cross path, and gates up from the kerb.
    const I = 3, x0 = b.minX + I, x1 = b.maxX - I, z0 = b.minZ + I, z1 = b.maxZ - I;
    const P = { nw: node(x0, z0), ne: node(x1, z0), se: node(x1, z1), sw: node(x0, z1), n: node(b.cx, z0), s: node(b.cx, z1), e: node(x1, b.cz), c: node(b.cx, b.cz) };
    const lawn = (a, c) => link(a, c, 'park', { block: b.id, latMin: -1, latMax: 1 });
    for (const [a, c] of [['nw', 'n'], ['n', 'ne'], ['ne', 'e'], ['e', 'se'], ['se', 's'], ['s', 'sw'], ['sw', 'nw'], ['n', 'c'], ['c', 's'], ['c', 'e']]) lawn(P[a], P[c]);
    for (const [side, to] of [['N', 'n'], ['S', 's'], ['E', 'e']]) if (b.gates?.[side]) link(b.gates[side], P[to], 'gate', { block: b.id, latMin: -0.4, latMax: 0.4 });
  }
  // Crossings: the four corners of every intersection, joined across the road.
  const q = (c, r, name) => (byId.has(`${c},${r}`) ? ring.get(`${c},${r},${name}`) : null);
  for (const row of inters) for (const I of row) {
    if (I.x - AVENUE_HALF <= SHORE_WEST) continue;
    const { k, j } = I;
    const NE = q(k, j, 'SW'), NW = q(k - 1, j, 'SE'), SE = q(k, j - 1, 'NW'), SW = q(k - 1, j - 1, 'NE');
    for (const [side, a, b, axis] of [['N', NW, NE, 'avenue'], ['S', SW, SE, 'avenue'], ['W', NW, SW, 'street'], ['E', NE, SE, 'street']]) {
      if (a && b) I.cw[side] = link(a, b, 'cross', { axis, inter: I, side, latMin: -1.3, latMax: 1.3 });
    }
  }
  const spawn = [];
  let total = 0;
  for (const e of edges) if (e.kind === 'walk' || e.kind === 'park') { total += e.len; spawn.push({ e, c: total }); }
  return { nodes, edges, spawn, spawnTotal: total };
}

// Height of the walking surface at `s` along a sidewalk-graph edge.
export function walkY(e, s) {
  if (e.kind === 'cross') return 0.18 * Math.max(0, 1 - Math.min(s, e.len - s) / 0.9);
  if (e.kind === 'park') return 0.36;
  if (e.kind === 'gate') return 0.18 + 0.18 * (s / e.len);
  return 0.18;
}

// The closest point on any sidewalk (and, with `park`, any lawn path) to (x, z). Reuses `out`.
export function nearestOnGraph(sw, x, z, out = {}, park = false) {
  let best = Infinity;
  for (const e of sw.edges) {
    if (e.kind !== 'walk' && !(park && e.kind === 'park')) continue;
    const s = Math.min(e.len, Math.max(0, (x - e.x0) * e.tx + (z - e.z0) * e.tz));
    const d = Math.hypot(x - e.x0 - e.tx * s, z - e.z0 - e.tz * s);
    if (d < best) { best = d; out.edge = e; out.s = s; out.dist = d; }
  }
  return out;
}
export const nearestWalk = (sw, x, z, out = {}) => nearestOnGraph(sw, x, z, out, false);

// Routing: a door is an anchor on the walk graph; every node learns its walking distance to it
// (Dijkstra, crossings cost extra for the wait), and a walker simply steps to the neighbour that
// is closest to the door. Anchors and fields are cached on the graph.
export function doorAnchor(sw, x, z) {
  const key = `${Math.round(x * 10)},${Math.round(z * 10)}`, cache = sw.anchors || (sw.anchors = new Map());
  let a = cache.get(key);
  if (!a) { const h = nearestOnGraph(sw, x, z, {}, true); a = { key, edge: h.edge, s: h.s, field: null }; cache.set(key, a); }
  return a;
}
export function routeField(sw, a) {
  if (a.field) return a.field;
  const n = sw.nodes.length, d = new Float64Array(n).fill(Infinity), done = new Uint8Array(n);
  d[a.edge.a.id] = a.s; d[a.edge.b.id] = Math.min(d[a.edge.b.id], a.edge.len - a.s);
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && d[i] < best) { best = d[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    for (const e of sw.nodes[u].edges) { const v = (e.a.id === u ? e.b : e.a).id; if (d[u] + e.cost < d[v]) d[v] = d[u] + e.cost; }
  }
  return (a.field = d);
}
// At `node`, having come along `from`: the edge that leads to the door (the door's own edge if it is here).
export function nextToward(node, from, a) {
  let best = null, bc = Infinity;
  for (const e of node.edges) {
    if (e === a.edge) return e;
    if (e === from) continue;
    const c = e.cost + a.field[(e.a === node ? e.b : e.a).id];
    if (c < bc) { bc = c; best = e; }
  }
  return best || from;
}
// Which way along edge `e`, from `s`, is shorter to the door.
export function dirToward(e, s, a) {
  if (e === a.edge) return a.s >= s ? 1 : -1;
  return (e.len - s) + a.field[e.b.id] <= s + a.field[e.a.id] ? 1 : -1;
}

export function buildGraph({ left = false } = {}) {
  const inters = AVENUE_XS.map((x, k) => STREET_ZS.map((z, j) => ({ k, j, x, z, in: [], out: [], cw: {}, box: [0, 0], off: 0 })));
  const { lanes, conns } = buildLanes(inters, left);
  const walk = buildSidewalks(inters);
  // A car meets the crossing behind its stop line on arrival, and the one beyond the box when it leaves.
  for (const L of lanes) L.cwIn = L.to.cw[BACK[L.dir]] || null;
  for (const c of conns) c.cwOut = c.inter.cw[c.to.dir] || null;
  for (const L of lanes) L.feeders = [];
  for (const c of conns) c.to.feeders.push(c);
  // Each crossing knows the traffic that will run over it: lanes that arrive at it, connectors that leave across it.
  for (const e of walk.edges) if (e.kind === 'cross') { e.feeds = []; e.exits = []; }
  for (const L of lanes) if (L.cwIn) L.cwIn.feeds.push(L);
  for (const c of conns) if (c.cwOut) c.cwOut.exits.push(c);
  return { lanes, conns, inters, walk, left };
}

// The kerb bays along each street, between consecutive avenues: { x, z, h } for bay `i`.
const bayStart = (a) => Math.max(AVENUE_XS[a] + AVENUE_HALF + 12, SHORE_WEST + 12);   // clear of the corner a turning bus swings through
export function bayCount(a) { return Math.max(0, Math.floor((AVENUE_XS[a + 1] - AVENUE_HALF - 12 - bayStart(a)) / BAY_PITCH) + 1); }
export function bayAt(a, j, side, i, left, out = {}) {
  out.x = bayStart(a) + i * BAY_PITCH;
  out.z = STREET_ZS[j] + side * KERB_BAY;
  out.h = headingOf(side * (left ? -1 : 1), 0);   // south kerb faces east, north kerb west (flipped when driving on the left)
  return out;
}
export { BACK, RIGHT, LEFT };
