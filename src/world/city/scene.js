import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PALETTE, SKY, KIT, WORLD, WINDOW } from './bible.js';
import { buildCity } from './build.js';
import { makeWater } from './water.js';
import { skyColours, makeSky, makeSea, makeHarbours, makeFarShores } from './horizon.js';
import { DEFAULT_LOOK, GLOW, paletteFor, lookFor } from './looks.js';
import { DEFAULT_TIME, DEFAULT_WEATHER, timeFor, weatherFor } from './conditions.js';

// One of two three.js files in the city (water.js is the other): draws whatever build.js returns. Kit parts render as
// stand-in primitives until public/city/kit.glb replaces them (same names, same origins:
// a part's origin is the centre of its footprint at its base).
// Night-lane rows ship with the bundle; build.js re-validates each one. `overrides` are
// rows the player reshaped live (see ../city/reshape.js); they win over the bundled rows.
const FILL = import.meta.glob('./fill/*.json', { eager: true, import: 'default' });

export function buildManhattan({ overrides = {}, look = DEFAULT_LOOK, time = DEFAULT_TIME, weather = DEFAULT_WEATHER, kit = true, ...options } = {}) {
  const fillFor = (brief) => overrides[brief.id] || FILL[`./fill/${brief.id}.json`] || null;
  const T = timeFor(time), Wx = weatherFor(weather), palette = paletteFor(look);
  const city = buildCity({ fillFor, look, lit: T.lit, ...options });
  const scene = new THREE.Scene();
  const haze = new THREE.Color(0xb8c0c8);
  const glow = lookFor(look).skyGlow;
  const fogColour = new THREE.Color(T.fog).lerp(haze, Wx.tint);
  if (glow) fogColour.lerp(new THREE.Color(glow[0]), glow[1] * (1 - T.lit * 0.2));
  scene.background = new THREE.Color(T.background).lerp(fogColour, Wx.tint * 1.4);
  if (glow) scene.background.lerp(new THREE.Color(glow[0]), glow[2] ?? glow[1]);
  if (Wx.sky) { fogColour.lerp(new THREE.Color(Wx.sky[0]), Wx.sky[1] * (1 - T.lit)); scene.background.lerp(new THREE.Color(Wx.sky[0]), Wx.sky[1] * (1 - T.lit)); }
  scene.fog = new THREE.FogExp2(fogColour, T.fogDensity * Wx.fog);
  // The sky is a gradient dome (horizon = fog colour, zenith = the old flat sky colour pushed deeper); the clear colour is the horizon.
  const sky = skyColours(scene.background, fogColour);
  scene.background = sky.horizon;
  scene.add(makeSky(sky));
  scene.add(new THREE.HemisphereLight(...T.hemi));
  const sun = new THREE.DirectionalLight(new THREE.Color(T.sun[0]).lerp(new THREE.Color(0xffd29a), Wx.heat || 0), T.sun[1] * (Wx.particles || Wx.fog > 1 ? 0.7 : 1) * (1 + (Wx.heat || 0))); sun.position.set(...T.sun[2]); scene.add(sun);

  const materials = {};
  const mat = (name) => materials[name] ||= makeMaterial(name, palette, Wx.wet);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  const instance = (geometry, material, records, place) => {
    if (!records.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    records.forEach((r, i) => { place(r); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); scene.add(mesh);
    return mesh;
  };
  for (const [name, list] of Object.entries(city.boxes)) {
    const mesh = instance(unit, mat(name), list, (r) => { dummy.position.set(r[0], r[1], r[2]); dummy.rotation.set(0, 0, 0); dummy.scale.set(r[3], r[4], r[5]); });
    if (mesh && FACADE.test(name)) {
      const win = new Float32Array(list.length * 4);
      list.forEach((r, i) => win.set([r[6] ?? 0, r[7] ?? 0, r[8] ?? 0, r[9] ?? 0], i * 4));
      mesh.geometry = unit.clone();   // the window attribute is per mesh; the unit box is shared
      mesh.geometry.setAttribute('aWin', new THREE.InstancedBufferAttribute(win, 4));
    }
  }

  const byPart = new Map();
  for (const p of city.parts) (byPart.get(p.part) || byPart.set(p.part, []).get(p.part)).push(p);
  const partMeshes = new Map();
  for (const [name, list] of byPart) {
    const { geometry, material } = standIn(name, mat);
    partMeshes.set(name, instance(geometry, material, list, (p) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.rot * Math.PI / 2, 0); dummy.scale.set(p.sx, name === 'spire' ? p.h / 31 : 1, p.sz); }));
  }
  // The Blender kit replaces the stand-ins when it arrives; instances and matrices stay.
  const kitMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  if (kit) new GLTFLoader().load('/city/kit.glb', (g) => {
    g.scene.traverse((o) => {
      const mesh = o.isMesh && partMeshes.get(o.name);
      if (!mesh) return;
      mesh.geometry.dispose(); mesh.geometry = o.geometry; mesh.material = kitMaterial; mesh.computeBoundingSphere();
    });
  }, undefined, () => { /* stand-ins stay */ });

  // Manhattan is an island: ground between the two shorelines, the Hudson west of the bridge
  // tower, the East River past the last avenue. Past its tips and the rivers' far edges the water
  // goes on to the horizon (horizon.js), with the far banks across each river.
  const [west, east] = SHORE, zMid = (WORLD.z[0] + WORLD.z[1]) / 2, half = ISLAND_LENGTH / 2, riverDepth = 1400, riverWidth = 700;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(east - west, ISLAND_LENGTH), mat('asphalt'));
  ground.rotation.x = -Math.PI / 2; ground.position.set((west + east) / 2, -0.03, zMid); scene.add(ground);
  const light = {
    colour: palette.water, fogColour, skyColour: sky.zenith, weather: Wx, lit: T.lit, glow: glow?.[0],
    sunDirection: sun.position, sunColour: sun.color.clone().multiplyScalar(sun.intensity), hemi: T.hemi,
  };
  const waters = [[west - riverWidth, west, 1], [east, east + riverWidth, -1]].map(([from, to, quay]) => {
    const river = makeWater({ ...light, width: to - from, depth: riverDepth, quay });
    river.mesh.position.set((from + to) / 2, -0.2, zMid); scene.add(river.mesh);
    return river;
  });
  const harbours = makeHarbours(light, { span: east - west, north: zMid - half, south: zMid + half });
  const sea = makeSea(light, { x: [-2000, 2000], z: [zMid - 2300, zMid + 2300], foci: { x: [west - riverWidth, west, east, east + riverWidth], z: [zMid - half, zMid + half, zMid - riverDepth / 2, zMid + riverDepth / 2] } });
  for (const w of [...harbours, sea]) scene.add(w.mesh);
  waters.push(...harbours, sea);
  for (const m of makeFarShores({ palette, look, fog: fogColour, lit: T.lit, shore: east, zMid })) scene.add(m);
  // Stone quays: the two long sides run as far as the rivers do, the cross walls close the tips.
  const walls = [[west, 0, 3, riverDepth], [east, 0, 3, riverDepth], [0, -half, east - west - 3, 3], [0, half, east - west - 3, 3]];
  const quays = new THREE.InstancedMesh(unit, mat('stone'), walls.length);
  walls.forEach(([x, z, w, d], i) => { dummy.position.set(x, -0.1, zMid + z); dummy.rotation.set(0, 0, 0); dummy.scale.set(w, 0.5, d); dummy.updateMatrix(); quays.setMatrixAt(i, dummy.matrix); });
  quays.computeBoundingSphere(); scene.add(quays);
  unit.addEventListener('dispose', () => quays.dispose());   // disposeScene frees geometry only; this frees the instance buffer
  const bw = city.broadway, dx = bw.to[0] - bw.from[0], dz = bw.to[1] - bw.from[1];
  const broadway = new THREE.Mesh(unit, mat('paintYellow'));
  broadway.position.set((bw.from[0] + bw.to[0]) / 2, 0.025, (bw.from[1] + bw.to[1]) / 2);
  broadway.scale.set(0.2, 0.02, Math.hypot(dx, dz)); broadway.rotation.y = -Math.atan2(dx, dz); scene.add(broadway);

  const route = [-42, -102, -163, -224, -285, -345].map((z, i) => new THREE.Vector3(0, 26 + i * 5.8, z));
  const rings = route.map((p, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.15, 8, 48), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xf7cb77 : 0x76adc1, transparent: true, opacity: i === 0 ? 1 : 0.3 }));
    ring.position.copy(p); scene.add(ring); return ring;
  });

  const precip = Wx.particles ? makePrecipitation(Wx.particles) : null;
  if (precip) scene.add(precip.object);
  const steam = city.steam.length ? makeSteam(city.steam, new THREE.Color(0xd8c6b0).lerp(new THREE.Color(T.hemi[0]), 0.3).multiplyScalar(0.8)) : null;
  if (steam) scene.add(steam.object);

  return {
    scene, route, rings, city, look, time, weather,
    tick: (dt, camera) => { for (const w of waters) w.tick(dt); precip?.tick(dt, camera.position); steam?.tick(dt, camera); },
    buildings: city.buildings,
    anchors: city.anchors.map((a) => new THREE.Vector3(a[0], a[1], a[2])),
    start: new THREE.Vector3(...city.start),
  };
}

