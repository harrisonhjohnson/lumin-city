import * as THREE from 'three';
import { stepSwing, pickAnchor, EYE_HEIGHT, JUMP_SPEED, WALL_KICK } from '../room/swing-physics.js';
import { WORLD } from '../world/city/bible.js';
import { floorAt } from './streets.js';

// Input + movement + chase camera for every minigame. A mover is one of:
//   vehicle  steers by heading (A/D), W throttle, S brake/reverse, Space hop (board) or handbrake (car)
//   foot     moves relative to the camera, Shift sprints, Space jumps
//   swing    the swing city's physics (hold mouse / Shift to web), third person
//   flight   free flight relative to the camera; Space rises, C/Ctrl sinks, Shift boosts
// The camera orbits with the mouse (pointer lock) and trails the mover.
export const MOVERS = {
  board:   { kind: 'vehicle', max: 17, accel: 11, brake: 18, turn: 2.6, grip: 7, hop: 9, radius: 0.5, cam: [5.5, 2.4] },
  car:     { kind: 'vehicle', max: 44, accel: 17, brake: 26, turn: 1.9, grip: 3.2, drift: true, radius: 1.3, cam: [9, 3.6] },
  scooter: { kind: 'vehicle', max: 25, accel: 12, brake: 22, turn: 2.4, grip: 5, radius: 0.8, cam: [6.5, 2.8] },
  foot:    { kind: 'foot', max: 5.5, sprint: 9.5, accel: 30, jump: 7, radius: 0.45, cam: [5, 2.2] },
  swing:   { kind: 'swing', radius: 0.42, cam: [7, 2.4] },
  flight:  { kind: 'flight', max: 34, boost: 62, accel: 40, radius: 1, cam: [8, 2.6] },
};
const GRAVITY = 22;

export function createControls(canvas) {
  const keys = new Set();
  const c = { keys, yaw: 0, pitch: -0.2, mouse: false, pressed: new Set(), enabled: false };
  const list = [];
  const on = (t, e, f, o) => { t.addEventListener(e, f, o); list.push([t, e, f, o]); };
  const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  on(document, 'keydown', (e) => {
    if (!c.enabled || e.target instanceof HTMLInputElement) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!e.repeat) c.pressed.add(e.code);
    keys.add(e.code);
  });
  on(document, 'keyup', (e) => keys.delete(e.code));
  on(window, 'blur', () => { keys.clear(); c.mouse = false; });
  on(canvas, 'pointerdown', (e) => {
    if (!c.enabled) return;
    if (e.button === 0) c.mouse = true;
    if (!document.pointerLockElement) canvas.requestPointerLock?.()?.catch?.(() => {});
  });
  on(document, 'pointerup', (e) => { if (e.button === 0) c.mouse = false; });
  on(document, 'mousemove', (e) => {
    if (!c.enabled || document.pointerLockElement !== canvas) return;
    c.yaw -= e.movementX * 0.0024;
    c.pitch = THREE.MathUtils.clamp(c.pitch - e.movementY * 0.002, -1.2, 0.9);
  });
  c.axis = (plus, minus) => Number(plus.some((k) => keys.has(k))) - Number(minus.some((k) => keys.has(k)));
  c.took = (code) => c.pressed.delete(code);   // true once per key press
  c.endFrame = () => c.pressed.clear();
  c.release = () => { document.exitPointerLock?.(); keys.clear(); c.mouse = false; };
  c.dispose = () => { for (const [t, e, f, o] of list) t.removeEventListener(e, f, o); };
  return c;
}

