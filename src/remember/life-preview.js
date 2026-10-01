import * as THREE from 'three';
import { buildManhattan } from '../world/city/scene.js';
import { composeLook } from '../world/city/eras.js';
import { createRng } from '../world/city/rng.js';
import { blocks } from '../world/city/blocks.js';
import { WORLD } from '../world/city/bible.js';
import { createLife, inspect } from './life.js';
import { createTown, TIME_SCALE, START_HOUR } from './town.js';
import { collide } from './rig.js';
import * as models from './models.js';

// The living city on its own: the real Manhattan, the life layer, and a stand-in player.
//   ?era=1900|2000|2100&city=nyc|tokyo&season=summer&time=noon&weather=clear&density=1&seed=7
//   &at=x,z (player)  &cam=yaw,pitch,dist (degrees, degrees, metres)  &warm=20 (seconds simulated first)
//   &town=1[&hour=11]  the walkers are the town's residents (town.js ticks at 60x); the top right lists the eight nearest
//   &view=models  turntable of every new model instead of the city
// Player: WASD walk (V: car mode, fast, scares walkers), drag to orbit, wheel to zoom.
// Hooks for scripts: window.__preview { life, player, stats, check(), step(seconds), auto }.
const q = new URLSearchParams(location.search);
const str = (k, d) => q.get(k) || d, num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const era = str('era', '2000'), city = str('city', 'nyc');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1600);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const hud = document.getElementById('hud');
if (q.get('hud') === '0') hud.remove();

if (q.get('view') === 'models') modelsView(); else cityView();

