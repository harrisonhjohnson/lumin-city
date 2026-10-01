import * as THREE from 'three';
import * as models from './models.js';
import { createWorld } from './world.js';
import { createControls, createMover, createChaseCamera } from './rig.js';
import { worldSettings } from './memory.js';
import { createRng } from '../world/city/rng.js';
import { kaiju } from './boss.js';
import { aimDirection, AIM_PITCH } from './powers.js';

// The kaiju fight on its own: the real city, rig and controls, a stand-in HUD. Not linked from anywhere.
//   ?city=nyc&year=2000&season=summer&weather=clear&time=dusk   the remembered day (defaults shown)
//   &secs=180 round length   &at=x,y,z where you start   &name=Kid
//   &auto=1 a bot flies and fights for you (soak and timing runs)
//   &view=kaiju  a turntable of the monster instead (speed, roar, breath, hurt, frozen, swipe, aimYaw, aimPitch, t, az, el, dist, ty, bld=1)
// Play: click to capture the mouse, WASD fly, Space/C up/down, Shift boost, left button or L laser, right button or F ice, R restart.
// Scripts: window.__boss { round, fight, mover, controls, perf, step(seconds), aim(x,y,z), tp(x,y,z), hold({ laser, ice }), restart(), result() }.
const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const str = (k, d) => q.get(k) || d;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1600);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const $ = (id) => document.getElementById(id);

// --- Turntable of the monster -------------------------------------------------

function modelView() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#6a5a7a'); scene.fog = new THREE.FogExp2('#8a6f7c', 0.0016);
  scene.add(new THREE.HemisphereLight(0xffd3b0, 0x5d4a52, 2.4));
  const sun = new THREE.DirectionalLight(0xff9a5c, 3.2); sun.position.set(-260, 90, -120); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: '#26313c', roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const grid = new THREE.GridHelper(600, 60, 0x445066, 0x303a4c); grid.position.y = 0.02; scene.add(grid);
  if (q.has('bld')) {
    const boxes = new THREE.MeshStandardMaterial({ color: '#7d8796', roughness: 0.8 });
    for (const [x, z, h] of [[-90, 70, 80], [60, 90, 120], [110, 40, 60], [-120, 60, 40]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(24, h, 24), boxes); b.position.set(x, h / 2, z); scene.add(b); }
  }
  const hero = models.makeAvatar({ shirt: '#2b62a6', pants: '#e0322b', hat: 'cape' }); hero.position.set(30, 0, -40); scene.add(hero);
  const hall = models.makeCityHall(); hall.position.set(-60, 0, -40); scene.add(hall);
  const k = models.makeKaiju(); scene.add(k);
  const az = THREE.MathUtils.degToRad(num('az', 200)), el = THREE.MathUtils.degToRad(num('el', 12)), dist = num('dist', 150), ty = num('ty', 26), tx = num('tx', 0), tz = num('tz', 0);
  camera.position.set(tx + Math.sin(az) * Math.cos(el) * dist, ty + Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(tx, ty, tz);
  const t0 = performance.now(), ex = {};
  renderer.setAnimationLoop(() => {
    const t = q.has('t') ? num('t', 0) + (q.has('freeze') ? 0 : (performance.now() - t0) / 1000) : (performance.now() - t0) / 1000;
    const c = (n) => (q.has(n) ? num(n, 0) : 0);
    Object.assign(ex, { roar: c('roar'), breath: c('breath'), hurt: c('hurt'), frozen: c('frozen'), swipe: c('swipe'), aimYaw: c('aimYaw'), aimPitch: c('aimPitch') });
    k.userData.animate(t, num('speed', 6), ex);
    hall.userData.animate(t, 0, { alarm: c('alarm'), fall: c('fall') });
    renderer.render(scene, camera);
  });
  const box = new THREE.Box3();
  window.__preview = { scene, camera, renderer, kaiju: k, hall, THREE, models, ex, bounds() { k.updateMatrixWorld(true); return box.setFromObject(k); },
    stats(o = k) { let tris = 0, meshes = 0; o.traverse((m) => { if (m.isMesh) { meshes++; tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; } }); return { tris, meshes }; } };
}