const FACADE = /^facade\d$/;
// West and east edges of the island, x: past the outer avenues (±280, three lanes ±12 m) so the
// perimeter highways have land under them, like the West Side Highway and the FDR.
const SHORE = [-305, 305];
const ISLAND_LENGTH = 1000;   // the ground's run in z; rig.js ISLAND mirrors it

// Facade walls paint their own windows: the grid comes from WINDOW (the same numbers the
// boxes used to be placed with), lit or dark per window from a hash of its cell and the
// tier's seed against the tier's lit chance. Roofs and floors stay plain.
function paintWindows(material, palette) {
  const lit = palette.windowLit;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uWin: { value: new THREE.Color(palette.window) }, uWinGlow: { value: new THREE.Color(0x628396) },
      uWinLit: { value: new THREE.Color(lit) }, uWinLitGlow: { value: new THREE.Color(lit === PALETTE.windowLit ? 0xffc782 : lit) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aWin;
varying vec4 vWin; varying vec3 vBoxPos; varying vec3 vBoxSize; varying vec3 vObjNormal; varying float vBottom;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 bs = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
vBoxSize = bs; vBoxPos = (position + 0.5) * bs; vObjNormal = normal; vWin = aWin; vBottom = instanceMatrix[3].y - bs.y * 0.5;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uWin; uniform vec3 uWinGlow; uniform vec3 uWinLit; uniform vec3 uWinLitGlow;
varying vec4 vWin; varying vec3 vBoxPos; varying vec3 vBoxSize; varying vec3 vObjNormal; varying float vBottom;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (abs(vObjNormal.y) < 0.5) {
  bool alongX = abs(vObjNormal.z) > 0.5;
  float along = alongX ? vBoxPos.x : vBoxPos.z, len = alongX ? vBoxSize.x : vBoxSize.z, y = vBoxPos.y;
  float from = alongX ? 0.0 : (vObjNormal.x < 0.0 ? vWin.z : vWin.w);
  float j = floor((along - ${WINDOW.edge.toFixed(2)}) / ${WINDOW.dx.toFixed(2)} + 0.5), cx = ${WINDOW.edge.toFixed(2)} + j * ${WINDOW.dx.toFixed(2)};
  float k = floor((y - ${WINDOW.sill.toFixed(2)}) / ${WINDOW.dy.toFixed(2)} + 0.5), cy = ${WINDOW.sill.toFixed(2)} + k * ${WINDOW.dy.toFixed(2)};
  if (j >= 0.0 && cx < len - ${WINDOW.endGap.toFixed(2)} && k >= 0.0 && cy < vBoxSize.y - ${WINDOW.topGap.toFixed(2)} && vBottom + cy > from
      && abs(along - cx) < ${(WINDOW.w / 2).toFixed(3)} && abs(y - cy) < ${(WINDOW.h / 2).toFixed(3)}) {
    float face = alongX ? (vObjNormal.z > 0.0 ? 1.0 : 2.0) : (vObjNormal.x > 0.0 ? 3.0 : 4.0);
    float on = step(fract(sin(dot(vec3(j, k, face) + vWin.y * 97.0, vec3(12.9898, 78.233, 37.719))) * 43758.5453), vWin.x);
    diffuseColor.rgb = mix(uWin, uWinLit, on);
    roughnessFactor = mix(0.28, 1.0, on); metalnessFactor = mix(0.4, 0.0, on);
    totalEmissiveRadiance += mix(uWinGlow * 0.18, uWinLitGlow * 0.65, on);
  }
}`);
  };
  material.customProgramCacheKey = () => `windows:${palette.window}:${lit}`;
  return material;
}

function makeMaterial(name, palette, wet) {
  const color = palette[name];
  if (FACADE.test(name)) return paintWindows(new THREE.MeshStandardMaterial({ color, roughness: 0.72 }), palette);
  if (name.startsWith('neon') || GLOW.includes(name)) return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4 });
  if (name === 'window') return new THREE.MeshStandardMaterial({ color, emissive: 0x628396, emissiveIntensity: 0.18, metalness: 0.4, roughness: 0.28 });
  if (name === 'windowLit') return new THREE.MeshStandardMaterial({ color, emissive: color === PALETTE.windowLit ? 0xffc782 : color, emissiveIntensity: 0.65 });
  if (name === 'asphalt' || name === 'stone') return new THREE.MeshStandardMaterial({ color, roughness: wet ? 0.2 : name === 'asphalt' ? 0.45 : 0.72, metalness: wet ? 0.2 : name === 'asphalt' ? 0.15 : 0 });
  if (name === 'cab') return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25 });
  return new THREE.MeshStandardMaterial({ color, roughness: name === 'trim' ? 0.8 : 0.72 });
}

// Rain streaks or snowflakes in a box that follows the camera; each one wraps back to the
// top when it falls out, so the count never changes.
const BOX = [140, 90, 140];
function makePrecipitation(p) {
  const rain = p.kind === 'rain';
  const perDrop = rain ? 2 : 1;
  const pos = new Float32Array(p.count * perDrop * 3);
  const home = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) for (let a = 0; a < 3; a++) home[i * 3 + a] = (Math.random() - 0.5) * BOX[a];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const object = rain
    ? new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: p.colour, transparent: true, opacity: p.opacity, depthWrite: false }))
    : new THREE.Points(geometry, new THREE.PointsMaterial({ color: p.colour, size: p.size, transparent: true, opacity: p.opacity, depthWrite: false }));
  object.frustumCulled = false;
  let t = 0;
  function tick(dt, at) {
    t += dt;
    const fall = p.fall * t, sway = rain ? p.drift * t : 0;
    for (let i = 0; i < p.count; i++) {
      const wrap = (v, size) => ((((v + size / 2) % size) + size) % size) - size / 2;
      const hx = home[i * 3], hy = home[i * 3 + 1], hz = home[i * 3 + 2];
      const drift = rain ? sway : Math.sin(t * 0.7 + i) * p.drift;
      const x = at.x + wrap(hx + drift - at.x, BOX[0]), y = at.y + wrap(hy - fall - at.y, BOX[1]), z = at.z + wrap(hz - at.z, BOX[2]);
      const o = i * perDrop * 3;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      if (rain) { pos[o + 3] = x - p.drift * 0.04; pos[o + 4] = y + p.length; pos[o + 5] = z; }
    }
    geometry.attributes.position.needsUpdate = true;
  }
  return { object, tick };
}

// Steam from the street stacks: soft puffs that rise, swell and fade, looping. One Points
// draw; each puff's age drives its size and opacity in the shader.
const PUFFS = 10;
function makeSteam(stacks, colour) {
  const n = stacks.length * PUFFS;
  const base = new Float32Array(n * 3), pos = new Float32Array(n * 3), phase = new Float32Array(n), age = new Float32Array(n), seed = new Float32Array(n);
  stacks.forEach(([x, y, z], i) => {
    for (let j = 0; j < PUFFS; j++) {
      const k = i * PUFFS + j;
      base.set([x, y, z], k * 3); pos.set([x, y, z], k * 3);
      phase[k] = j / PUFFS; seed[k] = Math.random() * 6.28;
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('age', new THREE.BufferAttribute(age, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uColour: { value: colour }, uPx: { value: 500 } },
    vertexShader: `attribute float age; uniform float uPx; varying float vA;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((3.0 + age * 11.0) * uPx / -mv.z, 1.0, 160.0);
  vA = (1.0 - age) * smoothstep(0.0, 0.1, age) * 0.34; }`,
    fragmentShader: `uniform vec3 uColour; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColour, smoothstep(0.5, 0.05, d) * vA); }`,
  });
  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;
  let t = 0;
  function tick(dt, camera) {
    t += dt;
    material.uniforms.uPx.value = (window.innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (let k = 0; k < n; k++) {
      const a = (t * 0.17 + phase[k]) % 1;
      age[k] = a;
      pos[k * 3] = base[k * 3] + a * 6 + Math.sin(seed[k] + t) * a * 2.2;
      pos[k * 3 + 1] = base[k * 3 + 1] + a * 17;
      pos[k * 3 + 2] = base[k * 3 + 2] + Math.cos(seed[k] + t * 0.8) * a * 2.2;
    }
    geometry.attributes.position.needsUpdate = true; geometry.attributes.age.needsUpdate = true;
  }
  tick(0, { fov: 76 });
  return { object, tick };
}

// Stand-in geometry per kit part, origin at the footprint centre on the base plane.
function standIn(name, mat) {
  if (name === 'spire') { const g = new THREE.ConeGeometry(1.6, 31, 8); g.translate(0, 15.5, 0); return { geometry: g, material: mat('crown') }; }
  const part = KIT[name];
  const [w, h, d] = part.size;
  if (name === 'waterTower' || name === 'roofTank') {
    const tank = new THREE.CylinderGeometry(w / 2, w / 2, h * 0.65, 10); tank.translate(0, h * 0.35 + h * 0.325, 0);
    const legs = new THREE.BoxGeometry(w * 0.7, h * 0.35, w * 0.7); legs.translate(0, h * 0.175, 0);
    const cap = new THREE.ConeGeometry(w / 2 + 0.2, h * 0.2, 10); cap.translate(0, h + h * 0.1, 0);
    return { geometry: mergeGeometries([legs, tank, cap]), material: mat(name === 'waterTower' ? 'facade1' : 'trim') };
  }
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
  const material = name === 'cab' ? mat('cab') : name === 'storefront' || name === 'awning' ? mat('facade3') : name === 'billboardFrame' ? mat('windowLit') : mat('trim');
  return { geometry: g, material };
}

function mergeGeometries(list) {
  // Enough of BufferGeometryUtils.mergeGeometries for non-indexed position/normal buffers.
  const positions = [], normals = [];
  for (const g of list) {
    const ng = g.toNonIndexed();
    positions.push(...ng.attributes.position.array); normals.push(...ng.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return out;
}
