import * as THREE from 'three';
import * as M from './models.js';

// Turntable for every model. Query params: focus=a,b (frame those), az/el/dist (camera,
// degrees; az 0 = behind the models, 180 = in front), still=1 (no turntable), t=secs
// (freeze time), ty=lookat y, ground=dark|#hex, speed=m/s, row=0|1|2 (frame one row), labels=0, stats=0, ry=degrees (fixed turn when still).
const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const sky = new THREE.Color('#c9d0d8');
scene.background = sky;
scene.fog = new THREE.FogExp2(sky, 0.0022);
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x8a8378, 2));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(-60, 120, -40);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: q.get('ground') === 'dark' ? '#26313c' : q.get('ground') || '#b4bbc4', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
scene.add(ground);
const grid = new THREE.GridHelper(600, 120, 0xa3abb5, 0xaab2bc);
grid.position.y = 0.005;
scene.add(grid);

const S = num('speed', NaN);
const ROWS = [
  [
    ['avatar', () => M.makeAvatar(), 0, {}],
    ['avatar cap', () => M.makeAvatar({ shirt: '#e8a13a', hat: 'cap' }), 2, {}],
    ['avatar helmet', () => M.makeAvatar({ shirt: '#2f6fdb', pants: '#3a3f4a', hat: 'helmet', hair: '#b06a2c' }), 6, {}],
    ['avatar mask', () => M.makeAvatar({ shirt: '#3a3f4a', pants: '#22262e', hat: 'mask', skin: '#c68a5b', hair: '#1d1a17' }), 3, {}],
    ['avatar cape', () => M.makeAvatar({ shirt: '#2f6fdb', pants: '#e0322b', hat: 'cape', skin: '#8d5a3b' }), 8, { air: true }],
    ['skateboard', () => M.makeSkateboard(), 6, {}],
    ['orb', () => M.makeOrb(), 0, {}],
    ['jewel', () => M.makeJewel(), 0, {}],
    ['crimeMarker', () => M.makeCrimeMarker(), 0, {}],
    ['doorMarker', () => M.makeDoorMarker(), 0, {}],
    ['searchlight', () => M.makeSearchlight(), 0, {}],
  ],
  [
    ['scooter', () => M.makeScooter(), 8, {}],
    ['raceCar', () => M.makeRaceCar(), 12, {}],
    ['van', () => M.makeVan(), 9, {}],
    ['hoverCar', () => M.makeHoverCar(), 15, {}],
    ['horseCarriage', () => M.makeHorseCarriage(), 3, {}],
  ],
  [
    ['ufo', () => M.makeUFO(), 0, { y: 9 }],
    ['gate', () => M.makeGate(), 0, {}],
    ['museum', () => M.makeMuseumFacade(), 0, { still: true }],
  ],
];

const skip = (g) => new Set([g.userData.beam, g.userData.cone]);
function fitBox(g) {
  const b = new THREE.Box3(), hide = skip(g);
  g.updateMatrixWorld(true);
  g.traverse((o) => { if (o.isMesh && !hide.has(o)) b.expandByObject(o); });
  return b;
}
function tris(g) {
  let t = 0, meshes = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  return { tris: t, meshes };
}

const items = [], labels = document.createElement('div');
document.body.append(labels);
let rowZ = 0;
ROWS.forEach((row, ri) => {
  const built = row.map(([name, make, speed, opts]) => {
    const model = make();
    const box = fitBox(model), size = box.getSize(new THREE.Vector3());
    return { name, model, speed, opts, box, size, w: Math.max(size.x, size.z) * 1.25 + 1.5 };
  });
  const total = built.reduce((a, b) => a + b.w, 0);
  const depth = Math.max(...built.map((b) => b.w));
  let x = -total / 2;
  rowZ += depth / 2 + (ri ? 6 : 0);
  for (const b of built) {
    const slot = new THREE.Group();
    slot.position.set(x + b.w / 2, b.opts.y || 0, rowZ);
    slot.add(b.model);
    scene.add(slot);
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = b.name;
    labels.append(label);
    items.push({ ...b, slot, label, row: ri, ...tris(b.model) });
    x += b.w;
  }
  rowZ += depth / 2;
});

const wanted = q.get('focus')?.split(',');
const targets = wanted ? items.filter((i) => wanted.includes(i.name)) : q.has('row') ? items.filter((i) => i.row === num('row', 0)) : items;
for (const i of items) i.slot.visible = targets.includes(i);
if (wanted) {
  let x = -targets.reduce((a, i) => a + i.w, 0) / 2;
  for (const i of targets) { i.slot.position.set(x + i.w / 2, i.opts.y || 0, 0); x += i.w; }
}
const bounds = new THREE.Box3();
for (const i of targets) { i.slot.updateMatrixWorld(true); bounds.union(fitBox(i.slot)); }
const centre = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 2000);
const az = THREE.MathUtils.degToRad(num('az', wanted ? 200 : 180)), el = THREE.MathUtils.degToRad(num('el', wanted ? 18 : 30));
centre.y = num('ty', centre.y);
const tanV = Math.tan(THREE.MathUtils.degToRad(20));
const fitDist = Math.max(size.y / 2 / tanV, size.x / 2 / (tanV * camera.aspect)) * 1.1 + size.z / 3;
const dist = num('dist', fitDist);
camera.position.set(centre.x + Math.sin(az) * Math.cos(el) * dist, centre.y + Math.sin(el) * dist, centre.z + Math.cos(az) * Math.cos(el) * dist);
camera.lookAt(centre);

const stats = document.getElementById('stats');
const report = {};
for (const i of items) report[i.name] = { tris: i.tris, meshes: i.meshes };
window.__stats = { models: report, render: null };
window.__M = M;
window.__three = { THREE, renderer, scene };
if (q.get('stats') === '0') stats.remove();
if (q.get('labels') === '0') labels.remove();

const p = new THREE.Vector3();
const still = q.get('still') === '1', freeze = q.has('t') ? num('t', 0) : null;
const t0 = performance.now();
function frame() {
  const t = freeze ?? (performance.now() - t0) / 1000;
  for (const i of items) {
    i.slot.rotation.y = still || i.opts.still ? THREE.MathUtils.degToRad(num('ry', 0)) : t * 0.35;
    i.model.userData.animate?.(t, Number.isNaN(S) ? i.speed : S, i.opts.air ? { air: Math.sin(t * 1.3) > -0.2 } : undefined);
  }
  renderer.render(scene, camera);
  if (!labels.parentNode) { /* labels off */ } else {
    for (const i of items) {
      p.set(i.slot.position.x, i.slot.position.y + i.size.y + 0.4, i.slot.position.z).project(camera);
      i.label.style.display = i.slot.visible && p.z <= 1 ? '' : 'none';
      i.label.style.transform = `translate(${(p.x * 0.5 + 0.5) * innerWidth}px, ${(-p.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
    }
  }
  const r = renderer.info.render;
  window.__stats.render = { triangles: r.triangles, calls: r.calls };
  if (stats.isConnected) {
    stats.textContent = items.map((i) => `${i.name.padEnd(14)} ${String(Math.round(i.tris)).padStart(5)} tris ${String(i.meshes).padStart(3)} meshes`).join('\n')
      + `\nframe: ${r.triangles} tris, ${r.calls} calls`;
  }
  requestAnimationFrame(frame);
}
frame();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