function cityView() {
  const look = composeLook({ city, era, season: str('season', 'summer') });
  look.traffic = { ...look.traffic, none: true };
  const world = buildManhattan({ look, time: str('time', 'noon'), weather: str('weather', 'clear') });
  const scene = world.scene;
  for (const ring of world.rings) ring.visible = false;
  const town = q.get('town') === '1' ? createTown({ city, era, hour: q.has('hour') ? num('hour', 12) : START_HOUR[str('time', 'noon')] ?? 12 }) : null;
  const life = createLife({ era, city, rng: createRng(num('seed', 7)), density: num('density', 1), town });
  const townBox = document.getElementById('town');
  scene.add(life.group);

  const [ax, az] = (q.get('at') || '14,-92').split(',').map(Number);
  const player = { position: new THREE.Vector3(ax, 0.18, az), velocity: new THREE.Vector3(), speed: 0, radius: 0.5, vehicle: false };
  const walker = models.makeAvatar({ shirt: '#e0322b' }), racer = models.makeRaceCar('#2b62a6');
  const body = new THREE.Group(); body.add(walker); scene.add(body);
  const keys = new Set();
  let yaw = 0, pitch = -0.38, dist = 22, heading = 0, paused = false, held = null, speedMul = 1;
  if (q.has('cam')) { const [y, p, d] = q.get('cam').split(',').map(Number); yaw = THREE.MathUtils.degToRad(y); pitch = THREE.MathUtils.degToRad(p); dist = d; }
  if (q.get('car') === '1') player.vehicle = true;
  const auto = { vx: 0, vz: 0, until: 0 };
  const view = { follow: null, ghost: false };

  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyV') player.vehicle = !player.vehicle;
    if (e.code === 'KeyP') paused = !paused;
    if (e.code === 'KeyH') hud.style.display = hud.style.display === 'none' ? '' : 'none';
    if (e.code === 'Digit1') { held = life.pickFare(player.position, 10, 80); if (held) life.claim(held); }
    if (e.code === 'Digit2' && held) { life.board(held); if (town && held.res) town.hail(held.res, player.position); }
    if (e.code === 'Digit3' && held) {
      if (town && held.res) {
        const homes = town.places.filter((o) => o.kind === 'home').sort((a, b) => Math.hypot(a.door.x - player.position.x, a.door.z - player.position.z) - Math.hypot(b.door.x - player.position.x, b.door.z - player.position.z));
        town.dropOff(held.res, homes[0].id);
      }
      life.release(held, player.position); held = null;
    }
    if (e.code === 'Digit4') { const v = life.nearestVehicle(player.position, 30); if (v) { const m = life.take(v); scene.add(m); body.userData.taken = m; } }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  let drag = false;
  renderer.domElement.addEventListener('pointerdown', () => { drag = true; });
  addEventListener('pointerup', () => { drag = false; });
  addEventListener('pointermove', (e) => { if (!drag) return; yaw -= e.movementX * 0.005; pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.004, -1.5, 0.2); });
  addEventListener('wheel', (e) => { dist = THREE.MathUtils.clamp(dist * Math.exp(e.deltaY * 0.001), 4, 400); });

  const solids = [...world.buildings];
  const MAX = () => (player.vehicle ? 34 : 5.5);
  function movePlayer(dt) {
    if (view.follow) { player.position.set(view.follow.position.x, view.follow.position.y, view.follow.position.z); player.velocity.set(0, 0, 0); player.speed = 0; return; }
    let fx = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), sx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    let dx = -Math.sin(yaw) * fx + Math.cos(yaw) * sx, dz = -Math.cos(yaw) * fx - Math.sin(yaw) * sx;
    if (clock < auto.until) { dx = auto.vx; dz = auto.vz; }
    const len = Math.hypot(dx, dz);
    if (len > 1) { dx /= len; dz /= len; }
    const k = 1 - Math.exp(-(player.vehicle ? 2.2 : 12) * dt);
    player.velocity.x += (dx * MAX() - player.velocity.x) * k;
    player.velocity.z += (dz * MAX() - player.velocity.z) * k;
    player.position.x += player.velocity.x * dt; player.position.z += player.velocity.z * dt;
    collide(player.position, player.vehicle ? 1.3 : 0.45, solids, player.position.y);
    collide(player.position, player.vehicle ? 1.3 : 0.45, life.obstacles(), player.position.y);
    player.position.x = THREE.MathUtils.clamp(player.position.x, WORLD.x[0], WORLD.x[1]); player.position.z = THREE.MathUtils.clamp(player.position.z, WORLD.z[0], WORLD.z[1]);
    player.speed = Math.hypot(player.velocity.x, player.velocity.z);
    player.radius = player.vehicle ? 1.3 : 0.45;
    if (player.speed > 0.6) heading = Math.atan2(-player.velocity.x, -player.velocity.z);
  }

  let clock = 0;
  const times = [];
  const stats = { updAvg: 0, updMax: 0, calls: 0, lifeCalls: 0, tris: 0 };
  const warm = num('warm', town ? 30 : 20);
  function step(seconds, dt = 1 / 30) {
    for (let t = 0; t < seconds; t += dt) { clock += dt; if (!paused) { movePlayer(dt); town?.tick(dt * TIME_SCALE); life.update(dt, player); } }
  }
  town?.tick(1);
  life.update(1 / 30, player);
  step(warm);

  function frameBody(dt) {
    const taken = body.userData.taken;
    walker.visible = !player.vehicle && !taken && !view.ghost; racer.visible = player.vehicle && !taken && !view.ghost;
    if (player.vehicle && !racer.parent) body.add(racer);
    body.position.copy(player.position); body.rotation.y = heading;
    if (taken) { taken.position.copy(player.position); taken.rotation.y = heading; taken.userData.animate?.(clock, player.speed); }
    walker.userData.animate?.(clock, player.speed);
    racer.userData.animate?.(clock, player.speed);
  }

  const allBlocks = blocks(), bounds = allBlocks.filter((b) => b.district !== 'park');
  // Violations a script can poll: overlaps, vehicles off the road, walkers inside buildings or off the sidewalks.
  function check() {
    const out = { overlaps: 0, vehiclesOnSidewalk: 0, vehiclesInBuildings: 0, pedsInBuildings: 0, pedsOffWalk: 0, motor: 0, counts: {}, states: {} };
    const veh = life.vehicles.filter((v) => v.placed);
    const obb = (v) => { const c = Math.cos(v.heading), s = Math.sin(v.heading); return { x: v.cx, z: v.cz, ax: [-s, -c], ay: [c, -s], hl: v.half, hw: v.wid / 2 }; };
    const hit = (a, b) => {
      for (const ax of [a.ax, a.ay, b.ax, b.ay]) {
        const pr = (o) => Math.abs(ax[0] * o.ax[0] + ax[1] * o.ax[1]) * o.hl + Math.abs(ax[0] * o.ay[0] + ax[1] * o.ay[1]) * o.hw;
        if (Math.abs((b.x - a.x) * ax[0] + (b.z - a.z) * ax[1]) > pr(a) + pr(b)) return false;
      }
      return true;
    };
    for (let i = 0; i < veh.length; i++) for (let j = i + 1; j < veh.length; j++) {
      const A = veh[i], B = veh[j];
      if (A.hover !== B.hover || Math.abs(A.cx - B.cx) > 14 || Math.abs(A.cz - B.cz) > 14) continue;
      if (A.hover && Math.abs(A.position.y - B.position.y) > 2.2) continue;
      if (hit(obb(A), obb(B))) out.overlaps++;
    }
    for (const v of veh) {
      out.counts[v.kind + (v.parked ? ':parked' : v.hover ? ':hover' : '')] = (out.counts[v.kind + (v.parked ? ':parked' : v.hover ? ':hover' : '')] || 0) + 1;
      if (v.kind !== 'carriage') out.motor++;
      if (v.hover) continue;
      if (bounds.some((b) => v.cx > b.minX - 3 + 0.2 && v.cx < b.maxX + 3 - 0.2 && v.cz > b.minZ - 3 + 0.2 && v.cz < b.maxZ + 3 - 0.2)) out.vehiclesOnSidewalk++;
      if (world.buildings.some((b) => v.cx > b.minX && v.cx < b.maxX && v.cz > b.minZ && v.cz < b.maxZ)) out.vehiclesInBuildings++;
    }
    for (const p of life.pedestrians) {
      out.states[p.state] = (out.states[p.state] || 0) + 1;
      if (p.state === 'ride') continue;
      const { x, z } = p.position;
      if (world.buildings.some((b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ)) out.pedsInBuildings++;
      if (p.edge.kind === 'walk' && !allBlocks.some((b) => x > b.minX - 3 && x < b.maxX + 3 && z > b.minZ - 3 && z < b.maxZ + 3)) out.pedsOffWalk++;
    }
    return out;
  }
  const worst = { overlaps: 0, vehiclesOnSidewalk: 0, vehiclesInBuildings: 0, pedsInBuildings: 0, pedsOffWalk: 0, motor: 0 };
  function soak(seconds) {
    for (let t = 0; t < seconds; t += 0.5) {
      step(0.5);
      const c = check();
      for (const k of Object.keys(worst)) worst[k] = Math.max(worst[k], c[k]);
    }
    return { ...worst, last: check() };
  }

  function measureLife() {
    const g = life.group;
    renderer.render(scene, camera); const all = renderer.info.render.calls, tris = renderer.info.render.triangles;
    g.visible = false; renderer.render(scene, camera); const rest = renderer.info.render.calls; g.visible = true;
    stats.calls = all; stats.lifeCalls = all - rest; stats.tris = tris;
  }

  const placeName = (id) => { const o = town.place(id); return o.kind === 'shop' ? town.shopName(id) : o.kind === 'park' ? 'the park' : o.kind === 'office' ? 'the office' : 'home'; };
  const doing = (r) => {
    const a = r.act;
    switch (a.kind) {
      case 'walk': return `walking to ${placeName(a.to)}`;
      case 'sleep': return 'asleep';
      case 'work': return `at work (${placeName(a.at)})`;
      case 'street': return 'working the street';
      case 'eat-out': return `eating at ${placeName(a.at)}`;
      case 'eat-home': return 'eating at home';
      case 'shop': return `shopping at ${placeName(a.at)}`;
      case 'bar': return `drinking at ${placeName(a.at)}`;
      case 'visit': return 'visiting a friend';
      case 'park': return 'in the park';
      case 'ride': return 'in your cab';
      default: return 'at home';
    }
  };
  function townText() {
    const p = player.position, h = town.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const near = town.residents.map((r) => { const w = town.where(r); return { r, d: Math.hypot(w.x - p.x, w.z - p.z) }; }).sort((a, b) => a.d - b.d).slice(0, 8);
    return `town day ${town.day} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}\n` + near.map(({ r, d }) => `${life.pedFor(r.id) ? '●' : '○'} ${r.name} · ${r.job} · ${doing(r)} · $${r.money.toFixed(0)}  ${d.toFixed(0)} m`).join('\n');
  }

  let last = performance.now(), n = 0;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000) * speedMul; last = now;
    if (!paused) { clock += dt; movePlayer(dt); town?.tick(dt * TIME_SCALE); const a = performance.now(); life.update(dt, player); const u = performance.now() - a; times.push(u); if (times.length > 120) times.shift(); stats.updMax = Math.max(stats.updMax * 0.995, u); stats.updAvg = times.reduce((s, v) => s + v, 0) / times.length; }
    frameBody(dt);
    const target = player.position;
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + 1.4 - Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.position.y = Math.max(camera.position.y, 0.5);
    camera.lookAt(target.x, target.y + 1.2, target.z);
    if (n++ % 30 === 0) measureLife(); else renderer.render(scene, camera);
    if (town && n % 15 === 0 && getComputedStyle(hud).display !== 'none') townBox.textContent = townText();
    if (hud.isConnected && n % 6 === 0) {
      const c = check(), ud = inspect(life);
      hud.textContent = `${era} ${city}   t=${ud.clock().toFixed(0)}s${paused ? ' (paused)' : ''}\n`
        + `vehicles ${Object.entries(c.counts).map(([k, v]) => `${k} ${v}`).join(', ')}\npeds ${Object.entries(c.states).map(([k, v]) => `${k} ${v}`).join(', ')}\n`
        + `update ${stats.updAvg.toFixed(2)} ms avg, ${stats.updMax.toFixed(2)} max\ndraw calls ${stats.calls} (life ${stats.lifeCalls})  tris ${stats.tris}\n`
        + `overlaps ${c.overlaps}  on sidewalk ${c.vehiclesOnSidewalk}  in bldg ${c.vehiclesInBuildings}/${c.pedsInBuildings}  peds off walk ${c.pedsOffWalk}`;
    }
  });
  window.__preview = { life, town, player, stats, check, step, soak, auto, view, measure: measureLife, townText: () => (town ? townText() : ''), scene, camera, renderer, world, THREE, models, set(o) { if ('yaw' in o) yaw = o.yaw; if ('pitch' in o) pitch = o.pitch; if ('dist' in o) dist = o.dist; if ('speed' in o) speedMul = o.speed; if ('pause' in o) paused = o.pause; if ('heading' in o) heading = o.heading; }, now: () => clock };
}