// solids() returns a list of AABB lists: [buildings, moving vehicles, ...].
export function createMover(type, { at, heading = 0, solids, anchors }) {
  const M = MOVERS[type];
  const eye = M.kind === 'swing' ? EYE_HEIGHT : 0;
  const m = {
    type, M,
    position: at.clone().setY(Math.max(at.y, 0) + eye),
    velocity: new THREE.Vector3(),
    heading, speed: 0, grounded: true, air: 0, lean: 0, drifting: false,
    swing: M.kind === 'swing' ? { anchor: null, ropeLength: 0, wall: null } : null,
    get feet() { return this.position.clone().setY(this.position.y - eye); },
    bumped: 0,
  };
  m.update = (dt, c) => STEP[M.kind](m, dt, c, solids(), anchors);
  m.teleport = (p, h = m.heading) => { m.position.copy(p).setY(p.y + eye); m.velocity.set(0, 0, 0); m.speed = 0; m.heading = h; if (m.swing) m.swing.anchor = null; };
  return m;
}

const STEP = {
  vehicle(m, dt, c, solids) {
    const M = m.M;
    const throttle = c.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']), steer = c.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const max = M.max * (m.boosting ? 1.4 : 1), accel = M.accel * (m.boosting ? 1.8 : 1);
    if (throttle > 0) m.speed += accel * dt * (1 - Math.max(0, m.speed) / max * 0.6);
    else if (throttle < 0) m.speed -= (m.speed > 0 ? M.brake : M.accel * 0.5) * dt;
    else m.speed -= Math.sign(m.speed) * Math.min(Math.abs(m.speed), 3 * dt);
    m.speed = THREE.MathUtils.clamp(m.speed, -M.max * 0.3, max);
    m.drifting = !!M.drift && c.keys.has('Space') && Math.abs(m.speed) > 12;
    const turnScale = Math.min(1, Math.abs(m.speed) / 6) * Math.sign(m.speed || 1);
    m.heading += steer * M.turn * (m.drifting ? 1.55 : 1) * turnScale * dt;
    m.lean = THREE.MathUtils.damp(m.lean, -steer * Math.min(1, Math.abs(m.speed) / M.max) * 0.35, 8, dt);
    // Velocity chases the heading at the grip rate: low grip slides, drifting slides more.
    const want = new THREE.Vector3(-Math.sin(m.heading), 0, -Math.cos(m.heading)).multiplyScalar(m.speed);
    const grip = m.drifting ? M.grip * 0.25 : M.grip;
    m.velocity.x = THREE.MathUtils.damp(m.velocity.x, want.x, grip, dt);
    m.velocity.z = THREE.MathUtils.damp(m.velocity.z, want.z, grip, dt);
    if (M.hop && m.grounded && c.took('Space')) { m.velocity.y = M.hop; m.grounded = false; }
    gravity(m, dt);
    if (!m.grounded) m.air += dt;
    m.position.addScaledVector(m.velocity, dt);
    ground(m);
    const hit = collide(m.position, M.radius, solids, m.position.y);
    // One knock per impact: something pressed against you (a car nosing into your bumper) mustn't
    // pin your speed every frame, or you can never pull away.
    if (hit && m.bumped <= 0 && Math.abs(m.speed) > 4) { m.speed *= 0.45; m.velocity.multiplyScalar(0.45); m.bumped = 0.6; }
    m.bumped = Math.max(0, m.bumped - dt);
    bounds(m);
  },
  foot(m, dt, c, solids) {
    const M = m.M;
    const f = c.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']), s = c.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
    const max = c.keys.has('ShiftLeft') || c.keys.has('ShiftRight') ? M.sprint : M.max;
    const dir = new THREE.Vector3(-Math.sin(c.yaw) * f + Math.cos(c.yaw) * s, 0, -Math.cos(c.yaw) * f - Math.sin(c.yaw) * s);
    if (dir.lengthSq() > 1) dir.normalize();
    const k = m.grounded ? 12 : 2;
    m.velocity.x = THREE.MathUtils.damp(m.velocity.x, dir.x * max, k, dt);
    m.velocity.z = THREE.MathUtils.damp(m.velocity.z, dir.z * max, k, dt);
    if (dir.lengthSq() > 0.01) m.heading = dampAngle(m.heading, Math.atan2(-dir.x, -dir.z), 12, dt);
    if (m.grounded && c.took('Space')) { m.velocity.y = M.jump; m.grounded = false; }
    gravity(m, dt);
    m.position.addScaledVector(m.velocity, dt);
    ground(m);
    collide(m.position, M.radius, solids, m.position.y);
    m.speed = Math.hypot(m.velocity.x, m.velocity.z);
    bounds(m);
  },
  swing(m, dt, c, solids, anchors) {
    const s = m.swing;
    const state = { position: m.position, velocity: m.velocity, anchor: s.anchor, ropeLength: s.ropeLength, grounded: m.grounded, wall: s.wall };
    const look = new THREE.Vector3(-Math.sin(c.yaw) * Math.cos(c.pitch + 0.35), Math.sin(c.pitch + 0.35), -Math.cos(c.yaw) * Math.cos(c.pitch + 0.35));
    look.y = Math.max(0.18, look.y); look.normalize();
    m.candidate = pickAnchor(m.position, look, anchors);
    const holding = c.mouse || c.keys.has('ShiftLeft') || c.keys.has('ShiftRight');
    if (holding && !state.anchor && m.candidate) { state.anchor = m.candidate.clone(); state.ropeLength = m.position.distanceTo(state.anchor) * 0.84; }
    if (!holding) state.anchor = null;
    if (c.took('Space')) {
      if (state.grounded) { m.velocity.y = JUMP_SPEED; state.grounded = false; m.velocity.addScaledVector(new THREE.Vector3(-Math.sin(c.yaw), 0, -Math.cos(c.yaw)), 8); }
      else if (state.wall) { m.velocity[state.wall.axis] = state.wall.dir * WALL_KICK.out; m.velocity.y = WALL_KICK.up; state.wall = null; }
    }
    const input = { yaw: c.yaw, forward: c.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']), side: c.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) };
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < steps; i++) stepSwing(state, input, dt / steps, solids[0]);
    for (const list of solids.slice(1)) collide(m.position, m.M.radius, list, m.position.y - EYE_HEIGHT);
    Object.assign(s, { anchor: state.anchor, ropeLength: state.ropeLength, wall: state.wall });
    m.grounded = state.grounded;
    const flat = Math.hypot(m.velocity.x, m.velocity.z);
    if (flat > 0.5) m.heading = dampAngle(m.heading, Math.atan2(-m.velocity.x, -m.velocity.z), 8, dt);
    m.speed = m.velocity.length();
    if (!Number.isFinite(m.position.lengthSq())) m.position.set(0, 30, 0);
    bounds(m);
  },
  flight(m, dt, c, solids) {
    const M = m.M;
    const f = c.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']), s = c.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
    const u = c.axis(['Space'], ['KeyC', 'ControlLeft', 'KeyQ']);
    const boost = c.keys.has('ShiftLeft') || c.keys.has('ShiftRight');
    const cp = Math.cos(c.pitch + 0.2), sp = Math.sin(c.pitch + 0.2);
    const fwd = new THREE.Vector3(-Math.sin(c.yaw) * cp, sp, -Math.cos(c.yaw) * cp);
    const right = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    const want = fwd.multiplyScalar(f).addScaledVector(right, s).add(new THREE.Vector3(0, u, 0));
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(boost ? M.boost : M.max);
    m.velocity.lerp(want, 1 - Math.exp(-dt * 2.4));
    m.position.addScaledVector(m.velocity, dt);
    if (m.position.y < 1) { m.position.y = 1; m.velocity.y = Math.max(0, m.velocity.y); }
    if (m.position.y > WORLD.ceiling) m.position.y = WORLD.ceiling;
    const hit = collide(m.position, M.radius, solids, m.position.y - 1);
    if (hit) m.velocity.multiplyScalar(0.6);
    const flat = Math.hypot(m.velocity.x, m.velocity.z);
    if (flat > 1) m.heading = dampAngle(m.heading, Math.atan2(-m.velocity.x, -m.velocity.z), 6, dt);
    m.lean = THREE.MathUtils.damp(m.lean, -s * 0.5, 5, dt);
    m.speed = m.velocity.length();
    m.grounded = m.position.y < 1.05;
    bounds(m);
  },
};