// --- The fight ------------------------------------------------------------------

const hud = {
  state: { title: '', objective: '', score: 0, time: null, meter: null, meterLabel: '' },
  show() {}, hide() {}, clock() {}, abilities() {}, prompt(text) { $('prompt').textContent = text || ''; },
  set(p = {}) {
    Object.assign(this.state, p);
    if (p.title !== undefined) $('title').textContent = p.title;
    if (p.objective !== undefined) $('objective').textContent = p.objective;
    if (p.score !== undefined) $('score').textContent = `score ${Math.round(p.score ?? 0)}${this.state.time != null ? `   time ${Math.ceil(this.state.time)}` : ''}`;
  },
  meter(label, v) { this.state.meter = v; this.state.meterLabel = label; $('meterk').textContent = label || ''; $('meter').style.transform = `scaleX(${v ?? 0})`; },
  toast(text, kind = 'info') {
    this.log.push({ text, kind });
    const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = text; $('toasts').append(el);
    setTimeout(() => el.remove(), 2600);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  },
  callout(text) { this.log.push({ text, kind: 'callout' }); $('callout').textContent = text; clearTimeout(this.ct); this.ct = setTimeout(() => { $('callout').textContent = ''; }, 1400); return Promise.resolve(); },
  log: [],
};

function fight() {
  const memory = { city: str('city', 'nyc'), year: str('year', '2000'), season: str('season', 'summer'), weather: str('weather', 'clear'), time: str('time', 'dusk'), name: str('name', 'Kid') };
  const world = createWorld();
  const group = new THREE.Group();
  const destroyed = new Set();
  const perf = { frames: 0, dt: 16, dtMax: 0, frame: 0, frameMax: 0, upd: 0, updMax: 0, rebuilds: 0, rebuildMs: 0, rebuildMax: 0, calls: 0, tris: 0, fightCalls: 0 };
  const rebuild = ({ surface = true } = {}) => {
    const s = worldSettings(memory), t0 = performance.now();
    world.build({ ...s, look: { ...s.look, traffic: { none: true } }, destroyed, surface });
    world.scene.add(group);
    if (player) world.scene.add(player.root);
    return performance.now() - t0;
  };
  const noObstacles = [];
  const controls = createControls(renderer.domElement);
  const chase = createChaseCamera(camera);
  let player = null, mover = null, round = null, phase = 'idle', timeLeft = 0, clock = 0, def = kaiju;
  rebuild({ surface: false });
  world.scene.fog.density = world.scene.fog.density * 1;
  camera.position.set(0, 220, 200);

  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd66b, emissive: 0xffb02e, emissiveIntensity: 0.9, flatShading: true }));
  arrow.rotation.order = 'YXZ';

  function makePlayer() {
    const root = new THREE.Group(), body = new THREE.Group(), avatar = models.makeAvatar(def.outfit);
    body.add(avatar); root.add(body, arrow);
    return { root, body, avatar };
  }
  function placePlayer(dt) {
    const feet = mover.feet;
    player.body.position.copy(feet); player.body.rotation.y = mover.heading;
    const body = player.avatar.userData.body;
    if (body) body.rotation.z = mover.lean;
    player.avatar.rotation.x = THREE.MathUtils.damp(player.avatar.rotation.x, !mover.grounded ? -Math.min(mover.speed / 30, 1) * 1.25 : 0, 5, dt);
    player.avatar.userData.animate?.(clock, mover.speed, { air: !mover.grounded });
    const goal = round.guide?.(mover);
    arrow.visible = !!goal;
    if (goal) {
      const dx = goal.x - feet.x, dz = goal.z - feet.z, flat = Math.hypot(dx, dz);
      arrow.position.set(feet.x, feet.y + 2.8 + Math.sin(clock * 3) * 0.12, feet.z);
      arrow.rotation.y = Math.atan2(-dx, -dz);
      arrow.rotation.x = THREE.MathUtils.clamp(Math.atan2((goal.y || 0) - feet.y, flat), -0.8, 0.8);
      arrow.visible = flat > 6 || Math.abs((goal.y || 0) - feet.y) > 6;
    }
  }

  // The same ctx main.js builds, plus the camera (the mode uses it to size particles).
  function start() {
    if (player) { world.scene.remove(player.root); models.disposeModel(player.root); }
    for (const child of [...group.children]) { group.remove(child); models.disposeModel(child); }
    if (destroyed.size) { destroyed.clear(); rebuild({ surface: false }); }
    hud.log.length = 0;
    const rng = createRng(1234);
    round = def.create({
      world, group, rng, memory, hud, name: memory.name, life: null, town: null, controls, progress: { kept: [] }, camera,
      destroyLot: (id) => { if (destroyed.has(id)) return; destroyed.add(id); const ms = rebuild({ surface: false }); perf.rebuilds++; perf.rebuildMs += ms; perf.rebuildMax = Math.max(perf.rebuildMax, ms); },
      destroyedLots: destroyed,
    });
    const at = q.has('at') ? new THREE.Vector3(...q.get('at').split(',').map(Number)) : round.spawn.at;
    mover = createMover(def.mover, { at, heading: round.spawn.heading, solids: () => [world.solids(), noObstacles], anchors: world.city.anchors });
    player = makePlayer();
    world.scene.add(player.root);
    timeLeft = num('secs', def.time); round.timeLeft = timeLeft;
    controls.yaw = round.spawn.heading; controls.pitch = -0.18; controls.enabled = true; controls.pressed.clear();
    chase.snap(mover, controls); placePlayer(0);
    hud.set({ title: def.title, objective: round.objective, time: timeLeft, score: 0 });
    $('result').classList.remove('on');
    phase = 'play'; clock = 0;
  }

  function finish() {
    phase = 'over'; controls.enabled = false; controls.release();
    const r = round.results();
    $('result').textContent = `${def.title.toUpperCase()}   rank ${r.rank}   score ${r.score}\n${r.subtitle}\n\n${r.lines.map((l) => `${l.label}: ${l.value}`).join('\n')}\n\npress R to play again`;
    $('result').classList.add('on');
    perf.result = r;
  }

  // A bot for soak and timing runs: hovers 85 m off the kaiju, burns it, ices when it is close, climbs out of the way of a locked breath.
  const bot = { y: 0 };
  function autopilot(dt) {
    const f = round.debug.fight, T = round.debug.targets;
    if (!f || f.state === 'dead') return;
    const chest = T.filter((t) => !t.weak && t.radius >= 9).sort((a, b) => b.position.y - a.position.y)[0].position, weak = (T.find((t) => t.weak && t.position.y > 30) || T.find((t) => t.weak)).position;
    const side = f.engaged ? -1 : 1, want = new THREE.Vector3(f.x + 85, 45, f.z + 6);
    if (f.state === 'breath' && f.lock) bot.y = 32; else if (f.state !== 'breath') bot.y = Math.max(0, bot.y - dt * 20);
    want.y += bot.y;
    mover.position.lerp(want, 1 - Math.exp(-dt * 3)); mover.velocity.set(0, 0, 0);
    const aimAt = f.state === 'frozen' || Math.sin(clock * 0.7) > 0.4 ? (weak || chest) : chest;
    api.aim(aimAt.x, aimAt.y, aimAt.z);
    controls.mouse = true;
    if (f.hp < f.max * 0.995 && clock > 14) controls.keys.add('KeyF'); else controls.keys.delete('KeyF');
  }

  function tick(dt) {
    clock += dt;
    if (phase === 'play') {
      if (q.get('auto') === '1') autopilot(dt);
      const a = performance.now();
      mover.update(dt, controls);
      round.update(dt, mover, hud, mover);
      timeLeft -= dt; round.timeLeft = Math.max(0, timeLeft); hud.set({ time: Math.max(0, timeLeft) });
      if (timeLeft <= 0) round.done = true;
      const u = performance.now() - a;
      perf.upd += (u - perf.upd) * 0.05; perf.updMax = Math.max(perf.updMax * 0.995, u);
      placePlayer(dt); chase.update(mover, controls, dt);
      controls.endFrame();
      if (round.done) finish();
    }
    world.tick(dt, camera);
  }

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const raw = now - last, dt = Math.min(0.05, raw / 1000); last = now;
    if (perf.frames > 5) { perf.dt += (raw - perf.dt) * 0.05; perf.dtMax = Math.max(perf.dtMax * 0.995, raw); }
    if (!window.__boss.manual) tick(dt);
    const a = performance.now();
    if (world.scene) renderer.render(world.scene, camera);
    perf.frames++; const ms = performance.now() - a; perf.frame += (ms - perf.frame) * 0.05; perf.frameMax = Math.max(perf.frameMax * 0.99, ms);
    perf.calls = renderer.info.render.calls; perf.tris = renderer.info.render.triangles;
    if (perf.frames % 10 === 0) {
      const f = round?.debug?.fight;
      $('stats').textContent = `frame ${perf.dt.toFixed(1)} ms (max ${perf.dtMax.toFixed(0)})  render call ${perf.frame.toFixed(1)} ms  update ${perf.upd.toFixed(2)} ms (max ${perf.updMax.toFixed(1)})\ncalls ${perf.calls}  tris ${perf.tris}  rebuilds ${perf.rebuilds} (${perf.rebuilds ? (perf.rebuildMs / perf.rebuilds).toFixed(0) : 0} ms avg)`
        + (f ? `\nkaiju ${f.state} hp ${Math.round(f.hp)} aggro ${f.aggro.toFixed(2)} @ ${Math.round(f.x)},${Math.round(f.z)}` : '');
    }
  });

  addEventListener('keydown', (e) => { if (e.code === 'KeyR') start(); });

  const api = {
    manual: false, world, memory, group, camera, renderer, hud, perf, THREE, models, controls, aimDirection,
    get round() { return round; }, get fight() { return round?.debug?.fight; }, get mover() { return mover; }, get phase() { return phase; }, get player() { return player; },
    // Advance the sim without waiting for frames (render once after, for a screenshot).
    step(seconds, dt = 1 / 30) { const was = this.manual; this.manual = true; for (let t = 0; t < seconds && phase === 'play'; t += dt) tick(dt); this.manual = was; },
    // Point the hero's aim (and camera) at a world position.
    aim(x, y, z) {
      const e = mover.position, dx = x - e.x, dy = y - (e.y + 1.6), dz = z - e.z, L = Math.hypot(dx, dy, dz);
      controls.yaw = Math.atan2(-dx, -dz); controls.pitch = Math.asin(dy / L) - AIM_PITCH;
    },
    // A spectator camera for screenshots (call after step(); the next tick() puts the chase camera back).
    look(px, py, pz, tx, ty, tz, fov = 60) { camera.position.set(px, py, pz); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(tx, ty, tz); },
    tp(x, y, z) { mover.teleport(new THREE.Vector3(x, y, z)); chase.snap(mover, controls); placePlayer(0); },
    hold({ laser = false, ice = false } = {}) { controls.mouse = laser; if (ice) controls.keys.add('KeyF'); else controls.keys.delete('KeyF'); },
    restart: start,
    result: () => round.results(),
  };
  window.__boss = api;
  start();
}

if (q.get('view') === 'kaiju') modelView(); else fight();