function modelsView() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c9d0d8'); scene.fog = new THREE.FogExp2('#c9d0d8', 0.004);
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x8a8378, 2));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.position.set(-60, 120, -40); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#b4bbc4', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const rows = [];
  const veh = [];
  for (const c of ['#c23b32', '#2f6fdb', '#e8e6df', '#23262c', '#3fae5a']) veh.push(() => models.makeCar(c));
  veh.push(() => models.makeTaxi('nyc'), () => models.makeTaxi('tokyo'), () => models.makeTaxi('tokyo', '#4d1220'), () => models.makeBus('#2b62a6'), () => models.makeBus('#2f9e6a'), () => models.makeHoverCar('#ff3d8b'), () => models.makeHorseCarriage());
  rows.push(veh.map((f) => ({ make: f, speed: 8 })));
  const eras = [['1900', 'nyc'], ['2000', 'nyc'], ['2100', 'nyc'], ['1900', 'tokyo'], ['2000', 'tokyo'], ['2100', 'tokyo']];
  for (const [e, c] of eras) rows.push(Array.from({ length: 14 }, (_, i) => ({ make: () => models.makePedestrian({ seed: i * 37 + 5, era: e, city: c }), speed: 1.3, pose: i === 12 ? 'wave' : i === 13 ? 'dive' : null })));
  const items = [];
  const only = q.has('row') ? num('row', 0) : null;
  rows.forEach((row, ri) => {
    if (only !== null && ri !== only) return;
    const pitch = ri === 0 ? 7.5 : 1.6;
    row.forEach((it, i) => {
      const m = it.make();
      m.position.set((i - (row.length - 1) / 2) * pitch, 0, ri === 0 ? 0 : 8 + ri * 2.2);
      m.rotation.y = ri === 0 ? Math.PI * 0.8 : Math.PI;
      if (it.pose === 'dive') m.rotation.y = Math.PI;
      scene.add(m); items.push({ m, ...it });
    });
  });
  const az = num('az', 200) * Math.PI / 180, el = num('el', 22) * Math.PI / 180, dist = num('dist', 40), ty = num('ty', 1.2), tz = num('tz', only > 0 ? 8 + only * 2.2 : 6), tx = num('tx', 0);
  camera.position.set(tx + Math.sin(az) * Math.cos(el) * dist, ty + Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(tx, ty, tz);
  const t0 = performance.now();
  const ex = { wave: false, dive: 0 };
  renderer.setAnimationLoop(() => {
    const t = q.has('t') ? num('t', 0) : (performance.now() - t0) / 1000;
    for (const it of items) { ex.wave = it.pose === 'wave'; ex.dive = it.pose === 'dive' ? 1 : 0; it.m.userData.animate?.(t, it.speed, ex); }
    renderer.render(scene, camera);
    if (hud.isConnected) hud.textContent = `models  calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}`;
  });
  window.__preview = { scene, camera, renderer, models, THREE };
}