function gravity(m, dt) { if (!m.grounded || m.velocity.y > 0) m.velocity.y -= GRAVITY * dt; }
function ground(m) {
  const floor = floorAt(m.position.x, m.position.z);
  if (m.position.y <= floor) { if (!m.grounded) m.landed = m.air; m.position.y = floor; m.velocity.y = 0; m.grounded = true; m.air = 0; }
  else { m.grounded = false; }
}
function bounds(m) {
  const p = m.position;
  p.x = THREE.MathUtils.clamp(p.x, WORLD.x[0], WORLD.x[1]);
  p.z = THREE.MathUtils.clamp(p.z, WORLD.z[0], WORLD.z[1]);
}

// Push a circle out of every box it overlaps whose top is above `y`. Returns true on a hit.
export function collide(p, r, solids, y) {
  if (Array.isArray(solids[0])) return solids.reduce((hit, list) => collide(p, r, list, y) || hit, false);
  let hit = false;
  for (const b of solids) {
    if (y >= b.height - 0.05 || y + 1.8 < (b.bottom || 0) || p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
    const dx = [b.minX - r - p.x, b.maxX + r - p.x], dz = [b.minZ - r - p.z, b.maxZ + r - p.z];
    const ox = Math.abs(dx[0]) < Math.abs(dx[1]) ? dx[0] : dx[1], oz = Math.abs(dz[0]) < Math.abs(dz[1]) ? dz[0] : dz[1];
    if (Math.abs(ox) < Math.abs(oz)) p.x += ox; else p.z += oz;
    hit = true;
  }
  return hit;
}

function dampAngle(a, b, k, dt) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-k * dt));
}

