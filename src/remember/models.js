import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural toy models for Remind Me. Metres, origin at ground contact, facing -Z.
// Every static piece of a model is merged into one mesh per material (colours are baked
// into vertex colours), so a model is a handful of draw calls. Moving parts get their own
// pivot groups. Materials are shared and cached; disposeModel skips them.
const P = {
  red: '#e0322b', blue: '#2f6fdb', sky: '#6cc4ff', yellow: '#ffd23f', gold: '#ffd66b', brass: '#e0b04f',
  green: '#3fae5a', mint: '#7fd6c2', orange: '#ff8a3d', pink: '#ff5fa8', teal: '#2fb5a8', coral: '#f0604d',
  cream: '#f6efdc', stone: '#f1e8d3', stoneDk: '#d9cdb2', slate: '#8a97ab', white: '#f8f6f0',
  grey: '#9aa1ab', greyDk: '#59616d', ink: '#22262e', black: '#16181d', tyre: '#2b2e34', hub: '#d8dde5',
  glassDk: '#26324a', glass: '#8fd0ff', shoe: '#2a2d36', mouth: '#a2403d', wood: '#7a4a2e', lit: '#ffe2a3',
};
const HALF = Math.PI / 2, TAU = Math.PI * 2;

const SHARED = new Set();
const cache = new Map();
function cached(key, make) {
  let v = cache.get(key);
  if (!v) { v = make(); cache.set(key, v); SHARED.add(v); }
  return v;
}
const TOY = cached('toy', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 }));
const GLOSS = cached('gloss', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.05 }));
const glow = (c, i = 1) => cached(`glow${c}${i}`, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.5 }));
const gem = (c, i = 0.55) => cached(`gem${c}${i}`, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.2, metalness: 0.1 }));
const pane = (c, o) => cached(`pane${c}${o}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.1, transparent: true, opacity: o, depthWrite: false }));
const flatMat = (c, o) => cached(`flat${c}${o}`, () => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide }));
const additive = (color, opacity, vertexColors = false) => new THREE.MeshBasicMaterial({ color, vertexColors, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

const shade = (c, f) => new THREE.Color(c).multiplyScalar(f);
const ticker = () => {
  let last = -1;
  return (t) => { const d = last < 0 ? 0 : Math.min(0.1, Math.max(0, t - last)); last = t; return d; };
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const prims = new Map();

// Position + normal only, non-indexed, so any primitive merges with any other.
function clean(g, flat) {
  if (g.index) g = g.toNonIndexed();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (flat) g.computeVertexNormals();
  return g;
}
function prim(key, flat, make) {
  const id = flat ? `${key}f` : key;
  let g = prims.get(id);
  if (!g) prims.set(id, g = clean(make(), flat));
  return g;
}

// Rectangular cross-sections joined along z: { z, w, wt (top width), y0, y1 }.
function loft(st) {
  const ring = (s) => {
    const b = s.w / 2, t = (s.wt ?? s.w) / 2;
    return [[-b, s.y0, s.z], [b, s.y0, s.z], [t, s.y1, s.z], [-t, s.y1, s.z]];
  };
  const rings = st.map(ring), pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const f = rings[0], l = rings[rings.length - 1];
  tri(f[0], f[2], f[1]); tri(f[0], f[3], f[2]);
  tri(l[0], l[1], l[2]); tri(l[0], l[2], l[3]);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; tri(a[k], a[n], b[n]); tri(a[k], b[n], b[k]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Collects primitives and merges them into one mesh per material. Trailing args are
// (x, y, z, colour, rotation [rx, ry, rz], scale [sx, sy, sz]).
function kit() {
  const groups = new Map();
  const put = (mat, base, x, y, z, c, r, s) => {
    const g = base.clone();
    _m.compose(_p.set(x, y, z), _q.setFromEuler(r ? _e.set(r[0], r[1], r[2]) : _e.set(0, 0, 0)), s ? _s.set(s[0], s[1], s[2]) : _s.set(1, 1, 1));
    g.applyMatrix4(_m);
    _c.set(c);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (groups.get(mat) || groups.set(mat, []).get(mat)).push(g);
  };
  const api = (mat) => ({
    box: (w, h, d, x, y, z, c, r, s) => put(mat, prim(`b${w},${h},${d}`, false, () => new THREE.BoxGeometry(w, h, d)), x, y, z, c, r, s),
    cyl: (rt, rb, h, n, x, y, z, c, r, s) => put(mat, prim(`c${rt},${rb},${h},${n}`, false, () => new THREE.CylinderGeometry(rt, rb, h, n)), x, y, z, c, r, s),
    pole: (rad, h, n, x, y, z, c, r, s) => put(mat, prim(`o${rad},${h},${n}`, true, () => new THREE.CylinderGeometry(rad, rad, h, n, 1, true)), x, y, z, c, r, s),
    prism: (rt, rb, h, n, x, y, z, c, r, s) => put(mat, prim(`p${rt},${rb},${h},${n}`, true, () => new THREE.CylinderGeometry(rt, rb, h, n)), x, y, z, c, r, s),
    sph: (rad, x, y, z, c, r, s, w = 12, h = 8) => put(mat, prim(`s${rad},${w},${h}`, false, () => new THREE.SphereGeometry(rad, w, h)), x, y, z, c, r, s),
    dome: (rad, x, y, z, c, r, s, w = 14, h = 6) => put(mat, prim(`d${rad},${w},${h}`, false, () => new THREE.SphereGeometry(rad, w, h, 0, TAU, 0, HALF)), x, y, z, c, r, s),
    loft: (st, c, x = 0, y = 0, z = 0, r, s) => put(mat, clean(loft(st), true), x, y, z, c, r, s),
    geo: (g, flat, x, y, z, c, r, s) => put(mat, clean(g, flat), x, y, z, c, r, s),
    extrude: (pts, depth, x, y, z, c, r) => {
      const sh = new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2(px, py)));
      put(mat, clean(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), true), x, y, z, c, r);
    },
  });
  const k = api(TOY);
  k.on = api;
  k.into = (parent) => {
    for (const [mat, list] of groups) parent.add(new THREE.Mesh(mergeGeometries(list), mat));
    return parent;
  };
  return k;
}

// One axle = one merged mesh spun about x, holding a tyre + hub + cross bars per wheel.
function axle(r, w, xs, y, z, tyre = P.tyre, hub = P.hub, bar = P.white) {
  const p = new THREE.Group();
  p.position.set(0, y, z);
  const k = kit();
  for (const x of xs) {
    k.cyl(r, r, w, 14, x, 0, 0, tyre, [0, 0, HALF]);
    k.cyl(r * 0.6, r * 0.6, w + 0.05, 10, x, 0, 0, hub, [0, 0, HALF]);
    k.box(w + 0.08, r * 0.2, r * 1.1, x, 0, 0, bar);
    k.box(w + 0.08, r * 1.1, r * 0.2, x, 0, 0, bar);
  }
  return k.into(p);
}
function rolling(g, axles, radius) {
  const tick = ticker();
  g.userData.animate = (t, speed = 0) => {
    const a = tick(t) * speed / radius;
    for (let i = 0; i < axles.length; i++) axles[i].rotation.x -= a;
  };
}

// White vertex colours faded by fn(x, y, z); with additive blending that is a soft falloff.
function fade(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = fn(p.getX(i), p.getY(i), p.getZ(i));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

let glowTex = null;
function glowTexture() {
  if (glowTex || typeof document === 'undefined') return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  SHARED.add(glowTex);
  return glowTex;
}
let plaqueTex = null;
function plaqueTexture() {
  if (plaqueTex || typeof document === 'undefined') return plaqueTex;
  const c = document.createElement('canvas');
  c.width = 640; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#2b3a67'; x.fillRect(0, 0, 640, 96);
  x.strokeStyle = P.gold; x.lineWidth = 5; x.strokeRect(6, 6, 628, 84);
  x.fillStyle = P.gold; x.font = '700 62px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('M U S E U M', 320, 52);
  plaqueTex = new THREE.CanvasTexture(c);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  SHARED.add(plaqueTex);
  return plaqueTex;
}

// A slice pointing down, ~1.3 m: extruded cheese, rolled crust, pepperoni on both faces.
function pizzaSlice(k) {
  k.extrude([[-0.5, 0.4], [0.5, 0.4], [0, -0.78]], 0.3, 0, 0, -0.15, P.gold);
  k.cyl(0.16, 0.16, 1.08, 8, 0, 0.44, 0, '#c98a4b', [0, 0, HALF]);
  for (const z of [-0.15, 0.15]) for (const [x, y] of [[-0.16, 0.14], [0.17, 0.05], [0, -0.3]]) k.cyl(0.11, 0.11, 0.06, 8, x, y, z, '#d6402c', [HALF, 0, 0]);
}

// --- Avatar -----------------------------------------------------------------

export function makeAvatar({ shirt = '#e0322b', pants = '#2b3d5c', skin = '#f2c9a0', hair = '#3a2a1e', hat = null } = {}) {
  const g = new THREE.Group();
  g.name = 'avatar';
  const root = new THREE.Group(), rig = new THREE.Group(), body = new THREE.Group(), upper = new THREE.Group();
  root.name = 'root'; body.name = 'body';
  body.position.y = 0.78; upper.position.y = -0.78;
  g.add(root); root.add(rig); rig.add(body); body.add(upper);
  g.userData.root = root; g.userData.body = body;

  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group(), k = kit();
    p.position.set(s * 0.17, 0.78, 0);
    k.box(0.32, 0.64, 0.34, 0, -0.32, 0, pants);
    k.box(0.34, 0.16, 0.46, 0, -0.7, -0.06, P.shoe);
    rig.add(k.into(p));
    return p;
  });

  const k = kit(), masked = hat === 'mask', capped = hat === 'cap' || hat === 'helmet';
  const st = { z: -0.21, w: 0.68, wt: 0.78, y0: 0.78, y1: 1.34 };
  k.loft([st, { ...st, z: 0.21 }], shirt);
  k.box(0.7, 0.1, 0.44, 0, 0.83, 0, pants);
  k.box(0.15, 0.13, 0.02, -0.17, 1.12, -0.215, shade(shirt, 0.8));
  k.cyl(0.12, 0.12, 0.1, 10, 0, 1.36, 0, skin);
  k.cyl(0.27, 0.27, 0.34, 16, 0, 1.51, 0, skin);
  for (const s of [-1, 1]) {
    k.box(0.05, 0.09, 0.05, s * 0.1, 1.55, -0.245, masked ? P.white : P.ink);
    k.box(0.028, 0.03, 0.04, s * 0.07, 1.447, -0.256, P.mouth);
  }
  k.box(0.1, 0.028, 0.04, 0, 1.43, -0.262, P.mouth);
  k.box(0.04, 0.06, 0.05, 0, 1.49, -0.275, shade(skin, 0.9));
  if (!capped) {
    k.cyl(0.285, 0.285, 0.12, 16, 0, 1.7, 0, hair);
    k.box(0.42, 0.07, 0.06, 0, 1.665, -0.245, hair);
  }
  k.box(0.56, capped ? 0.16 : 0.3, 0.14, 0, capped ? 1.47 : 1.56, 0.2, hair);
  if (!capped) for (const s of [-1, 1]) k.box(0.06, 0.2, 0.3, s * 0.28, 1.6, 0.05, hair);
  if (hat === 'cap') {
    k.dome(0.3, 0, 1.64, 0, shirt, null, [1, 0.55, 1]);
    k.box(0.36, 0.03, 0.3, 0, 1.655, -0.33, shirt, [-0.12, 0, 0]);
    k.cyl(0.04, 0.04, 0.04, 8, 0, 1.82, 0, shade(shirt, 0.8));
  } else if (hat === 'helmet') {
    k.dome(0.33, 0, 1.6, 0, P.yellow, null, [1, 0.62, 1]);
    k.box(0.1, 0.03, 0.46, 0, 1.8, 0, P.white);
    k.box(0.6, 0.3, 0.1, 0, 1.56, 0.25, P.yellow);
    for (const s of [-1, 1]) k.box(0.07, 0.26, 0.36, s * 0.3, 1.5, 0.04, P.yellow);
  } else if (masked) {
    k.cyl(0.283, 0.283, 0.11, 16, 0, 1.55, 0, P.black);
    k.box(0.05, 0.05, 0.05, -0.1, 1.55, -0.28, P.black);
    k.box(0.05, 0.05, 0.05, 0.1, 1.55, -0.28, P.black);
    for (const s of [-1, 1]) k.box(0.16, 0.05, 0.05, s * 0.2, 1.53, 0.3, P.black, [0, s * 0.5, 0]);
  }
  if (hat === 'cape') k.box(0.15, 0.15, 0.03, 0, 1.16, -0.225, P.yellow, [0, 0, Math.PI / 4]);
  k.into(upper);

  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group(), a = kit();
    p.position.set(s * 0.47, 1.3, 0);
    a.box(0.2, 0.5, 0.24, 0, -0.26, 0, shirt);
    a.cyl(0.1, 0.1, 0.13, 8, 0, -0.56, 0, skin);
    upper.add(a.into(p));
    return p;
  });

  let cape = null, cape2 = null;
  if (hat === 'cape') {
    cape = new THREE.Group(); cape2 = new THREE.Group();
    cape.position.set(0, 1.32, 0.22); cape2.position.y = -0.5;
    const c1 = kit(), c2 = kit();
    c1.box(0.7, 0.5, 0.05, 0, -0.25, 0.03, '#d92f3a');
    c2.box(0.62, 0.42, 0.05, 0, -0.21, 0.03, '#c22833');
    cape.add(c1.into(new THREE.Group()));
    cape2.add(c2.into(new THREE.Group()));
    cape.add(cape2);
    upper.add(cape);
  }

  const tick = ticker();
  let ph = 0, amp = 0, air = 0;
  g.userData.animate = (t, speed = 0, extra) => {
    const dt = tick(t), k1 = Math.min(1, dt * 10);
    air += ((extra && extra.air ? 1 : 0) - air) * k1;
    amp += (Math.min(1, speed / 6) - amp) * k1;
    ph += dt * (5 + speed * 1.5);
    const s = Math.sin(ph) * amp * (1 - air), idle = Math.sin(t * 2.2);
    legs[0].rotation.x = s * 0.9 + air * 0.55;
    legs[1].rotation.x = -s * 0.9 - air * 0.3;
    arms[0].rotation.x = -s * 0.85 + air * 2.7;
    arms[1].rotation.x = s * 0.85 + air * 2.7;
    arms[0].rotation.z = -(0.05 + idle * 0.03 * (1 - amp) + air * 0.3);
    arms[1].rotation.z = 0.05 + idle * 0.03 * (1 - amp) + air * 0.3;
    rig.position.y = Math.abs(Math.sin(ph)) * 0.05 * amp * (1 - air) + idle * 0.012 * (1 - amp);
    if (cape) {
      const lift = 0.1 + 0.6 * Math.min(1, speed / 8) + air * 0.35;
      cape.rotation.x = -lift + Math.sin(t * 9) * 0.05 * (0.3 + amp);
      cape2.rotation.x = -lift * 0.5 + Math.sin(t * 9 - 1.4) * 0.09 * (0.3 + amp);
      cape.rotation.z = Math.sin(t * 6.3) * 0.05 * amp;
    }
  };
  g.userData.animate(0, 0);
  return g;
}

// --- Vehicles ---------------------------------------------------------------

export function makeSkateboard() {
  const g = new THREE.Group();
  g.name = 'skateboard';
  const k = kit();
  k.box(0.24, 0.035, 0.52, 0, 0.13, 0, P.orange);
  k.box(0.22, 0.008, 0.5, 0, 0.152, 0, P.ink);
  for (const s of [-1, 1]) {
    k.box(0.24, 0.035, 0.14, 0, 0.152, s * 0.325, P.orange, [s * 0.4, 0, 0]);
    k.box(0.22, 0.008, 0.13, 0, 0.176, s * 0.322, P.ink, [s * 0.4, 0, 0]);
    k.box(0.14, 0.04, 0.07, 0, 0.095, s * 0.22, P.grey);
    k.box(0.34, 0.03, 0.03, 0, 0.06, s * 0.22, P.greyDk);
  }
  k.into(g);
  const wheels = [-0.22, 0.22].map((z) => { const a = axle(0.06, 0.05, [-0.17, 0.17], 0.06, z, P.yellow, P.white, P.orange); g.add(a); return a; });
  rolling(g, wheels, 0.06);
  return g;
}

export function makeRaceCar(colour = '#e0322b') {
  const g = new THREE.Group();
  g.name = 'raceCar';
  const k = kit();
  k.loft([
    { z: -2.0, w: 0.46, y0: 0.34, y1: 0.62 },
    { z: -1.3, w: 1.0, y0: 0.32, y1: 0.76 },
    { z: -0.5, w: 1.44, y0: 0.3, y1: 0.9 },
    { z: 1.05, w: 1.44, y0: 0.3, y1: 0.9 },
    { z: 1.85, w: 1.1, y0: 0.32, y1: 0.8 },
  ], colour);
  for (const s of [-1, 1]) {
    k.box(0.02, 0.1, 2.0, s * 0.725, 0.55, 0.3, P.white);
    k.cyl(0.32, 0.32, 0.03, 16, s * 0.735, 0.56, -0.1, P.white, [0, 0, HALF]);
    k.box(0.045, 0.3, 0.05, s * 0.75, 0.56, -0.1, P.ink);
    k.box(0.045, 0.09, 0.05, s * 0.75, 0.68, -0.15, P.ink, [0.6, 0, 0]);
    k.box(0.05, 0.16, 0.5, s * 0.95, 0.3, -1.85, colour);
    k.box(0.05, 0.34, 0.7, s * 0.86, 1.42, 1.8, P.white);
    k.box(0.08, 0.55, 0.08, s * 0.45, 1.1, 1.75, P.ink);
    k.cyl(0.07, 0.07, 0.3, 8, s * 0.3, 0.62, 1.95, P.grey, [HALF, 0, 0]);
    k.box(0.08, 0.5, 0.08, s * 0.28, 1.15, 0.5, P.white);
  }
  k.box(1.9, 0.05, 0.42, 0, 0.24, -1.85, P.ink);
  k.box(1.7, 0.06, 0.5, 0, 1.4, 1.75, colour);
  k.box(1.7, 0.05, 0.28, 0, 1.53, 1.85, P.white);
  k.box(0.64, 0.08, 0.08, 0, 1.4, 0.5, P.white);
  k.box(0.7, 0.03, 1.0, 0, 0.915, 0, P.ink);
  k.box(0.6, 0.3, 0.12, 0, 1.05, 0.5, P.ink);
  k.box(0.46, 0.3, 0.34, 0, 1.02, 0.18, P.blue);
  k.sph(0.24, 0, 1.24, 0.08, P.yellow, null, null, 10, 6);
  k.box(0.34, 0.1, 0.1, 0, 1.24, -0.14, P.ink);
  k.box(0.3, 0.05, 0.05, 0, 1.0, -0.4, P.ink, [0.4, 0, 0]);
  for (const x of [-0.3, 0.3]) for (const z of [0.7, 1.05]) k.cyl(0.1, 0.1, 0.06, 8, x, 0.93, z, colour);
  k.into(g);
  const wheels = [-1.3, 1.3].map((z) => { const a = axle(0.42, 0.4, [-0.95, 0.95], 0.42, z, P.tyre, P.hub, P.gold); g.add(a); return a; });
  rolling(g, wheels, 0.42);
  return g;
}

export function makeScooter() {
  const g = new THREE.Group();
  g.name = 'scooter';
  const body = P.mint, k = kit();
  k.box(0.44, 0.07, 0.6, 0, 0.3, -0.1, body);
  k.box(0.36, 0.02, 0.5, 0, 0.34, -0.1, P.ink);
  k.box(0.5, 0.75, 0.09, 0, 0.68, -0.4, body, [0.2, 0, 0]);
  k.box(0.54, 0.18, 0.3, 0, 1.08, -0.42, body);
  k.box(0.1, 0.3, 0.1, 0, 0.98, -0.42, P.greyDk);
  k.box(0.8, 0.05, 0.05, 0, 1.2, -0.4, P.grey);
  for (const s of [-1, 1]) {
    k.box(0.14, 0.07, 0.07, s * 0.36, 1.2, -0.4, P.ink);
    k.box(0.05, 0.72, 0.05, s * 0.11, 0.6, -0.515, P.grey, [0.24, 0, 0]);
  }
  k.box(0.2, 0.05, 0.3, 0, 0.6, -0.62, body);
  k.box(0.2, 0.05, 0.14, 0, 0.55, -0.78, body, [-0.5, 0, 0]);
  k.loft([
    { z: 0.02, w: 0.4, y0: 0.32, y1: 0.62 },
    { z: 0.3, w: 0.46, wt: 0.38, y0: 0.36, y1: 0.8 },
    { z: 0.75, w: 0.4, wt: 0.32, y0: 0.4, y1: 0.72 },
    { z: 0.92, w: 0.32, wt: 0.26, y0: 0.44, y1: 0.6 },
  ], body);
  k.box(0.36, 0.1, 0.62, 0, 0.86, 0.32, '#4a3428');
  k.box(0.44, 0.04, 0.42, 0, 0.76, 0.72, P.grey);
  k.box(0.48, 0.4, 0.46, 0, 0.98, 0.7, P.red);
  k.box(0.51, 0.06, 0.5, 0, 1.2, 0.7, P.cream);
  k.box(0.51, 0.05, 0.5, 0, 0.92, 0.7, P.cream);
  k.cyl(0.17, 0.17, 0.03, 12, 0, 1.0, 0.935, P.cream, [HALF, 0, 0]);
  k.cyl(0.13, 0.13, 0.04, 12, 0, 1.0, 0.94, P.gold, [HALF, 0, 0]);
  for (const [x, y] of [[-0.05, 1.04], [0.06, 0.97], [-0.01, 0.94]]) k.cyl(0.035, 0.035, 0.04, 8, x, y, 0.945, '#d6402c', [HALF, 0, 0]);
  k.on(glow('#fff2b0')).cyl(0.1, 0.1, 0.06, 10, 0, 1.1, -0.6, null, [HALF, 0, 0]);
  k.on(glow('#ff3b3b')).box(0.12, 0.05, 0.04, 0, 0.6, 0.93);
  k.into(g);
  const wheels = [-0.58, 0.5].map((z) => { const a = axle(0.26, 0.12, [0], 0.26, z, P.tyre, P.cream, P.mint); g.add(a); return a; });
  rolling(g, wheels, 0.26);
  return g;
}

export function makeVan(colour = '#2e3440') {
  const g = new THREE.Group();
  g.name = 'van';
  const k = kit(), gl = k.on(GLOSS);
  k.loft([
    { z: -2.5, w: 1.86, y0: 0.46, y1: 0.96 },
    { z: -2.3, w: 1.98, y0: 0.38, y1: 1.2 },
    { z: -1.55, w: 2.0, y0: 0.38, y1: 1.34 },
    { z: -0.85, w: 2.0, y0: 0.38, y1: 2.16 },
    { z: 2.5, w: 2.0, y0: 0.38, y1: 2.16 },
  ], colour);
  gl.box(1.72, 0.9, 0.03, 0, 1.76, -1.215, P.glassDk, [0.706, 0, 0]);
  gl.box(0.7, 0.5, 0.03, -0.42, 1.75, 2.505, P.glassDk);
  gl.box(0.7, 0.5, 0.03, 0.42, 1.75, 2.505, P.glassDk);
  for (const s of [-1, 1]) {
    gl.box(0.03, 0.6, 0.7, s * 1.01, 1.68, -0.6, P.glassDk);
    k.box(0.02, 0.12, 4.4, s * 1.005, 0.8, 0.1, P.orange);
    k.box(0.03, 1.2, 0.03, s * 1.005, 1.25, 0.25, P.black);
    k.box(0.03, 0.06, 0.25, s * 1.01, 1.2, 0.45, P.grey);
    k.box(0.08, 0.25, 0.18, s * 1.08, 1.45, -1.3, P.grey);
    k.box(0.9, 0.14, 0.03, s * 0.42, 1.85, 2.515, P.black, [0, 0, 0]);
    for (const z of [-1.3, 1.3]) k.cyl(0.5, 0.5, 0.03, 12, s * 1.012, 0.56, z, P.black, [0, 0, HALF]);
  }
  k.box(1.9, 0.22, 0.2, 0, 0.55, -2.52, P.grey);
  k.box(1.9, 0.22, 0.2, 0, 0.55, 2.52, P.grey);
  k.box(1.0, 0.3, 0.04, 0, 0.78, -2.52, P.black);
  k.box(0.03, 1.4, 0.03, 0, 1.3, 2.51, P.black);
  k.box(0.7, 0.14, 0.9, 0, 2.23, 0.4, P.grey);
  k.sph(0.32, 0, 2.5, 1.5, '#c9b37a', null, [1, 0.85, 1]);
  k.cyl(0.08, 0.16, 0.14, 8, 0, 2.74, 1.5, '#c9b37a');
  k.cyl(0.12, 0.12, 0.05, 8, 0, 2.66, 1.5, P.red);
  for (const z of [1.5 - 0.3, 1.5 + 0.3]) k.cyl(0.11, 0.11, 0.03, 10, 0, 2.5, z, P.brass, [HALF, 0, 0]);
  const lamp = k.on(glow(P.lit)), tail = k.on(glow('#ff3b3b'));
  for (const s of [-1, 1]) { lamp.box(0.3, 0.16, 0.06, s * 0.7, 0.82, -2.51); tail.box(0.14, 0.4, 0.05, s * 0.9, 1.0, 2.51); }
  k.into(g);
  const wheels = [-1.3, 1.3].map((z) => { const a = axle(0.42, 0.3, [-0.92, 0.92], 0.42, z, P.tyre, P.hub, P.greyDk); g.add(a); return a; });
  rolling(g, wheels, 0.42);
  return g;
}

export function makeHoverCar(colour = '#39e6ff') {
  const g = new THREE.Group(), bob = new THREE.Group();
  g.name = 'hoverCar';
  g.add(bob);
  const k = kit(), gl = k.on(GLOSS), lit = k.on(glow(colour, 1.2)), white = k.on(glow('#ffffff'));
  k.loft([
    { z: -2.2, w: 0.5, y0: 0.46, y1: 0.64 },
    { z: -1.6, w: 1.2, y0: 0.42, y1: 0.8 },
    { z: -0.6, w: 1.8, wt: 1.5, y0: 0.4, y1: 1.02 },
    { z: 0.9, w: 1.9, wt: 1.4, y0: 0.4, y1: 1.02 },
    { z: 1.9, w: 1.7, wt: 1.2, y0: 0.42, y1: 0.92 },
  ], colour);
  k.box(1.6, 0.06, 3.7, 0, 0.415, 0, P.ink);
  lit.box(1.7, 0.03, 3.85, 0, 0.375, 0);
  lit.box(1.8, 0.05, 0.06, 0, 0.4, 1.9);
  lit.box(1.2, 0.05, 0.06, 0, 0.44, -1.6);
  gl.dome(0.72, 0, 1.0, -0.25, '#1f3b73', null, [0.95, 0.62, 1.55]);
  k.box(1.7, 0.05, 0.42, 0, 1.14, 1.55, P.white);
  k.box(0.5, 0.05, 0.6, 0, 1.03, 0.6, P.white);
  for (const s of [-1, 1]) {
    k.pole(0.03, 0.2, 6, s * 0.55, 1.04, 1.55, P.grey);
    lit.box(0.06, 0.09, 0.46, s * 0.86, 1.14, 1.55);
    k.cyl(0.26, 0.32, 1.0, 10, s * 0.62, 0.66, 1.75, P.white, [HALF, 0, 0]);
    lit.cyl(0.21, 0.21, 0.06, 10, s * 0.62, 0.66, 2.27, null, [HALF, 0, 0]);
    lit.box(0.05, 0.05, 3.1, s * 0.96, 0.4, 0.1);
    white.box(0.3, 0.06, 0.06, s * 0.45, 0.66, -1.78, null, [0, s * 0.4, 0]);
  }
  k.on(glow('#ff3b5c')).box(0.5, 0.06, 0.04, 0, 0.86, 1.92);
  k.into(bob);
  const decal = additive(colour, 0.12);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), decal);
  spot.rotation.x = -HALF; spot.position.y = 0.03; spot.scale.set(0.75, 1.35, 1);
  g.add(spot);
  const tick = ticker();
  g.userData.animate = (t, speed = 0) => {
    tick(t);
    const b = Math.sin(t * 2.4), p = Math.min(1, speed / 25);
    bob.position.y = 0.34 + b * 0.05;
    bob.rotation.x = -0.05 * p + Math.sin(t * 1.3) * 0.006;
    bob.rotation.z = Math.sin(t * 1.7) * 0.014;
    decal.opacity = 0.12 + b * 0.03;
  };
  g.userData.animate(0, 0);
  return g;
}

export function makeHorseCarriage() {
  const g = new THREE.Group();
  g.name = 'horseCarriage';
  const LAC = '#232a35', COAT = '#a0603a', MANE = '#2b1c14', CREAM = '#efe3c8', HOOF = '#3a3a3f', RED = '#8e2b2f';
  const k = kit(), gl = k.on(GLOSS);
  k.box(1.15, 0.14, 1.6, 0, 0.9, 0.5, LAC);
  k.box(1.15, 1.2, 1.4, 0, 1.6, 0.45, LAC);
  k.box(1.2, 0.05, 1.45, 0, 1.0, 0.45, P.brass);
  k.box(0.9, 0.75, 0.06, 0, 1.75, -0.27, P.ink);
  k.box(1.0, 0.5, 0.06, 0, 1.3, -0.28, LAC);
  k.box(1.0, 0.05, 0.07, 0, 1.58, -0.29, P.brass);
  gl.box(0.5, 0.45, 0.03, 0, 1.8, 1.16, P.glassDk);
  k.loft([{ z: -0.45, w: 1.3, wt: 0.8, y0: 2.2, y1: 2.55 }, { z: 1.25, w: 1.3, wt: 0.8, y0: 2.2, y1: 2.55 }], LAC);
  k.box(1.34, 0.05, 1.74, 0, 2.2, 0.4, P.brass);
  k.box(0.75, 0.14, 0.55, 0, 2.55, 1.45, RED);
  k.box(0.75, 0.5, 0.1, 0, 2.85, 1.75, RED);
  k.box(0.7, 0.08, 0.4, 0, 2.05, 1.5, LAC);
  k.box(0.9, 0.06, 0.3, 0, 0.72, 1.55, P.brass);
  for (const s of [-1, 1]) {
    gl.box(0.03, 0.6, 0.75, s * 0.585, 1.75, 0.55, P.glassDk);
    k.box(0.16, 0.07, 1.9, s * 0.8, 1.72, 0.5, LAC);
    k.box(0.1, 0.6, 0.1, s * 0.3, 2.3, 1.45, LAC);
    k.box(0.06, 0.06, 3.0, s * 0.52, 1.1, -1.1, P.wood);
    k.box(0.18, 0.05, 0.18, s * 0.62, 2.13, -0.32, P.brass);
    k.on(glow('#ffb84a')).box(0.14, 0.2, 0.14, s * 0.62, 2.0, -0.32);
  }
  k.into(g);
  const wheels = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(), a = kit();
    w.position.set(s * 0.8, 0.8, 0.5);
    a.cyl(0.8, 0.8, 0.14, 16, 0, 0, 0, RED, [0, 0, HALF]);
    a.cyl(0.62, 0.62, 0.17, 16, 0, 0, 0, LAC, [0, 0, HALF]);
    a.cyl(0.16, 0.16, 0.22, 8, 0, 0, 0, P.brass, [0, 0, HALF]);
    for (const r of [0, Math.PI / 4, HALF, Math.PI * 0.75]) a.box(0.2, 1.3, 0.1, 0, 0, 0, P.cream, [r, 0, 0]);
    g.add(a.into(w)); wheels.push(w);
  }

  const horse = new THREE.Group(), neck = new THREE.Group(), tail = new THREE.Group(), hk = kit();
  horse.position.z = -1.55;
  hk.box(0.72, 0.8, 1.5, 0, 1.35, 0, COAT);
  hk.box(0.78, 0.86, 0.5, 0, 1.35, -0.55, COAT);
  hk.box(0.78, 0.84, 0.5, 0, 1.35, 0.55, COAT);
  hk.box(0.8, 0.62, 0.14, 0, 1.5, -0.74, RED);
  hk.box(0.8, 0.1, 0.5, 0, 1.78, 0.15, RED);
  hk.into(horse);
  neck.position.set(0, 1.55, -0.7); neck.rotation.x = -0.55;
  const nk = kit();
  nk.box(0.36, 1.0, 0.46, 0, 0.45, 0, COAT);
  nk.box(0.1, 1.0, 0.12, 0, 0.47, 0.28, MANE);
  nk.box(0.34, 0.4, 0.8, 0, 1.02, -0.3, COAT);
  nk.box(0.28, 0.3, 0.28, 0, 1.0, -0.7, '#6b4128');
  nk.box(0.35, 0.07, 0.32, 0, 1.12, -0.1, P.brass);
  for (const s of [-1, 1]) {
    nk.box(0.09, 0.22, 0.08, s * 0.1, 1.34, 0.04, MANE);
    nk.box(0.04, 0.07, 0.07, s * 0.175, 1.1, -0.16, P.ink);
  }
  horse.add(nk.into(neck));
  tail.position.set(0, 1.62, 0.78); tail.rotation.x = -0.3;
  const tk = kit();
  tk.box(0.14, 0.75, 0.14, 0, -0.36, 0.05, MANE);
  horse.add(tk.into(tail));
  const legs = [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]].map(([s, z]) => {
    const p = new THREE.Group(), l = kit();
    p.position.set(s * 0.24, 0.95, z);
    l.box(0.2, 0.5, 0.24, 0, -0.25, 0, COAT);
    l.box(0.13, 0.35, 0.15, 0, -0.675, 0, COAT);
    l.box(0.15, 0.12, 0.17, 0, -0.82, 0, CREAM);
    l.box(0.19, 0.08, 0.22, 0, -0.91, 0.01, HOOF);
    horse.add(l.into(p));
    return p;
  });
  g.add(horse);

  const tick = ticker();
  let ph = 0, amp = 0;
  g.userData.animate = (t, speed = 0) => {
    const dt = tick(t);
    amp += (Math.min(1, speed / 3) - amp) * Math.min(1, dt * 8);
    ph += dt * (3 + speed * 1.6);
    const s = Math.sin(ph) * 0.6 * amp;
    legs[0].rotation.x = s; legs[1].rotation.x = -s; legs[2].rotation.x = -s; legs[3].rotation.x = s;
    neck.rotation.x = -0.55 + Math.sin(ph * 2) * 0.05 * amp + Math.sin(t * 1.5) * 0.02;
    tail.rotation.x = -0.3 + Math.sin(ph) * 0.12 * amp;
    tail.rotation.z = Math.sin(t * 2.3) * 0.1;
    horse.position.y = Math.abs(Math.sin(ph)) * 0.03 * amp;
    const a = dt * speed / 0.8;
    wheels[0].rotation.x -= a; wheels[1].rotation.x -= a;
  };
  return g;
}

// --- Set pieces -------------------------------------------------------------

export function makeJewel() {
  const g = new THREE.Group(), K = P.stone;
  g.name = 'jewel';
  const k = kit();
  k.box(1.1, 0.2, 1.1, 0, 0.1, 0, K);
  k.box(0.8, 0.7, 0.8, 0, 0.55, 0, P.cream);
  k.box(0.95, 0.1, 0.95, 0, 0.95, 0, K);
  k.cyl(0.36, 0.36, 0.03, 10, 0, 1.015, 0, P.brass);
  k.cyl(0.3, 0.34, 0.12, 10, 0, 1.09, 0, '#2a3f8f');
  for (const x of [-0.44, 0.44]) for (const z of [-0.44, 0.44]) k.box(0.05, 0.9, 0.05, x, 1.45, z, P.brass);
  for (const y of [1.0, 1.9]) {
    for (const s of [-0.44, 0.44]) { k.box(0.93, 0.05, 0.05, 0, y, s, P.brass); k.box(0.05, 0.05, 0.93, s, y, 0, P.brass); }
  }
  k.into(g);
  const gk = kit(), glass = gk.on(pane('#bfe8ff', 0.13));
  for (const s of [-0.44, 0.44]) { glass.box(0.88, 0.9, 0.01, 0, 1.45, s); glass.box(0.01, 0.9, 0.88, s, 1.45, 0); }
  glass.box(0.88, 0.01, 0.88, 0, 1.9, 0);
  gk.into(g);

  const stone = new THREE.Group();
  stone.position.y = 1.5;
  const lathe = new THREE.LatheGeometry([[0, -0.3], [0.3, 0], [0.2, 0.2], [0, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
  stone.add(new THREE.Mesh(clean(lathe, true), gem('#ff5fa8')));
  stone.add(new THREE.Mesh(clean(new THREE.OctahedronGeometry(0.11), true), glow('#ffffff', 1)));
  g.add(stone);

  const sparks = [[-0.3, 1.75, 0.25], [0.32, 1.3, -0.28], [0.22, 1.72, 0.32]].map(([x, y, z]) => {
    const sk = kit(), p = new THREE.Group();
    sk.on(glow('#fff6c8')).box(0.2, 0.025, 0.025, 0, 0, 0);
    sk.on(glow('#fff6c8')).box(0.025, 0.2, 0.025, 0, 0, 0);
    p.position.set(x, y, z);
    g.add(sk.into(p));
    return p;
  });
  g.userData.animate = (t) => {
    stone.rotation.y = t * 1.2;
    stone.position.y = 1.5 + Math.sin(t * 2) * 0.06;
    for (let i = 0; i < sparks.length; i++) sparks[i].scale.setScalar(Math.max(0.05, 0.5 + 0.5 * Math.sin(t * 3 + i * 2.1)));
  };
  g.userData.gem = stone;
  return g;
}

export function makeUFO() {
  const g = new THREE.Group(), wob = new THREE.Group();
  g.name = 'ufo';
  g.add(wob);
  const k = kit(), dome = k.on(pane('#9ff5ff', 0.42));
  k.prism(3.4, 1.4, 0.45, 16, 0, 0.225, 0, '#4e5a72');
  k.prism(3.55, 3.55, 0.28, 16, 0, 0.55, 0, '#7d8aa6');
  k.prism(1.7, 3.4, 0.5, 16, 0, 0.94, 0, '#a9b8dc');
  k.cyl(0.9, 0.6, 0.25, 12, 0, -0.12, 0, '#3e4759');
  k.on(glow('#7ffcff', 1.2)).cyl(0.7, 0.7, 0.04, 12, 0, -0.26, 0);
  k.sph(0.46, 0, 1.55, 0, '#7bd66a', null, [1, 1.15, 1]);
  for (const s of [-1, 1]) k.sph(0.12, s * 0.2, 1.6, -0.4, P.black, [0, 0, -s * 0.5], [1, 1.7, 0.5], 8, 6);
  dome.dome(1.4, 0, 1.19, 0, null, null, [1, 0.95, 1]);
  const base = ['#ffe45c', '#5cf0ff', '#ff6fd0'].map((c) => new THREE.Color(c));
  const mats = base.map((c) => new THREE.MeshBasicMaterial({ color: c }));
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    k.on(mats[i % 3]).box(0.26, 0.2, 0.36, Math.cos(a) * 3.6, 0.55, Math.sin(a) * 3.6, null, [0, -a, 0]);
  }
  k.into(wob);

  const H = 40;
  const beamGeo = fade(new THREE.CylinderGeometry(0.9, 11, H, 24, 1, true).translate(0, -H / 2 - 0.2, 0), (x, y) => Math.pow(Math.max(0, 1 + (y + 0.2) / H), 1.6));
  const beam = new THREE.Mesh(beamGeo, additive('#8fffd8', 0.16, true));
  g.add(beam);
  g.userData.beam = beam;

  g.userData.animate = (t) => {
    wob.rotation.z = Math.sin(t * 1.7) * 0.07;
    wob.rotation.x = Math.cos(t * 1.3) * 0.05;
    wob.position.y = Math.sin(t * 2.1) * 0.12;
    for (let i = 0; i < 3; i++) mats[i].color.copy(base[i]).multiplyScalar(0.2 + 0.8 * Math.max(0, Math.sin(t * 7 - i * 2.09)));
    beam.material.opacity = 0.16 + Math.sin(t * 5) * 0.025;
  };
  g.userData.animate(0);
  return g;
}

export function makeCrimeMarker() {
  const g = new THREE.Group(), ring = new THREE.Group(), icon = new THREE.Group();
  g.name = 'crimeMarker';
  const RED = new THREE.Color('#ff2f3f'), BLUE = new THREE.Color('#2f6bff');
  const flat = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -HALF; m.position.y = y; return m; };
  const mat = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, ...o });
  ring.add(flat(new THREE.RingGeometry(1.45, 1.95, 24, 1, 0, Math.PI), mat({ color: RED, opacity: 0.9 }), 0.06));
  ring.add(flat(new THREE.RingGeometry(1.45, 1.95, 24, 1, Math.PI, Math.PI), mat({ color: BLUE, opacity: 0.9 }), 0.06));
  const disc = mat({ color: RED, opacity: 0.2 }), ripple = mat({ color: BLUE, opacity: 0.6 });
  g.add(ring, flat(new THREE.CircleGeometry(1.45, 24), disc, 0.05));
  const rip = flat(new THREE.RingGeometry(1.9, 2.05, 32), ripple, 0.05);
  g.add(rip);

  const k = kit(), bang = k.on(glow('#ff3b3b', 0.8));
  bang.cyl(0.2, 0.11, 0.8, 8, 0, 0.24, 0);
  bang.sph(0.15, 0, -0.32, 0, null, null, null, 8, 6);
  icon.position.y = 2.2;
  g.add(k.into(icon));

  g.userData.animate = (t) => {
    ring.rotation.y = -t * 2.6;
    ring.scale.setScalar(1 + Math.sin(t * 6) * 0.05);
    const u = (t * 0.9) % 1, flash = Math.sin(t * 6) > 0;
    rip.scale.setScalar(1 + u * 0.55);
    ripple.opacity = 0.6 * (1 - u);
    ripple.color.copy(flash ? RED : BLUE);
    disc.color.copy(flash ? RED : BLUE);
    icon.rotation.y = t * 1.6;
    icon.position.y = 2.2 + Math.sin(t * 3) * 0.12;
  };
  g.userData.animate(0);
  return g;
}

export function makeOrb(colour = '#ffd66b') {
  const g = new THREE.Group(), core = new THREE.Group(), halo = new THREE.Group();
  g.name = 'orb';
  core.position.y = 1;
  core.add(new THREE.Mesh(clean(new THREE.IcosahedronGeometry(0.27, 1), true), glow(colour, 0.9)));
  core.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), pane(colour, 0.28)));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.5, 20), flatMat(colour, 0.75));
  ring.rotation.x = 1.1;
  halo.add(ring);
  core.add(halo);
  const tex = glowTexture();
  if (tex) {
    const sprite = new THREE.Sprite(cached(`halo${colour}`, () => new THREE.SpriteMaterial({ map: tex, color: colour, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })));
    sprite.scale.setScalar(1.9);
    core.add(sprite);
  }
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14), flatMat('#000000', 0.2));
  blob.rotation.x = -HALF; blob.position.y = 0.03;
  g.add(core, blob);
  g.userData.animate = (t) => {
    const b = Math.sin(t * 2.4);
    core.rotation.y = t * 1.6;
    core.position.y = 1 + b * 0.1;
    halo.rotation.y = -t * 3;
    blob.scale.setScalar(1 - b * 0.08);
  };
  g.userData.animate(0);
  return g;
}

function bannerGeo(w, h, cols, rows, a, b) {
  const cw = w / cols, ch = h / rows, pos = [], col = [], ca = new THREE.Color(a), cb = new THREE.Color(b);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const c = (i + j) & 1 ? cb : ca, x0 = -w / 2 + i * cw, x1 = x0 + cw, y0 = -(j + 1) * ch, y1 = -j * ch;
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) { pos.push(x, y, 0); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function makeGate(colour = '#ffd66b') {
  const g = new THREE.Group();
  g.name = 'gate';
  const k = kit(), lit = k.on(glow(colour, 1.1));
  for (const s of [-1, 1]) {
    const x = s * 6.5;
    k.box(0.9, 6.0, 0.9, x, 3.0, 0, colour);
    k.box(1.3, 0.3, 1.3, x, 0.15, 0, P.greyDk);
    for (const y of [1.0, 2.2, 3.4, 4.6]) k.box(0.96, 0.45, 0.96, x, y, 0, P.white);
    k.box(1.2, 0.25, 1.2, x, 6.0, 0, P.ink);
    lit.sph(0.36, x, 7.3, 0, null, null, null, 8, 6);
  }
  k.box(14, 1.0, 1.1, 0, 6.5, 0, colour);
  k.box(13.4, 0.3, 0.06, 0, 6.5, -0.58, P.ink);
  k.box(12.4, 0.08, 0.1, 0, 6.02, -0.6, P.ink);
  k.into(g);
  const geo = bannerGeo(12.2, 1.4, 20, 2, P.ink, P.white);
  const flag = new THREE.Mesh(geo, cached('banner', () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.8 })));
  flag.position.set(0, 6.0, -0.6);
  g.add(flag);
  const p = geo.attributes.position, H = 1.4;
  g.userData.animate = (t) => {
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.75 + t * 2.6) * 0.14 * (-p.getY(i) / H));
    p.needsUpdate = true;
  };
  g.userData.animate(0);
  return g;
}

export function makeDoorMarker() {
  const g = new THREE.Group(), icon = new THREE.Group(), tilt = new THREE.Group();
  g.name = 'doorMarker';
  const H = 12;
  const tube = (r, seg, pw) => fade(new THREE.CylinderGeometry(r, r, H, seg, 1, true).translate(0, H / 2, 0), (x, y) => Math.pow(1 - y / H, pw));
  g.add(new THREE.Mesh(tube(0.3, 16, 1.4), cached('col-outer', () => additive(P.gold, 0.2, true))));
  g.add(new THREE.Mesh(tube(0.12, 10, 1.1), cached('col-core', () => additive('#fff3c4', 0.35, true))));
  const pool = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.85, 24), cached('col-ring', () => additive(P.gold, 0.25)));
  pool.rotation.x = -HALF; pool.position.y = 0.05;
  g.add(pool);
  const moteGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07), moteMat = cached('col-mote', () => additive('#fff3c4', 0.9));
  const motes = [0, 1, 2, 3, 4].map(() => { const m = new THREE.Mesh(moteGeo, moteMat); g.add(m); return m; });

  const k = kit();
  pizzaSlice(k);
  tilt.rotation.z = 0.3;
  icon.scale.setScalar(1.15);
  tilt.add(k.into(new THREE.Group()));
  icon.add(tilt);
  g.add(icon);
  g.userData.animate = (t) => {
    icon.rotation.y = t * 1.1;
    icon.position.y = 3.4 + Math.sin(t * 2) * 0.15;
    for (let i = 0; i < motes.length; i++) {
      const u = (t * 0.35 + i / motes.length) % 1, a = i * 2.4 + t;
      motes[i].position.set(Math.cos(a) * 0.22, u * 10, Math.sin(a) * 0.22);
      motes[i].rotation.y = t * 2 + i;
    }
    pool.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
  };
  g.userData.animate(0);
  return g;
}

export function makeSearchlight() {
  const g = new THREE.Group(), head = new THREE.Group();
  g.name = 'searchlight';
  const H = 3.0, REACH = 14, RADIUS = 5;
  const k = kit();
  k.cyl(0.55, 0.65, 0.25, 10, 0, 0.125, 0, P.greyDk);
  k.cyl(0.14, 0.18, 2.4, 8, 0, 1.4, 0, P.grey);
  k.box(1.3, 0.12, 0.3, 0, 2.62, 0, P.greyDk);
  k.box(0.7, 0.14, 0.7, 0, 0.32, 0, P.yellow);
  for (const s of [-1, 1]) k.box(0.1, 0.8, 0.3, s * 0.62, 3.0, 0, P.greyDk);
  k.into(g);
  const hk = kit();
  hk.cyl(0.5, 0.5, 0.9, 14, 0, 0, 0, '#3c4452', [HALF, 0, 0]);
  hk.cyl(0.58, 0.58, 0.1, 14, 0, 0, -0.45, P.brass, [HALF, 0, 0]);
  hk.cyl(0.36, 0.5, 0.25, 14, 0, 0, 0.55, P.greyDk, [HALF, 0, 0]);
  hk.box(1.2, 0.1, 0.1, 0, 0, 0, P.grey);
  hk.on(glow('#fff6c8', 1.3)).cyl(0.44, 0.44, 0.05, 14, 0, 0, -0.47, null, [HALF, 0, 0]);
  head.position.y = H;
  head.rotation.x = -Math.asin(H / (REACH + 0.5));
  g.add(hk.into(head));
  const cone = new THREE.Mesh(
    fade(new THREE.ConeGeometry(RADIUS, REACH, 24, 1, true).translate(0, -REACH / 2, 0).rotateX(HALF), (x, y, z) => 1 + 0.65 * z / REACH),
    additive('#fff3c4', 0.13, true),
  );
  cone.position.z = -0.5;
  head.add(cone);
  const sinP = H / (REACH + 0.5), cosP = Math.sqrt(1 - sinP * sinP), pos = [];
  let prev = null;
  for (let i = 0; i <= 14; i++) {
    const d = 4.5 + i * (REACH + 0.5 - 4.5) / 14, r = RADIUS * (d - 0.5) / REACH, h = (H - d * sinP) * cosP;
    const w = Math.sqrt(Math.max(0, r * r - h * h)), z = -d * cosP;
    if (prev && (w > 0 || prev[0] > 0)) pos.push(-prev[0], 0, prev[1], prev[0], 0, prev[1], w, 0, z, -prev[0], 0, prev[1], w, 0, z, -w, 0, z);
    prev = [w, z];
  }
  const poolGeo = fade(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), (x) => 0.55 + 0.45 * Math.min(1, Math.abs(x) / RADIUS));
  const pool = new THREE.Mesh(poolGeo, additive('#fff3c4', 0.2, true));
  pool.position.y = 0.04;
  g.add(pool);
  g.userData.cone = cone; g.userData.reach = REACH; g.userData.radius = RADIUS;
  g.userData.animate = (t) => {
    const f = Math.sin(t * 9) * 0.01 + Math.sin(t * 2.3) * 0.01;
    cone.material.opacity = 0.13 + f;
    pool.material.opacity = 0.2 + f;
  };
  return g;
}

export function makeMuseumFacade() {
  const g = new THREE.Group();
  g.name = 'museum';
  const S = P.stone, D = P.stoneDk, k = kit(), gl = k.on(GLOSS), warm = k.on(glow(P.lit, 0.8));
  for (const s of [-1, 1]) {
    k.box(5, 12.6, 3, s * 12.5, 6.3, 0.5, S);
    k.box(5.4, 0.8, 3.3, s * 12.5, 0.4, 0.35, D);
    k.box(5.4, 0.5, 3.2, s * 12.5, 12.85, 0.4, S);
    k.box(5.5, 0.15, 3.3, s * 12.5, 12.55, 0.4, D);
    for (const x of [10.9, 14.1]) {
      k.box(1.25, 4.7, 0.1, s * x, 6.6, -1.03, D);
      gl.box(0.95, 4.3, 0.06, s * x, 6.6, -1.08, P.glassDk);
    }
    const bc = s < 0 ? P.teal : P.coral;
    k.box(1.5, 5.2, 0.05, s * 12.5, 6.4, -1.06, bc);
    k.box(1.5, 0.16, 0.08, s * 12.5, 3.85, -1.07, P.gold);
    k.cyl(0.45, 0.45, 0.06, 12, s * 12.5, 8.2, -1.1, P.gold, [HALF, 0, 0]);
    k.pole(0.11, 3.4, 8, s * 12, 1.7, -1.6, P.ink);
    k.box(0.5, 0.4, 0.5, s * 12, 0.2, -1.6, P.ink);
    warm.sph(0.32, s * 12, 3.7, -1.6, null, null, null, 8, 6);
    k.box(0.9, 0.9, 0.9, s * 11.1, 12.4, -0.6, S);
  }
  k.box(20, 12.6, 1.8, 0, 6.3, 1.1, S);
  for (let i = 0; i < 3; i++) {
    const front = -2 + 0.35 * i, back = 0.3;
    k.box(22 - 0.6 * i, 0.35 * (i + 1), back - front, 0, 0.175 * (i + 1), (front + back) / 2, i === 2 ? S : D);
  }
  for (let i = 0; i < 6; i++) {
    const x = -9 + 3.6 * i;
    k.box(1.5, 0.35, 1.5, x, 1.225, -0.5, D);
    k.pole(0.55, 8.5, 10, x, 5.65, -0.5, S);
    k.prism(0.78, 0.55, 0.3, 10, x, 10.05, -0.5, S);
    k.box(1.6, 0.35, 1.6, x, 10.375, -0.5, D);
  }
  k.box(20.8, 1.45, 1.9, 0, 11.275, -0.3, S);
  k.box(20.9, 0.3, 1.95, 0, 10.7, -0.3, D);
  k.box(21.4, 0.3, 2.2, 0, 11.85, -0.3, D);
  k.extrude([[-11, 0], [11, 0], [0, 4]], 3.2, 0, 12, -1.25, S);
  k.extrude([[-9.4, 0.5], [9.4, 0.5], [0, 3.3]], 0.2, 0, 12, -1.45, D);
  k.cyl(0.95, 0.95, 0.2, 16, 0, 13.3, -1.5, P.gold, [HALF, 0, 0]);
  const a = Math.atan2(4, 11), len = Math.hypot(11, 4);
  for (const s of [-1, 1]) {
    k.box(len + 0.3, 0.35, 3.3, s * 5.56, 14.16, 0.3, S, [0, 0, -s * a]);
    k.box(len + 0.3, 0.14, 3.3, s * 5.7, 14.42, 0.3, P.slate, [0, 0, -s * a]);
  }
  k.box(0.7, 0.7, 0.7, 0, 15.95, -0.5, S);
  k.box(4.8, 7.0, 0.3, 0, 4.55, 0.05, D);
  k.box(4.0, 6.4, 0.06, 0, 4.25, -0.12, P.ink);
  for (const s of [-1, 1]) {
    k.box(1.9, 6.0, 0.1, s * 1.0, 4.05, -0.17, P.wood);
    warm.box(1.4, 2.6, 0.04, s * 1.0, 5.6, -0.24);
    k.box(0.1, 0.7, 0.1, s * 0.15, 3.6, -0.25, P.brass);
  }
  warm.box(3.8, 0.8, 0.05, 0, 7.5, -0.13);
  k.into(g);
  const tex = plaqueTexture();
  if (tex) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.2), cached('plaque', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })));
    sign.position.set(0, 11.27, -1.26);
    sign.rotation.y = Math.PI;
    g.add(sign);
  }
  return g;
}

export function disposeModel(group) {
  group.traverse((o) => {
    if (o.geometry && !o.isSprite && !SHARED.has(o.geometry)) o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      if (SHARED.has(m)) continue;
      if (m.map && !SHARED.has(m.map)) m.map.dispose();
      m.dispose();
    }
  });
}

// --- Street life ------------------------------------------------------------
// Cars, cabs, buses and passers-by for the living city (life.js). Each carries
// userData.dims { len, wid, h, zc } (zc: footprint centre along z) and, where it saves draw calls,
// userData.near / userData.far: pieces drawn only up close / only from afar. A far car is one mesh
// (static wheel stubs stand in for the spinning axles); a far person is one merged mesh.
const LAMPS = cached('lamps', () => new THREE.MeshBasicMaterial({ vertexColors: true }));

// Toy sedan shell: body tub, raked greenhouse, dark glass, bumpers, lamps, static wheel stubs.
function carShell(k, lamp, { colour, roof = colour, L, W, H, belt = 0.98, cabF, cabB, rakeF = 0.75, rakeB = 0.6, glass = P.glassDk, wheelZ = 1.35, wheelR = 0.32 }) {
  const hz = L / 2, W9 = W * 0.9, top = H - belt + 0.02;
  k.loft([
    { z: -hz, w: W * 0.86, y0: 0.4, y1: belt - 0.22 },
    { z: -hz + 0.22, w: W * 0.99, y0: 0.34, y1: belt - 0.08 },
    { z: cabF, w: W, y0: 0.32, y1: belt },
    { z: cabB, w: W, y0: 0.32, y1: belt },
    { z: hz - 0.2, w: W * 0.98, y0: 0.34, y1: belt - 0.04 },
    { z: hz, w: W * 0.88, y0: 0.4, y1: belt - 0.18 },
  ], colour);
  k.loft([
    { z: cabF, w: W9, wt: W * 0.8, y0: belt - 0.02, y1: belt + 0.04 },
    { z: cabF + rakeF, w: W9, wt: W * 0.76, y0: belt - 0.02, y1: H },
    { z: cabB - rakeB, w: W9, wt: W * 0.76, y0: belt - 0.02, y1: H },
    { z: cabB, w: W9, wt: W * 0.8, y0: belt - 0.02, y1: belt + 0.04 },
  ], roof);
  const zf = cabF + rakeF, zb = cabB - rakeB, gy = (belt + H) / 2, gh = (H - belt) * 0.6;
  const half = W9 / 2 + (W * 0.38 - W9 / 2) * ((gy - belt + 0.02) / top), tilt = Math.atan((W9 / 2 - W * 0.38) / top);
  const mid = (zf + zb) / 2 + 0.05, pane = (zb - zf) / 2 + 0.12;
  for (const s of [-1, 1]) {
    k.box(0.03, gh, pane - 0.07, s * (half + 0.012), gy, mid - pane / 2 - 0.02, glass, [0, 0, s * tilt]);
    k.box(0.03, gh, pane - 0.07, s * (half + 0.012), gy, mid + pane / 2 + 0.02, glass, [0, 0, s * tilt]);
    k.box(0.1, 0.09, 0.2, s * (W / 2 + 0.05), belt + 0.1, cabF + rakeF * 0.85, colour);
  }
  const fa = Math.atan2(H - belt - 0.04, rakeF), ba = Math.atan2(H - belt - 0.04, rakeB);
  k.box(W * 0.68, 0.025, Math.hypot(rakeF, H - belt - 0.04) * 0.86, 0, (belt + 0.04 + H) / 2 + 0.012 * Math.cos(fa), cabF + rakeF / 2 - 0.012 * Math.sin(fa), glass, [-fa, 0, 0]);
  k.box(W * 0.64, 0.025, Math.hypot(rakeB, H - belt - 0.04) * 0.86, 0, (belt + 0.04 + H) / 2 + 0.012 * Math.cos(ba), cabB - rakeB / 2 + 0.012 * Math.sin(ba), glass, [ba, 0, 0]);
  for (const z of [-hz - 0.01, hz + 0.01]) k.box(W * 0.94, 0.16, 0.14, 0, 0.44, z, P.greyDk);
  k.box(W * 0.5, 0.14, 0.04, 0, 0.62, -hz + 0.02, P.ink);
  k.box(W * 0.4, 0.1, 0.04, 0, 0.7, hz - 0.02, shade(colour, 0.7));
  for (const s of [-1, 1]) {
    k.box(0.34, 0.15, 0.04, s * W * 0.32, 0.7, -hz + 0.03, P.lit);
    k.box(0.3, 0.13, 0.04, s * W * 0.34, 0.74, hz - 0.03, '#8e2020');
    lamp.box(0.34, 0.15, 0.05, s * W * 0.32, 0.7, -hz + 0.015, '#fff1c4');
    lamp.box(0.3, 0.13, 0.05, s * W * 0.34, 0.74, hz - 0.015, '#ff3b3b');
    for (const z of [-wheelZ, wheelZ]) k.cyl(wheelR * 0.96, wheelR * 0.96, 0.2, 10, s * (W / 2 - 0.1), wheelR, z, P.tyre, [0, 0, HALF]);
  }
}
function carRig(g, k, lamp, { W, wheelZ = 1.35, wheelR = 0.32 }, dims) {
  k.into(g);
  const lampMesh = g.children.find((c) => c.material === LAMPS);
  const wheels = [-wheelZ, wheelZ].map((z) => { const a = axle(wheelR, 0.22, [-(W / 2 - 0.1), W / 2 - 0.1], wheelR, z, P.tyre, P.hub, P.slate); g.add(a); return a; });
  rolling(g, wheels, wheelR);
  g.userData.dims = dims;
  g.userData.near = [lampMesh, ...wheels];
  return g;
}

export function makeCar(colour = '#c23b32') {
  const g = new THREE.Group(), k = kit(), lamp = k.on(LAMPS);
  g.name = 'car';
  const o = { colour, L: 4.3, W: 1.8, H: 1.45, cabF: -0.85, cabB: 1.35, rakeF: 0.8, rakeB: 0.65 };
  carShell(k, lamp, o);
  return carRig(g, k, lamp, o, { len: 4.46, wid: 1.92, h: 1.5, zc: 0 });
}

// 'nyc': yellow checker cab with a roof light and a chequered band. 'tokyo': upright black (or
// maroon) Crown-style cab with a lantern on the roof and a green "for hire" light behind the glass.
export function makeTaxi(city = 'nyc', colour = city === 'tokyo' ? '#17181d' : '#f7b80f') {
  const g = new THREE.Group(), k = kit(), lamp = k.on(LAMPS);
  g.name = 'taxi';
  if (city === 'tokyo') {
    const o = { colour, L: 4.62, W: 1.72, H: 1.58, belt: 1.02, cabF: -1.15, cabB: 1.7, rakeF: 0.4, rakeB: 0.36, wheelZ: 1.4, glass: '#1c2638' };
    carShell(k, lamp, o);
    k.box(0.5, 0.1, 0.22, 0, o.H + 0.05, 0.1, '#d9d4c0');
    lamp.cyl(0.13, 0.13, 0.66, 10, 0, o.H + 0.2, 0.1, '#fff6c8', [0, 0, HALF]);
    for (const s of [-1, 1]) lamp.cyl(0.13, 0.13, 0.02, 10, s * 0.34, o.H + 0.2, 0.1, '#ffe08a', [0, 0, HALF]);
    lamp.box(0.26, 0.07, 0.03, 0.42, o.belt + 0.16, o.cabF + 0.22, '#5be37a');
    return carRig(g, k, lamp, o, { len: 4.76, wid: 1.85, h: 1.9, zc: 0 });
  }
  const o = { colour, L: 4.8, W: 1.9, H: 1.52, belt: 0.98, cabF: -0.9, cabB: 1.45, rakeF: 0.7, rakeB: 0.55, glass: P.glassDk };
  carShell(k, lamp, o);
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) k.box(0.02, 0.1, 0.2, s * 0.958, i % 2 ? 0.67 : 0.77, -1.4 + i * 0.22, P.black);
  k.box(0.8, 0.2, 0.26, 0, o.H + 0.1, 0.15, '#e9e3cc');
  lamp.box(0.7, 0.13, 0.27, 0, o.H + 0.1, 0.15, '#fff2b0');
  return carRig(g, k, lamp, o, { len: 4.94, wid: 2.05, h: 1.76, zc: 0 });
}

export function makeBus(colour = '#2b62a6') {
  const g = new THREE.Group(), k = kit(), lamp = k.on(LAMPS);
  g.name = 'bus';
  const L = 11.2, W = 2.55, H = 3.2, hz = L / 2, glass = '#1f2c40';
  k.loft([
    { z: -hz, w: W * 0.92, y0: 0.5, y1: H - 0.3 },
    { z: -hz + 0.3, w: W, y0: 0.42, y1: H },
    { z: hz - 0.2, w: W, y0: 0.42, y1: H },
    { z: hz, w: W * 0.94, y0: 0.5, y1: H - 0.12 },
  ], colour);
  k.box(W + 0.03, 0.34, L - 0.5, 0, 0.95, 0, P.white);
  k.box(W + 0.03, 0.95, L - 2.6, 0, 2.15, 0.45, glass);
  for (let z = -3.7; z <= 4.6; z += 1.4) k.box(W + 0.05, 0.95, 0.1, 0, 2.15, z, colour);
  k.box(W * 0.88, 1.5, 0.04, 0, 2.05, -hz - 0.01, glass);
  k.box(W * 0.3, 1.5, 0.05, 0, 2.05, -hz - 0.012, colour);
  for (const z of [-3.9, 1.0]) k.box(0.04, 1.9, 1.05, W / 2 + 0.01, 1.35, z, glass);
  k.box(1.7, 0.26, 3.2, 0, H + 0.13, 1.4, P.grey);
  k.box(1.1, 0.2, 1.6, 0, H + 0.1, -2.6, P.grey);
  for (const z of [-hz - 0.01, hz + 0.01]) k.box(W * 0.96, 0.26, 0.2, 0, 0.56, z, P.greyDk);
  lamp.box(W * 0.62, 0.28, 0.05, 0, H - 0.2, -hz - 0.02, '#ffb03a');
  lamp.box(W * 0.2, 0.2, 0.05, W * 0.3, 2.9, hz + 0.02, '#ff6a3a');
  for (const s of [-1, 1]) {
    lamp.box(0.34, 0.18, 0.05, s * 0.85, 0.95, -hz - 0.012, '#fff1c4');
    lamp.box(0.26, 0.2, 0.05, s * 0.95, 1.05, hz + 0.012, '#ff3b3b');
    k.box(0.34, 0.18, 0.05, s * 0.85, 0.95, -hz - 0.004, P.lit);
    for (const z of [-3.5, 2.9]) k.cyl(0.48, 0.48, 0.26, 10, s * 1.0, 0.5, z, P.tyre, [0, 0, HALF]);
  }
  k.into(g);
  const lampMesh = g.children.find((c) => c.material === LAMPS);
  const wheels = [-3.5, 2.9].map((z) => { const a = axle(0.5, 0.3, [-1.0, 1.0], 0.5, z, P.tyre, P.hub, P.slate); g.add(a); return a; });
  rolling(g, wheels, 0.5);
  g.userData.dims = { len: 11.4, wid: 2.6, h: 3.4, zc: 0 };
  g.userData.near = [lampMesh, ...wheels];
  return g;
}

// --- People
function lcg(seed) {
  let a = (seed >>> 0) || 1;
  const r = () => (a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296;
  r.pick = (l) => l[Math.floor(r() * l.length)];
  return r;
}
const SKIN = ['#f2c9a0', '#e8b48a', '#d49a6a', '#b97a4f', '#8d5a3b', '#6b4430'], SKIN_TOKYO = ['#f3d2ad', '#ecc59b', '#e6b88c', '#f0c8a2'];
const HAIR = ['#1d1a17', '#3a2a1e', '#5a3a22', '#8a5a2b', '#c9a15b', '#b8b2a8', '#7a2e22', '#2a2a30'], HAIR_TOKYO = ['#16181d', '#1d1a17', '#1d1a17', '#2a2018', '#3a2a1e', '#5a3a22'];
const COATS = ['#2b2a2e', '#3b3128', '#40362c', '#2e3a44', '#4a4540', '#5a4a3a'], SKIRTS = ['#4a2f3a', '#2f3d4a', '#5a4630', '#3a4a3a', '#6a3b3b', '#4a4a56', '#35283f'];
const TOPS = ['#e0322b', '#2f6fdb', '#3fae5a', '#ffd23f', '#ff8a3d', '#f8f6f0', '#22262e', '#ff5fa8', '#2fb5a8', '#8a97ab', '#7a5ad6'], JEANS = ['#34527f', '#2b3d5c', '#22262e', '#5a6a7a', '#7a6a4a', '#3a3f4a', '#8a97ab'];
const SUITS = ['#22262e', '#2b3d5c', '#3a3f4a', '#2e2a30'], SUIT2100 = ['#e8eef2', '#cfd8e0', '#b8c4d0', '#f0e6f5', '#d8f2ee', '#aab6c2'], NEON2100 = ['#39e6ff', '#ff3d8b', '#6dff8a', '#ffb03a'];

// One person: everything static is merged into a single body mesh; each limb is its own mesh on a
// pivot so it can swing, wave and flail. `far` is the whole person merged into one pose.
export function makePedestrian({ seed = 1, era = '2000', city = 'nyc' } = {}) {
  const r = lcg(seed * 7919 + 13);
  const tokyo = city === 'tokyo', woman = r() < 0.5, kid = r() < (era === '1900' ? 0.08 : 0.1);
  const o = {
    woman, skin: r.pick(tokyo ? SKIN_TOKYO : SKIN), hair: r.pick(tokyo ? HAIR_TOKYO : HAIR), shoe: r.pick([P.shoe, '#3a2a22', '#5a4a3a', P.ink]),
    hairStyle: woman ? r.pick(['long', 'long', 'bun', 'ponytail', 'short']) : r.pick(['short', 'short', 'short', 'ponytail']),
    sleeve: 'long', glove: null, hat: null, hatColour: P.black, pack: null, bag: null, stride: 1, trim: null, collar: null, tie: null, stache: false, glasses: false,
  };
  if (era === '1900') {
    o.glove = r() < 0.5 ? '#d9d4c4' : null;
    if (woman) {
      o.kind = 'longskirt'; o.bottom = r.pick(SKIRTS); o.top = r() < 0.5 ? o.bottom : r.pick(['#efe6d2', '#d9c9b0', '#cfd6dc']); o.hairStyle = r() < 0.6 ? 'bun' : 'long';
      o.hat = r() < 0.75 ? r.pick(['wide', 'bonnet']) : null; o.hatColour = r.pick(SKIRTS); o.stride = 0.38;
      if (r() < 0.3) o.bag = '#6a3b3b';
    } else {
      o.kind = 'coat'; o.top = o.coat = r.pick(COATS); o.bottom = r.pick(['#3a3a3e', '#4a4238', '#52504a']); o.hat = r.pick(['bowler', 'bowler', 'flat', 'top', 'flat']); o.hatColour = r() < 0.5 ? P.black : r.pick(COATS); o.stride = 0.7;
      o.stache = r() < 0.4; o.collar = '#efe6d2';
    }
  } else if (era === '2100') {
    o.top = r.pick(SUIT2100); o.bottom = r() < 0.5 ? o.top : '#39465a'; o.kind = woman && r() < 0.3 ? 'skirt' : 'pants'; o.trim = r.pick(NEON2100); o.shoe = '#e8eef2'; o.collar = o.top;
    o.hairStyle = r.pick(['short', 'sleek', 'ponytail']); o.glasses = r() < 0.5;
    if (r() < 0.3) { o.kind = 'coat'; o.coat = r.pick(SUIT2100); o.top = o.coat; o.stride = 0.7; }
  } else {
    const suit = (tokyo ? 0.36 : 0.16) > r();
    if (suit) { o.kind = woman && r() < 0.5 ? 'skirt' : 'pants'; o.top = r.pick(SUITS); o.bottom = o.kind === 'skirt' ? o.top : r.pick(SUITS); o.tie = woman ? null : r.pick(['#d6402c', '#2f6fdb', '#8a2b3a']); o.collar = '#f8f6f0'; o.bag = r() < 0.7 ? '#3a2a22' : null; }
    else {
      o.top = r.pick(TOPS); o.sleeve = r() < 0.45 ? 'short' : 'long';
      o.kind = woman ? r.pick(['skirt', 'pants', 'pants', 'shorts']) : r.pick(['pants', 'pants', 'shorts']);
      o.bottom = o.kind === 'skirt' ? r.pick(TOPS) : r.pick(JEANS); o.hat = r() < 0.25 ? r.pick(['cap', 'beanie']) : null; o.hatColour = r.pick(TOPS);
      if (r() < 0.3) o.pack = r.pick(TOPS);
      o.glasses = r() < 0.15;
    }
  }
  if (kid) o.pack = null;

  const g = new THREE.Group();
  g.name = 'pedestrian';
  const root = new THREE.Group(), rig = new THREE.Group(), nearG = new THREE.Group(), farG = new THREE.Group();
  g.add(root); root.add(rig); rig.add(nearG, farG);

  const limbs = (put) => {
    for (const s of [-1, 1]) {
      put.leg(s); put.arm(s);
    }
  };
  // Static body, with or without the limbs baked in (for the far mesh).
  const body = (k, lamp, bake) => {
    const { skin, hair, top, bottom } = o, st = { z: -0.21, w: 0.68, wt: 0.78, y0: 0.78, y1: 1.34 };
    k.loft([st, { ...st, z: 0.21 }], top);
    k.box(0.7, 0.1, 0.44, 0, 0.83, 0, o.kind === 'coat' ? o.coat : bottom);
    if (o.tie) k.box(0.1, 0.4, 0.02, 0, 1.1, -0.215, o.tie);
    if (o.collar) k.box(o.era2100 ? 0.3 : 0.26, 0.1, 0.1, 0, 1.33, -0.2, o.collar);
    k.cyl(0.12, 0.12, 0.1, 10, 0, 1.36, 0, skin);
    k.cyl(0.27, 0.27, 0.34, 16, 0, 1.51, 0, skin);
    for (const s of [-1, 1]) { k.box(0.05, 0.09, 0.05, s * 0.1, 1.55, -0.245, P.ink); k.box(0.028, 0.03, 0.04, s * 0.07, 1.447, -0.256, P.mouth); }
    k.box(0.1, 0.028, 0.04, 0, 1.43, -0.262, P.mouth);
    k.box(0.04, 0.06, 0.05, 0, 1.49, -0.275, shade(skin, 0.9));
    if (o.stache) k.box(0.2, 0.045, 0.04, 0, 1.465, -0.28, hair);
    if (o.glasses) k.box(0.4, 0.07, 0.05, 0, 1.55, -0.27, o.trim || P.ink);
    const hatted = o.hat === 'cap' || o.hat === 'beanie' || o.hat === 'bowler' || o.hat === 'flat' || o.hat === 'top';
    if (!hatted) { k.cyl(0.285, 0.285, 0.12, 16, 0, 1.7, 0, hair); k.box(0.42, 0.07, 0.06, 0, 1.665, -0.245, hair); }
    k.box(0.56, hatted ? 0.16 : 0.3, 0.14, 0, hatted ? 1.47 : 1.56, 0.2, hair);
    if (!hatted) for (const s of [-1, 1]) k.box(0.06, 0.2, 0.3, s * 0.28, 1.6, 0.05, hair);
    if (o.hairStyle === 'long') { k.box(0.54, 0.62, 0.1, 0, 1.3, 0.27, hair); for (const s of [-1, 1]) k.box(0.06, 0.5, 0.2, s * 0.29, 1.36, 0.12, hair); }
    if (o.hairStyle === 'bun') k.sph(0.15, 0, 1.78, 0.24, hair, null, null, 8, 6);
    if (o.hairStyle === 'ponytail') k.box(0.12, 0.46, 0.12, 0, 1.4, 0.34, hair, [-0.25, 0, 0]);
    switch (o.hat) {
      case 'bowler': k.dome(0.3, 0, 1.66, 0, o.hatColour, null, [1, 0.8, 1]); k.cyl(0.4, 0.4, 0.03, 14, 0, 1.665, 0, o.hatColour); break;
      case 'top': k.cyl(0.22, 0.24, 0.4, 12, 0, 1.9, 0, o.hatColour); k.cyl(0.36, 0.36, 0.03, 14, 0, 1.7, 0, o.hatColour); break;
      case 'flat': k.dome(0.31, 0, 1.64, 0, o.hatColour, null, [1, 0.5, 1]); k.box(0.36, 0.03, 0.22, 0, 1.655, -0.34, o.hatColour, [-0.1, 0, 0]); break;
      case 'wide': k.cyl(0.2, 0.22, 0.2, 12, 0, 1.78, 0, o.hatColour); k.cyl(0.46, 0.46, 0.03, 16, 0, 1.68, 0, o.hatColour); k.box(0.42, 0.05, 0.42, 0, 1.76, 0, shade(o.hatColour, 1.8), [0, 0.8, 0]); break;
      case 'bonnet': k.dome(0.31, 0, 1.64, 0, o.hatColour, null, [1, 0.7, 1.05]); k.box(0.44, 0.04, 0.2, 0, 1.64, -0.34, o.hatColour, [-0.2, 0, 0]); break;
      case 'cap': k.dome(0.3, 0, 1.64, 0, o.hatColour, null, [1, 0.55, 1]); k.box(0.36, 0.03, 0.3, 0, 1.655, -0.33, o.hatColour, [-0.12, 0, 0]); break;
      case 'beanie': k.dome(0.3, 0, 1.64, 0, o.hatColour, null, [1, 0.8, 1]); k.cyl(0.3, 0.3, 0.07, 14, 0, 1.62, 0, shade(o.hatColour, 0.8)); break;
    }
    if (o.pack) k.box(0.46, 0.5, 0.18, 0, 1.08, 0.31, o.pack);
    switch (o.kind) {
      case 'longskirt': k.prism(0.25, 0.42, 0.86, 10, 0, 0.55, 0, bottom, null, [1, 1, 0.85]); break;
      case 'skirt': k.prism(0.3, 0.4, 0.3, 10, 0, 0.82, 0, bottom, null, [1, 1, 0.85]); break;
      case 'coat': { const w = { z: -0.25, w: 0.82, wt: 0.76, y0: 0.4, y1: 1.0 }; k.loft([w, { ...w, z: 0.25 }], o.coat); break; }
    }
    if (o.trim) {
      lamp.box(0.7, 0.05, 0.46, 0, 0.88, 0, o.trim); lamp.box(0.05, 0.4, 0.02, -0.2, 1.12, -0.215, o.trim); lamp.box(0.05, 0.4, 0.02, 0.2, 1.12, -0.215, o.trim);
      lamp.box(0.42, 0.06, 0.05, 0, 1.55, -0.27, o.trim);
    }
    if (bake) limbs({ leg: (s) => leg(k, s * 0.17, 0.78), arm: (s) => arm(k, s * 0.47, 1.3, s) });
  };
  const leg = (k, ox, oy) => {
    const { skin, bottom } = o;
    if (o.kind === 'shorts') { k.box(0.33, 0.3, 0.35, ox, oy - 0.15, 0, bottom); k.box(0.27, 0.34, 0.3, ox, oy - 0.47, 0, skin); }
    else if (o.kind === 'skirt' && o.era !== '1900' && !o.suited) k.box(0.28, 0.64, 0.3, ox, oy - 0.32, 0, o.legColour);
    else k.box(0.32, 0.64, 0.34, ox, oy - 0.32, 0, o.kind === 'longskirt' ? bottom : o.kind === 'coat' && o.era2100 ? o.coat : bottom);
    k.box(0.34, 0.16, 0.46, ox, oy - 0.7, -0.06, o.shoe);
    if (o.trim && o.era2100) k.box(0.04, 0.5, 0.2, ox + Math.sign(ox) * 0.17, oy - 0.3, 0, o.trim);
  };
  const arm = (k, ox, oy, s) => {
    const { skin, top } = o;
    const sleeve = o.kind === 'coat' && !o.era2100 ? o.coat : top;
    if (o.sleeve === 'short') { k.box(0.2, 0.24, 0.24, ox, oy - 0.12, 0, sleeve); k.box(0.17, 0.3, 0.2, ox, oy - 0.39, 0, skin); }
    else k.box(0.2, 0.5, 0.24, ox, oy - 0.26, 0, sleeve);
    k.cyl(0.1, 0.1, 0.13, 8, ox, oy - 0.56, 0, o.glove || skin);
    if (o.trim && o.era2100) k.box(0.03, 0.46, 0.14, ox + Math.sign(ox) * 0.11, oy - 0.26, 0, o.trim);
    if (s > 0 && o.bag) k.box(0.34, 0.28, 0.1, ox + 0.04, oy - 0.78, 0, o.bag);
  };
  o.era = era; o.era2100 = era === '2100'; o.suited = !!o.tie || o.top === o.bottom;
  o.legColour = o.skin;
  const mk = () => { const k = kit(); return [k, k.on(LAMPS)]; };
  { const [k, lamp] = mk(); body(k, lamp, false); k.into(nearG); }
  { const [k, lamp] = mk(); body(k, lamp, true); k.into(farG); }
  farG.visible = false;
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(), k = kit(); p.position.set(s * 0.17, 0.78, 0); leg(k, 0, 0); rig.add(k.into(p)); return p; });
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(), k = kit(); p.position.set(s * 0.47, 1.3, 0); arm(k, 0, 0, s); rig.add(k.into(p)); return p; });
  const sx = (kid ? 0.68 : 0.95 + r() * 0.1) * (0.94 + r() * 0.12), sy = kid ? 0.68 : 0.93 + r() * 0.14;
  g.scale.set(sx, sy, sx);

  const tick = ticker();
  let ph = r() * 6, amp = 0, wave = 0, dive = 0, side = 1;
  g.userData.animate = (t, speed = 0, ex) => {
    const dt = tick(t), k1 = Math.min(1, dt * 10);
    const dv = ex && ex.dive ? ex.dive : 0;
    if (dv) side = dv < 0 ? -1 : 1;
    amp += (Math.min(1, speed / 1.1) - amp) * k1;
    wave += ((ex && ex.wave ? 1 : 0) - wave) * Math.min(1, dt * 7);
    dive += ((dv ? 1 : 0) - dive) * Math.min(1, dt * (dv ? 14 : 6));
    ph += dt * (3.2 + speed * 1.8);
    const gait = 1 - dive * 0.8, sw = Math.sin(ph) * amp * gait, idle = Math.sin(t * 2.2) * (1 - amp);
    legs[0].rotation.x = sw * 0.9 * o.stride + dive * 0.7;
    legs[1].rotation.x = -sw * 0.9 * o.stride - dive * 0.3;
    arms[0].rotation.x = -sw * 0.85 + dive * 2.4;
    arms[1].rotation.x = (sw * 0.85 + dive * 2.4) * (1 - wave) + wave * 2.8;
    arms[0].rotation.z = -(0.05 + idle * 0.03 + dive * 0.5);
    arms[1].rotation.z = 0.05 + idle * 0.03 + dive * 0.5 * (1 - wave) + wave * (0.45 + Math.sin(t * 10) * 0.35);
    rig.position.y = Math.abs(Math.sin(ph)) * 0.05 * amp * gait + idle * 0.012;
    root.rotation.z = -side * dive * 1.4;
    root.position.y = Math.sin(Math.min(1, dive) * Math.PI) * 0.35;
  };
  g.userData.animate(0, 0);
  g.userData.dims = { len: 0.6, wid: 0.6, h: 1.8 * sy, zc: 0 };
  g.userData.near = [nearG, ...legs, ...arms];
  g.userData.far = [farG];
  return g;
}

// --- Final boss ---------------------------------------------------------------
// A ~55 m toy kaiju: teal hide, cream belly, glowing violet dorsal plates, small arms, a thick tail.
// Origin between the feet, facing -Z. userData: head, mouth, tailTip (world anchors), weakPoints (Object3Ds
// with userData.radius, the glowing chest gem and two back plates), hitboxes ([{ node, r }] spheres that follow
// the animation), feet, steps (counts footfalls; lastStep is the foot that landed), height.
//   animate(t, speed, { roar, breath, hurt, frozen, swipe, aimYaw, aimPitch })
//     roar/breath/hurt/frozen 0..1; swipe -1..1 swings the tail; aimYaw/aimPitch turn the head (radians).
export function makeKaiju() {
  const g = new THREE.Group();
  g.name = 'kaiju';
  const C = { skin: '#437a69', skinDk: '#2a4f48', belly: '#ecd9a6', bellyDk: '#e0cb96', bone: '#f4ecd2', plate: '#b06cff', eye: '#ffd23a', mouth: '#7a1f3d', ink: '#1a1f27' };
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  const plateMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#8a3dff', emissiveIntensity: 0.6 });
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#ff6fe0' });
  const throatMat = new THREE.MeshBasicMaterial({ color: '#ff5fb0' });
  const H = 20.5, L1 = 11.6, L2 = 11.2, ANKLE = 1.4, STEP = 5, LIFT = 3.2;

  const pivot = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const hitboxes = [], weakPoints = [];
  const hitbox = (parent, x, y, z, r) => { hitboxes.push({ node: pivot(parent, x, y, z), r }); };
  const weak = (parent, x, y, z, r) => { const n = pivot(parent, x, y, z); n.userData.radius = r; weakPoints.push(n); return n; };
  // A dorsal plate: a triangle in the y-z plane (apex leaning back), extruded along x, tilted about x.
  const plate = (api, x, y, z, w, h, tilt, c = C.plate, d = 1.5) => api.extrude([[-w / 2, 0], [w * 0.14, h], [w / 2, 0]], d, x + d / 2, y, z, c, [tilt, -HALF, 0]);

  const pelvis = pivot(g, 0, H, 0);
  const pk = kit(), pb = pk.on(bodyMat);
  pb.sph(6.4, 0, 0.5, 1.4, C.skin, null, [1.15, 0.92, 1.05]);
  pk.into(pelvis);
  hitbox(pelvis, 0, 1, 1.5, 9);

  // Torso, neck and the back: leans forward from the hips.
  const spine = pivot(pelvis, 0, 2.5, 0);
  spine.rotation.x = -0.32;
  const sk = kit(), sb = sk.on(bodyMat), sp = sk.on(plateMat), sc = sk.on(coreMat);
  sb.sph(9.3, 0, 9, 0.4, C.skin, null, [0.96, 1.12, 0.92], 12, 9);
  sb.sph(7.7, 0, 8.2, -3.4, C.belly, null, [0.88, 1.05, 0.5]);
  sb.sph(7.6, 0, 16.6, -0.5, C.skin, null, [1.22, 0.86, 0.96]);
  sb.sph(4.8, 0, 21.8, -3, C.skin, null, [1, 1.25, 1]);
  for (const [y, z, w, h, tilt, core] of [[22.4, 3.6, 3.6, 4.4, 0.75], [19.2, 7, 5, 6.2, 0.6], [15.8, 8.5, 6.4, 8.6, 0.48, true], [12, 9.2, 6.6, 7.4, 0.36], [8.6, 9.4, 7, 9.6, 0.3, true], [5, 8.5, 6, 6.6, 0.24], [1.8, 6.9, 4.6, 5, 0.2]]) plate(core ? sc : sp, 0, y, z, w * 1.25, h * 1.3, tilt, core ? '#ffb0ee' : C.plate);
  sc.geo(new THREE.OctahedronGeometry(2.7), true, 0, 14.4, -8.1, '#ffb0ee', null, [1, 1.45, 0.85]);
  sb.sph(1.0, 0, 14.4, -7.3, C.ink, null, [2.1, 2.2, 0.5], 8, 6);
  sk.into(spine);
  hitbox(spine, 0, 15, -1.2, 10); hitbox(spine, 0, 6.5, -0.5, 9);
  weak(spine, 0, 14.4, -8.6, 3.6); weak(spine, 0, 20.2, 9.2, 3.8); weak(spine, 0, 12.2, 11.2, 3.8);

  // Head: boxy snout, glowing eyes, horns, teeth; the lower jaw swings on its own pivot.
  const head = pivot(spine, 0, 25.2, -4.4);
  head.scale.setScalar(1.25);
  const hk = kit(), hb = hk.on(bodyMat), he = hk.on(eyeMat);
  hb.sph(5.3, 0, 0.5, 0.6, C.skin, null, [1.02, 0.92, 1.05], 10, 8);
  hb.loft([{ z: 0.5, w: 8.6, wt: 7.2, y0: -3.2, y1: 3.4 }, { z: -5.5, w: 6.8, wt: 5.8, y0: -2.7, y1: 2.9 }, { z: -11.4, w: 5.2, wt: 4.6, y0: -2.3, y1: 2 }], C.skin);
  hb.sph(2.7, 0, -0.1, -11.3, C.skin, null, [1, 0.78, 0.8], 8, 6);
  hb.box(7, 0.3, 11, 0, -2.5, -5.5, C.mouth);
  for (const s of [-1, 1]) {
    he.sph(1, s * 3.3, 1.9, -4.8, C.eye, [0, 0, s * -0.35], [1.15, 0.55, 0.8], 8, 6);
    hb.box(3.6, 0.9, 2.4, s * 3.2, 2.75, -4.7, C.skinDk, [0, 0, s * 0.6]);
    hb.sph(0.5, s * 1.1, 1.4, -11, C.ink, null, null, 6, 5);
    hb.cyl(0, 1.1, 4.6, 6, s * 2.3, 4.8, 2.2, C.bone, [0.9, 0, s * -0.25]);
    hb.cyl(0, 0.8, 3, 5, s * 4.9, 0.4, 0.6, C.bone, [0.7, 0, s * -1.1]);
    for (let i = 0; i < 5; i++) { const z = -3.2 - i * 1.6; hb.cyl(0.5, 0, 1.3, 4, s * (3.4 - i * 0.28), -2.9 - (i > 2 ? 0 : 0.3) + (i * 0.1), z, C.bone); }
  }
  hk.into(head);
  const throat = new THREE.Mesh(clean(new THREE.SphereGeometry(2.7, 12, 8), false), throatMat);
  throat.position.set(0, -3.4, -2.6); throat.scale.set(1.05, 0.8, 1.3); head.add(throat);
  const jaw = pivot(head, 0, -2.6, -0.8);
  const jk = kit(), jb = jk.on(bodyMat);
  jb.loft([{ z: 4.6, w: 7, y0: -1.5, y1: 0.3 }, { z: -3.5, w: 6, y0: -2, y1: 0.3 }, { z: -9.8, w: 3.9, y0: -1.5, y1: 0.2 }], C.skin);
  jb.box(5.2, 0.3, 10.5, 0, 0.35, -2.5, C.mouth);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) jb.cyl(0, 0.42, 1.1, 4, s * (2.1 - i * 0.2), 0.9, -3.4 - i * 1.6, C.bone);
  jk.into(jaw);
  const mouth = pivot(head, 0, -1.8, -10.4);
  hitbox(head, 0, 0, -3.5, 8);

  // Arms: small, bent forward, three claws each.
  const arms = [-1, 1].map((s) => {
    const a = pivot(spine, s * 8.4, 16.2, -4.6), k = kit(), b = k.on(bodyMat);
    b.sph(2.5, 0, 0, 0, C.skin);
    b.cyl(1.5, 2.1, 5.5, 8, 0, -2.75, 0, C.skin);
    b.sph(1.5, 0, -5.5, 0, C.skin, null, null, 8, 6);
    b.cyl(1.2, 1.6, 4.6, 8, 0, -6.93, -1.8, C.skin, [0.9, 0, 0]);
    b.sph(1.8, 0, -8.5, -3.7, C.skin, null, null, 8, 6);
    for (const x of [-0.9, 0, 0.9]) b.cyl(0.5, 0, 1.9, 5, x, -9.3, -4.7, C.bone, [0.9, 0, 0]);
    k.into(a);
    return a;
  });

  // Legs: thigh, shin and foot on pivots, solved with two-bone IK each frame so planted feet stay planted.
  const legs = [-1, 1].map((s, i) => {
    const hip = pivot(pelvis, s * 6.2, 0, 0.5), shin = pivot(hip, 0, -L1, 0), foot = pivot(shin, 0, -L2, 0);
    const tk = kit(), tb = tk.on(bodyMat);
    tb.sph(4.6, 0, 0, 0, C.skin);
    tb.cyl(3.9, 2.9, L1, 8, 0, -L1 / 2, 0, C.skin);
    tb.sph(4.1, 0, -4, 1.3, C.skin, null, [1, 1.3, 1]);
    tb.sph(3.1, 0, -L1, 0, C.skin);
    tk.into(hip);
    const sk2 = kit(), sb2 = sk2.on(bodyMat);
    sb2.cyl(2.9, 1.8, L2, 8, 0, -L2 / 2, 0, C.skin);
    sb2.sph(2.7, 0, -3, 1.2, C.skin, null, [1, 1.3, 1]);
    sb2.sph(2, 0, -L2, 0, C.skin);
    sk2.into(shin);
    const fk = kit(), fb = fk.on(bodyMat);
    fb.loft([{ z: 3, w: 4.2, y0: -ANKLE, y1: 1.2 }, { z: -3, w: 5.6, y0: -ANKLE, y1: 0.6 }, { z: -6.5, w: 5.2, y0: -ANKLE, y1: -0.2 }], C.skin);
    for (const x of [-1.7, 0, 1.7]) fb.cyl(0, 0.75, 2.4, 5, x, -0.5, -7.6, C.bone, [-HALF, 0, 0]);
    fk.into(foot);
    hitbox(hip, 0, -5, 0.5, 6.4);
    return { hip, shin, foot, s, i, prev: 0 };
  });

  // Tail: five tapering segments, each pivoting on the one before.
  const TAIL = [[5, 4, 9, 0.5], [4, 3, 9, -0.08], [3, 2, 8, -0.12], [2, 1, 8, -0.18], [1, 0.3, 7, -0.22]];
  const tail = [];
  let parent = pivot(pelvis, 0, -2.5, 4.4);
  TAIL.forEach(([r0, r1, len, droop], i) => {
    const seg = pivot(parent, 0, 0, i ? TAIL[i - 1][2] : 0);
    seg.userData.droop = droop;
    const k = kit(), b = k.on(bodyMat), p = k.on(plateMat);
    b.cyl(r1, r0, len, 8, 0, 0, len / 2, C.skin, [HALF, 0, 0]);
    b.sph(r0, 0, 0, 0, C.skin, null, null, 8, 6);
    if (i < 4) for (const f of [0.28, 0.72]) plate(p, 0, r0 + (r1 - r0) * f - 0.1, len * f, 3.6 - i * 0.55, 4.4 - i * 0.75, 0.5);
    k.into(seg);
    if (i && i < 4) hitbox(seg, 0, 0, len / 2, r0 + 1.6);
    if (i === 0) hitbox(seg, 0, 0, 5, 6);
    tail.push(seg); parent = seg;
  });
  const tailTip = pivot(parent, 0, 0, TAIL[4][2]);

  g.userData = { ...g.userData, head, mouth, tailTip, weakPoints, hitboxes, feet: legs.map((l) => l.foot), steps: 0, lastStep: 0, height: 55 };

  const tick = ticker();
  const frostCol = new THREE.Color(), violet = new THREE.Color('#8a3dff'), hot = new THREE.Color('#ff3fb8'), icy = new THREE.Color('#7fd8ff'), pink = new THREE.Color('#ff6fe0'), throatBase = new THREE.Color('#ff5fb0');
  const S = { amp: 0, s0: 0, roar: 0, breath: 0, hurt: 0, frozen: 0, swipe: 0, yaw: 0, pitch: 0 };
  const ease = (u) => u * u * (3 - 2 * u);
  const idleF = [1.4, -1.4];
  const solve = (leg, F, D, toe) => {
    const d = Math.min(L1 + L2 - 0.02, Math.max(Math.abs(L1 - L2) + 0.02, Math.hypot(F, D)));
    const phi = Math.atan2(F, D);
    const a = phi + Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const b = phi - Math.acos(THREE.MathUtils.clamp((L2 * L2 + d * d - L1 * L1) / (2 * L2 * d), -1, 1));
    leg.hip.rotation.x = a; leg.shin.rotation.x = b - a; leg.foot.rotation.x = -b + toe;
  };
  g.userData.animate = (t, speed = 0, ex = {}) => {
    const dt = tick(t), k = (r) => 1 - Math.exp(-r * dt);
    S.roar += ((ex.roar || 0) - S.roar) * k(9); S.breath += ((ex.breath || 0) - S.breath) * k(7);
    S.hurt += ((ex.hurt || 0) - S.hurt) * k(14); S.frozen += ((ex.frozen || 0) - S.frozen) * k(6);
    S.swipe += ((ex.swipe || 0) - S.swipe) * k(16);
    S.yaw += ((ex.aimYaw || 0) - S.yaw) * k(5); S.pitch += ((ex.aimPitch || 0) - S.pitch) * k(5);
    const live = 1 - 0.9 * S.frozen;
    S.amp += (THREE.MathUtils.clamp(speed / 1.5, 0, 1) - S.amp) * k(5);
    if (speed > 0.05) S.s0 = (S.s0 + dt * 0.6 * speed / (2 * STEP)) % 1;
    const tw = Math.PI * 2 * S.s0, amp = S.amp;

    pelvis.position.y = H - 0.45 * amp + Math.cos(tw * 2) * 0.55 * amp + Math.sin(t * 1.5) * 0.12 * live - S.hurt * 0.6;
    pelvis.position.x = -Math.sin(tw) * 0.9 * amp;
    spine.rotation.x = -0.32 + Math.sin(t * 1.5) * 0.012 * live + S.roar * 0.3 + S.breath * 0.1 + S.hurt * 0.14;
    spine.rotation.y = -Math.sin(tw) * 0.08 * amp;
    spine.rotation.z = Math.sin(tw) * 0.035 * amp;

    head.rotation.set(S.pitch + S.roar * 0.5 + S.breath * 0.22 - S.hurt * 0.2 + Math.sin(t * 1.1) * 0.03 * live, S.yaw, 0);
    jaw.rotation.x = -(S.roar * 0.62 + S.breath * 0.42 + S.hurt * 0.18 + 0.05 + Math.sin(t * 2) * 0.02 * live);
    pelvis.rotation.set(-S.hurt * 0.03, Math.sin(tw) * 0.05 * amp, S.roar * Math.sin(t * 46) * 0.04);

    arms[0].rotation.set(0.7 + Math.sin(tw) * 0.28 * amp - S.roar * 0.55, 0, -(0.12 + S.roar * 0.7 + Math.sin(t * 1.3) * 0.03 * live));
    arms[1].rotation.set(0.7 - Math.sin(tw) * 0.28 * amp - S.roar * 0.55, 0, 0.12 + S.roar * 0.7 + Math.sin(t * 1.3 + 1) * 0.03 * live);

    for (const leg of legs) {
      const s = (S.s0 + leg.i * 0.5) % 1, stance = s < 0.6, u = stance ? s / 0.6 : (s - 0.6) / 0.4;
      if (s < leg.prev - 0.5 && amp > 0.3) { g.userData.steps++; g.userData.lastStep = leg.i; }
      leg.prev = s;
      const F = idleF[leg.i] + ((stance ? STEP * (1 - 2 * u) : STEP * (-1 + 2 * ease(u))) - idleF[leg.i]) * amp;
      const lift = stance ? 0 : LIFT * Math.sin(Math.PI * u) * amp;
      const toe = amp * (stance ? -0.4 * ease(THREE.MathUtils.clamp((u - 0.7) / 0.3, 0, 1)) : -0.2 * Math.sin(Math.PI * u) + 0.12 * ease(THREE.MathUtils.clamp((u - 0.7) / 0.3, 0, 1)));
      solve(leg, F, pelvis.position.y - ANKLE - lift, toe);
      leg.hip.rotation.z = leg.s * 0.05;
    }

    let yaw = S.swipe;
    tail.forEach((seg, i) => {
      const sway = Math.sin(t * 1.4 - i * 0.8) * (0.07 + 0.03 * amp) * live + Math.sin(tw - i * 0.5) * 0.05 * amp;
      seg.rotation.set(seg.userData.droop - S.hurt * 0.1 + (i === 0 ? S.roar * 0.1 : 0), sway + yaw * [0.55, 0.45, 0.35, 0.25, 0.2][i], 0);
    });

    frostCol.setRGB(1 - 0.38 * S.frozen, 1 - 0.18 * S.frozen, 1);
    bodyMat.color.copy(frostCol);
    const f = S.hurt * 0.45;
    bodyMat.emissive.setRGB(f + 0.11 * S.frozen, f + 0.25 * S.frozen, f + 0.42 * S.frozen);
    plateMat.emissive.copy(violet).lerp(hot, S.breath).lerp(icy, S.frozen);
    plateMat.emissiveIntensity = (0.5 + 1.7 * S.breath + 0.2 * Math.sin(t * 3)) * (1 - 0.4 * S.frozen);
    coreMat.color.copy(pink).lerp(icy, S.frozen * 0.7).multiplyScalar(0.95 + 0.3 * Math.sin(t * 5) + S.breath * 0.5);
    throatMat.color.copy(throatBase).lerp(icy, S.frozen).multiplyScalar(0.3 + 1.5 * S.breath + S.roar * 0.4);
  };
  g.userData.animate(0, 0);
  g.userData.animate(0.05, 0);
  return g;
}

// The mayor's office: a civic dome with a flag and a gold light column, sized to stand on a tower's
// top tier (12 m across). Origin at the roof. animate(t, 0, { alarm, fall }): alarm 0..1 flashes the
// column red, fall 0..1 slumps the dome (the kaiju got there).
export function makeCityHall() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.name = 'cityHall';
  g.add(body);
  const stone = '#efe6cf', stoneDk = '#cdbf9c', green = '#4bb39a';
  const k = kit(), lit = k.on(glow('#ffe9a8', 0.9));
  k.box(11.8, 1.4, 11.8, 0, 0.7, 0, stoneDk);
  k.box(10.8, 0.5, 10.8, 0, 1.65, 0, stone);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12, x = Math.cos(a) * 4.9, z = Math.sin(a) * 4.9;
    k.cyl(0.38, 0.42, 3.4, 8, x, 3.9, z, stone);
    k.cyl(0.55, 0.55, 0.3, 8, x, 2.05, z, stoneDk);
  }
  k.cyl(5.5, 5.6, 0.55, 24, 0, 5.85, 0, stoneDk);
  k.cyl(4.1, 4.4, 2.2, 24, 0, 7.2, 0, stone);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + TAU / 16; k.box(0.6, 1.1, 0.14, Math.cos(a) * 4.25, 7.3, Math.sin(a) * 4.25, P.glassDk, [0, -a - HALF, 0]); }
  k.dome(4.3, 0, 8.3, 0, green, null, [1, 1.05, 1], 24, 8);
  k.cyl(4.4, 4.4, 0.28, 24, 0, 8.35, 0, P.gold);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; k.box(0.14, 0.14, 4.4, Math.cos(a) * 2.2, 10.5, Math.sin(a) * 2.2, P.gold, [0.52, -a - HALF, 0]); }
  k.cyl(0.95, 1.1, 1.3, 10, 0, 12.9, 0, stone);
  k.dome(1.1, 0, 13.5, 0, P.gold, null, null, 10, 5);
  k.cyl(0.07, 0.1, 8.5, 6, 0, 17.6, 0, P.white);
  lit.sph(0.3, 0, 22, 0, null, null, null, 8, 6);
  k.into(body);

  const geo = bannerGeo(3.2, 1.9, 1, 3, '#e0322b', P.white), p = geo.attributes.position, FH = 1.9;
  const flag = new THREE.Mesh(geo, cached('banner', () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.8 })));
  flag.position.set(1.65, 21.5, 0);
  body.add(flag);

  const BH = 110;
  const col = new THREE.Mesh(fade(new THREE.CylinderGeometry(0.8, 2.4, BH, 16, 1, true).translate(0, BH / 2 + 22, 0), (x, y) => Math.pow(Math.max(0, 1 - (y - 22) / BH), 0.8)), additive('#ffd66b', 0.26, true));
  g.add(col);
  const base = new THREE.Color('#ffd66b'), alert = new THREE.Color('#ff4b4b');
  g.userData.beam = col;
  g.userData.animate = (t, speed = 0, ex = {}) => {
    const alarm = ex.alarm || 0, fall = ex.fall || 0;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.2 + t * 3.2) * 0.22 * (p.getX(i) + 1.6) / 3.2);
    p.needsUpdate = true;
    col.material.color.copy(base).lerp(alert, alarm * (0.5 + 0.5 * Math.sin(t * 9)));
    col.material.opacity = (0.26 + Math.sin(t * 2.4) * 0.03 + alarm * 0.1) * (1 - fall);
    body.rotation.z = fall * 0.28; body.position.y = -fall * 5; body.scale.y = 1 - fall * 0.35;
  };
  g.userData.animate(0);
  return g;
}