// Third-person camera: sits behind and above the mover, aimed with the mouse. Vehicles pull
// the camera's yaw back behind the heading when the mouse is quiet.
export function createChaseCamera(camera) {
  const target = new THREE.Vector3(), want = new THREE.Vector3();
  let idle = 0, lastYaw = null;
  return {
    snap(m, c) { c.yaw = m.heading; lastYaw = c.yaw; this.update(m, c, 1, true); },
    update(m, c, dt, snap = false) {
      const [dist, height] = m.M.cam;
      // Without the mouse, the camera swings round behind the mover so keys alone can steer.
      idle = lastYaw !== null && Math.abs(c.yaw - lastYaw) < 1e-4 ? idle + dt : 0;
      if (idle > 0.6 && m.speed > 1) c.yaw = dampAngle(c.yaw, m.heading, m.M.kind === 'vehicle' ? 2.6 : 1.2, dt);
      lastYaw = c.yaw;
      const feet = m.feet;
      target.set(feet.x, feet.y + 1.4, feet.z);
      const pitch = c.pitch;
      const back = dist * (1 + Math.min(m.speed, 40) / 80);
      want.set(target.x + Math.sin(c.yaw) * back * Math.cos(pitch), target.y + height - Math.sin(pitch) * back, target.z + Math.cos(c.yaw) * back * Math.cos(pitch));
      want.y = Math.max(want.y, 0.6);
      if (snap) camera.position.copy(want); else camera.position.lerp(want, 1 - Math.exp(-dt * 9));
      camera.lookAt(target.x, target.y + 0.4, target.z);
      camera.fov = THREE.MathUtils.damp(camera.fov, 62 + Math.min(m.speed, 50) * 0.28, 3, dt);
      camera.updateProjectionMatrix();
    },
  };
}
