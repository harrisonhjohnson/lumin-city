import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The hero's two powers for the kaiju fight: laser vision (hold left mouse or L) and ice
// breath (hold right mouse or F). Both aim where the mouse points, the same direction W flies.
//   const powers = createPowers({ scene, camera, group, heatRate });   // effects live in `group`, which survives city rebuilds; camera is optional (it sizes the particles)
//   const hits = powers.update(dt, mover, controls, targets);  // every frame while the round runs
//   targets = [{ id, position, radius, weak? } | { id, object3D, radius?, weak? }, ...]
//   hits[i] = { id, kind: 'laser' | 'ice', target, weak, point, dist, dt, slow }
//     laser: one hit per frame (the nearest target on the ray), dt = seconds of exposure;
//     ice: one per target inside the cone, slow = seconds the target stays slowed.
// `hits` and its records are reused: read them in the same frame, copy what you keep.
export const LASER = { range: 180, eye: 1.6, gap: 0.2, heatUp: 0.22, cool: 0.45, coolHot: 0.35, resume: 0.3 };
export const ICE = { length: 25, half: 0.42, drain: 0.34, refill: 0.14, delay: 0.7, min: 0.15, slow: 3.2 };
export const WEAK_REACH = 3;    // a weak point on a body's surface beats the body when the ray reaches both within this many metres
export const AIM_PITCH = 0.2;   // rig.js flight flies along pitch + 0.2, so aiming does too

// Heat builds while firing; at 1 the eyes shut down until they cool below `resume`.
export function stepLaser(s, want, dt, rate = 1) {
  if (s.overheated && s.heat <= LASER.resume) s.overheated = false;
  s.firing = want && !s.overheated;
  if (s.firing) {
    s.heat = Math.min(1, s.heat + dt * LASER.heatUp * rate);
    if (s.heat >= 1) { s.overheated = true; s.firing = false; }
  } else s.heat = Math.max(0, s.heat - dt * (s.overheated ? LASER.coolHot : LASER.cool));
  return s;
}

// Charge drains while breathing, refills after a short rest; it needs `min` to start again.
export function stepIce(s, want, dt) {
  s.firing = want && s.charge > (s.firing ? 0 : ICE.min);
  if (s.firing) { s.charge = Math.max(0, s.charge - dt * ICE.drain); s.idle = 0; }
  else { s.idle += dt; if (s.idle > ICE.delay) s.charge = Math.min(1, s.charge + dt * ICE.refill); }
  return s;
}

export function aimDirection(yaw, pitch, out) {
  const p = pitch + AIM_PITCH, c = Math.cos(p);
  return out.set(-Math.sin(yaw) * c, Math.sin(p), -Math.cos(yaw) * c);
}

// Distance along a unit-length ray to a sphere, or -1.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const px = cx - ox, py = cy - oy, pz = cz - oz, b = px * dx + py * dy + pz * dz;
  const d2 = px * px + py * py + pz * pz - b * b, h = r * r - d2;
  if (h < 0) return -1;
  const t = b - Math.sqrt(h);
  return t >= 0 ? t : b + Math.sqrt(h) >= 0 ? 0 : -1;
}

// Is a sphere touching a cone (apex o, unit axis d, length L, half-angle tan = k)?
export function inCone(ox, oy, oz, dx, dy, dz, L, k, cx, cy, cz, r) {
  const px = cx - ox, py = cy - oy, pz = cz - oz, along = px * dx + py * dy + pz * dz;
  if (along < -r || along > L + r) return false;
  const d2 = px * px + py * py + pz * pz - along * along, reach = Math.max(0, along) * k + r;
  return d2 <= reach * reach;
}

let soft = null;
function softTexture() {
  if (soft || typeof document === 'undefined') return soft;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  soft = new THREE.CanvasTexture(c);
  soft.colorSpace = THREE.SRGBColorSpace;
  return soft;
}

// A fixed pool of soft sprites in one Points draw. emit() overwrites the oldest slot, so nothing
// is allocated after construction. Size is in metres at the particle; colours ramp c0 -> c1 -> c2 over its life.
export function createParticles(group, { max = 256, colours, additive = true, alpha = 1, drag = 0, gravity = 0 }) {
  const pos = new Float32Array(max * 3), vel = new Float32Array(max * 3), age = new Float32Array(max).fill(1), life = new Float32Array(max).fill(1);
  const size = new Float32Array(max), size0 = new Float32Array(max), size1 = new Float32Array(max), kind = new Float32Array(max);
  const geometry = new THREE.BufferGeometry();
  const attr = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attr(pos, 3));
  geometry.setAttribute('aAge', attr(age, 1));
  geometry.setAttribute('aSize', attr(size, 1));
  geometry.setAttribute('aKind', attr(kind, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    uniforms: { uPx: { value: 600 }, uAlpha: { value: alpha }, uC0: { value: new THREE.Color(colours[0]) }, uC1: { value: new THREE.Color(colours[1]) }, uC2: { value: new THREE.Color(colours[2]) } },
    vertexShader: `attribute float aAge; attribute float aSize; attribute float aKind; uniform float uPx; varying float vAge; varying float vKind;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx / max(-mv.z, 0.1), 0.0, 260.0) * (1.0 - step(0.999, aAge));
  vAge = aAge; vKind = aKind;
}`,
    fragmentShader: `uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform float uAlpha; varying float vAge; varying float vKind;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a = vKind > 0.5 ? smoothstep(0.5, 0.3, abs(p.x) + abs(p.y)) : smoothstep(0.5, 0.04, length(p));
  vec3 c = vAge < 0.5 ? mix(uC0, uC1, vAge * 2.0) : mix(uC1, uC2, (vAge - 0.5) * 2.0);
  float fade = smoothstep(0.0, 0.08, vAge) * (1.0 - smoothstep(0.5, 1.0, vAge));
  gl_FragColor = vec4(c, a * fade * uAlpha);
}`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  group.add(points);
  let next = 0;
  const api = {
    points, max,
    emit(x, y, z, vx, vy, vz, secs, s0, s1, k = 0) {
      const i = next; next = (next + 1) % max;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      age[i] = 0; life[i] = secs; size0[i] = s0; size1[i] = s1; size[i] = s0; kind[i] = k;
    },
    update(dt, camera) {
      const fall = Math.exp(-drag * dt);
      for (let i = 0; i < max; i++) {
        if (age[i] >= 1) continue;
        const a = Math.min(1, age[i] + dt / life[i]);
        age[i] = a;
        const o = i * 3;
        vel[o] *= fall; vel[o + 1] = vel[o + 1] * fall + gravity * dt; vel[o + 2] *= fall;
        pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
        size[i] = size0[i] + (size1[i] - size0[i]) * a;
      }
      const fov = camera?.fov ?? 62, h = typeof window === 'undefined' ? 800 : window.innerHeight, pr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.7);
      material.uniforms.uPx.value = (h * pr / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
      geometry.attributes.position.needsUpdate = true; geometry.attributes.aAge.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true; geometry.attributes.aKind.needsUpdate = true;
    },
    dispose() { points.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
  return api;
}

const rand = (a, b) => a + Math.random() * (b - a);

// One beam, nested open tubes ([radius, rgb] per layer) merged into a single unit-length mesh along +y.
// The first `fadeIn` of its length ramps up from dark, so a beam seen end-on from just behind its origin is not a wall of light.
export const LASER_LAYERS = [[0.035, [1, 0.85, 0.75]], [0.11, [1, 0.28, 0.16]], [0.3, [0.55, 0.08, 0.05]]];
export function beamGeometry(layers = LASER_LAYERS, fadeIn = 0.14) {
  const layer = ([r, rgb]) => {
    const g = new THREE.CylinderGeometry(r, r, 1, 8, 8, true).translate(0, 0.5, 0).toNonIndexed();
    g.deleteAttribute('uv');
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const u = fadeIn ? Math.min(1, p.getY(i) / fadeIn) : 1, k = fadeIn ? u * u * (3 - 2 * u) : 1;
      col[i * 3] = rgb[0] * k; col[i * 3 + 1] = rgb[1] * k; col[i * 3 + 2] = rgb[2] * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  return mergeGeometries(layers.map(layer));
}
export function beamMaterial() {
  return new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
}

export const UP = new THREE.Vector3(0, 1, 0);

export function createPowers({ camera, group, heatRate = 1 }) {   // `scene` is accepted but unused: effects live in `group`; heatRate 0.5 is the coolant upgrade
  const laser = { heat: 0, firing: false, overheated: false };
  const ice = { charge: 1, firing: false, idle: 0 };
  const hits = [];
  const pool = [];
  let used = 0;
  const take = () => {
    if (used === pool.length) pool.push({ id: null, kind: '', target: null, weak: false, point: new THREE.Vector3(), dist: 0, dt: 0, slow: 0 });
    return pool[used++];
  };

  const beamGeo = beamGeometry();
  const beamMat = beamMaterial();
  const beams = [0, 1].map(() => { const m = new THREE.Mesh(beamGeo, beamMat); m.visible = false; m.frustumCulled = false; m.renderOrder = 6; group.add(m); return m; });
  const tex = softTexture();
  const flare = (colour, scale) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: colour, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    s.scale.setScalar(scale); s.visible = false; s.renderOrder = 7; group.add(s);
    return s;
  };
  const muzzles = [flare('#ff5a3a', 0.9), flare('#ff5a3a', 0.9)], impact = flare('#ffb36b', 4), chill = flare('#9fe6ff', 2.4);

  const frost = createParticles(group, { max: 360, colours: ['#ffffff', '#a8e4ff', '#4f9bff'], alpha: 0.6, drag: 0.7 });
  const sparks = createParticles(group, { max: 160, colours: ['#fff1b8', '#ff8a2e', '#b32314'], alpha: 1, drag: 0.4, gravity: -22 });

  // The reticle floats where the beams point and carries both gauges: heat on the left, charge on the right.
  const rc = typeof document === 'undefined' ? null : document.createElement('canvas');
  let reticle = null, ctx2d = null, tex2 = null, sig = -1;
  if (rc) {
    rc.width = rc.height = 128;
    ctx2d = rc.getContext('2d');
    tex2 = new THREE.CanvasTexture(rc); tex2.colorSpace = THREE.SRGBColorSpace;
    reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex2, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, fog: false, toneMapped: false }));
    reticle.scale.setScalar(0.1); reticle.renderOrder = 999; reticle.visible = false; group.add(reticle);
  }
  const arc = (a0, a1, w, style) => { ctx2d.beginPath(); ctx2d.arc(64, 64, 46, a0, a1); ctx2d.lineWidth = w; ctx2d.lineCap = 'round'; ctx2d.strokeStyle = style; ctx2d.stroke(); };
  function paint(t) {
    const h = Math.round(laser.heat * 24), c = Math.round(ice.charge * 24), f = laser.firing ? 1 : 0, g = ice.firing ? 1 : 0, o = laser.overheated ? 1 + (Math.floor(t * 6) & 1) : 0;
    const key = (((h * 25 + c) * 2 + f) * 2 + g) * 3 + o;
    if (key === sig) return;
    sig = key;
    ctx2d.clearRect(0, 0, 128, 128);
    const span = 1.15;
    for (const [side, frac, hot] of [[-1, h / 24, true], [1, c / 24, false]]) {
      const mid = side < 0 ? Math.PI : 0;
      arc(mid - span / 2, mid + span / 2, 9, 'rgba(12,14,20,0.55)');
      if (frac > 0.01) {
        // The fill grows from the bottom of the arc upward.
        const a0 = mid + side * span / 2, a1 = a0 - side * span * frac;
        const style = hot ? (o ? (o === 2 ? '#ffd0a0' : '#ff3b2a') : `rgb(255,${Math.round(90 + frac * 150)},${Math.round(60 + frac * 130)})`) : '#8fe3ff';
        arc(Math.min(a0, a1), Math.max(a0, a1), 6, style);
      }
    }
    ctx2d.beginPath(); ctx2d.arc(64, 64, f || g ? 11 : 7, 0, Math.PI * 2);
    ctx2d.lineWidth = 3; ctx2d.strokeStyle = f ? '#ff6a4a' : g ? '#9fe6ff' : 'rgba(255,255,255,0.85)'; ctx2d.stroke();
    ctx2d.beginPath(); ctx2d.arc(64, 64, 2.4, 0, Math.PI * 2); ctx2d.fillStyle = f ? '#ffd0c0' : '#ffffff'; ctx2d.fill();
    tex2.needsUpdate = true;
  }

  // The right button breathes ice. Its context menu is cancelled while a round runs (the canvas only).
  let rmb = false;
  const onDown = (e) => { if (e.button === 2) rmb = true; };
  const onUp = (e) => { if (e.button === 2) rmb = false; };
  const onMenu = (e) => { if (typeof HTMLCanvasElement !== 'undefined' && e.target instanceof HTMLCanvasElement) e.preventDefault(); };
  const onBlur = () => { rmb = false; };
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', onDown); document.addEventListener('pointerup', onUp);
    document.addEventListener('contextmenu', onMenu, true); window.addEventListener('blur', onBlur);
  }

  const aim = new THREE.Vector3(), eye = new THREE.Vector3(), side = new THREE.Vector3(), end = new THREE.Vector3(), start = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3(), mouth = new THREE.Vector3();
  const caster = new THREE.Raycaster(), found = [];
  let level = 0, hitNow = false, lastLen = LASER.range, flicker = 0, clock = 0, sparkAcc = 0, frostAcc = 0;
  const hitPoint = new THREE.Vector3();

  // Where a target is and how big: spheres by position, or an object's world position.
  const centre = (t, out) => (t.position ? out.copy(t.position) : t.object3D.getWorldPosition(out));

  // The nearest thing on the ray. A weak point sitting on a body's surface wins a tie: it gets WEAK_REACH metres of benefit.
  function scanLaser(dt, targets) {
    let best = null, bt = LASER.range, bd = 0;
    for (const t of targets) {
      if (t.disabled) continue;
      let d = -1;
      if (t.radius || t.position) {
        centre(t, tmp);
        d = raySphere(eye.x, eye.y, eye.z, aim.x, aim.y, aim.z, tmp.x, tmp.y, tmp.z, t.radius ?? 1);
      } else if (t.object3D) {
        caster.set(eye, aim); caster.far = LASER.range; found.length = 0;
        caster.intersectObject(t.object3D, true, found);
        if (found.length) d = found[0].distance;
      }
      const eff = d - (t.weak ? WEAK_REACH : 0);
      if (d >= 0 && eff < bt) { bt = eff; bd = d; best = t; }
    }
    hitNow = !!best;
    if (!best) { hitPoint.copy(aim).multiplyScalar(LASER.range).add(eye); return LASER.range; }
    hitPoint.copy(aim).multiplyScalar(bd).add(eye);
    const h = take();
    h.id = best.id; h.kind = 'laser'; h.target = best; h.weak = !!best.weak; h.dist = bd; h.dt = dt; h.slow = 0; h.point.copy(hitPoint);
    hits.push(h);
    return bd;
  }

  function scanIce(dt, targets) {
    for (const t of targets) {
      if (t.disabled || !(t.radius || t.position)) continue;
      centre(t, tmp);
      const r = t.radius ?? 1;
      if (!inCone(eye.x, eye.y, eye.z, aim.x, aim.y, aim.z, ICE.length, ICE.half, tmp.x, tmp.y, tmp.z, r)) continue;
      const h = take();
      h.id = t.id; h.kind = 'ice'; h.target = t; h.weak = !!t.weak; h.dt = dt; h.slow = ICE.slow;
      dir.copy(eye).sub(tmp); h.dist = Math.max(0, dir.length() - r);
      h.point.copy(tmp).addScaledVector(dir.normalize(), r * 0.8);
      hits.push(h);
      frostAcc += dt * 40;
      while (frostAcc >= 1) {
        frostAcc -= 1;
        frost.emit(h.point.x + rand(-1, 1) * r * 0.4, h.point.y + rand(-1, 1) * r * 0.4, h.point.z + rand(-1, 1) * r * 0.4, rand(-3, 3), rand(0, 4), rand(-3, 3), rand(0.8, 1.4), 1.2, 4 + r * 0.25, Math.random() < 0.3 ? 1 : 0);
      }
    }
  }

  function aimBeams(len) {
    for (let i = 0; i < 2; i++) {
      start.copy(eye).addScaledVector(side, i ? LASER.gap : -LASER.gap);
      end.copy(hitNow ? hitPoint : tmp.copy(aim).multiplyScalar(len).add(start));
      dir.copy(end).sub(start);
      const L = dir.length();
      if (L < 0.01) { beams[i].visible = false; continue; }
      const b = beams[i];
      b.visible = true;
      b.position.copy(start);
      b.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / L));
      const w = level * (0.85 + flicker * 0.3) * (0.8 + laser.heat * 0.45);
      b.scale.set(w, L, w);
    }
  }

  function update(dt, mover, controls, targets) {
    clock += dt; used = 0; hits.length = 0;
    const live = controls.enabled !== false;
    stepLaser(laser, live && (controls.mouse || controls.keys.has('KeyL')), dt, heatRate);
    stepIce(ice, live && (controls.keys.has('KeyF') || rmb), dt);
    aimDirection(controls.yaw, controls.pitch, aim);
    eye.copy(mover.position); eye.y += LASER.eye;
    side.set(aim.z, 0, -aim.x).normalize();

    level += ((laser.firing ? 1 : 0) - level) * Math.min(1, dt * (laser.firing ? 30 : 16));
    flicker = Math.sin(clock * 70) * Math.sin(clock * 41);
    if (laser.firing) lastLen = scanLaser(dt, targets);
    if (level > 0.02) {
      aimBeams(lastLen);
      for (let i = 0; i < 2; i++) { muzzles[i].visible = true; muzzles[i].position.copy(eye).addScaledVector(side, i ? LASER.gap : -LASER.gap).addScaledVector(aim, 0.3); muzzles[i].material.opacity = level * (0.7 + flicker * 0.3); }
      impact.visible = hitNow && laser.firing;
      if (hitNow && laser.firing) {
        const hit = hits[hits.length - 1], weak = hit.weak;
        impact.position.copy(hitPoint); impact.scale.setScalar((weak ? 6 : 4) * (0.8 + Math.abs(flicker) * 0.4)); impact.material.color.set(weak ? '#ffe39a' : '#ffb36b');
        sparkAcc += dt * (weak ? 110 : 70);
        while (sparkAcc >= 1) {
          sparkAcc -= 1;
          const s = rand(10, 34), th = rand(0, Math.PI * 2), up = rand(0.1, 1);
          sparks.emit(hitPoint.x, hitPoint.y, hitPoint.z, (-aim.x * 0.6 + Math.cos(th) * (1 - up)) * s, (-aim.y * 0.6 + up) * s, (-aim.z * 0.6 + Math.sin(th) * (1 - up)) * s, rand(0.25, 0.6), weak ? 0.9 : 0.6, 0.1, Math.random() < 0.5 ? 1 : 0);
        }
      }
    } else {
      for (const b of beams) b.visible = false;
      for (const m of muzzles) m.visible = false;
      impact.visible = false;
    }

    chill.visible = ice.firing;
    if (ice.firing) {
      mouth.copy(eye).addScaledVector(aim, 1.2); mouth.y -= 0.25;
      chill.position.copy(mouth); chill.scale.setScalar(2.2 + Math.sin(clock * 30) * 0.4);
      const n = Math.round(dt * 170 + Math.random() * 0.5);
      for (let i = 0; i < n; i++) {
        const sp = rand(26, 40), a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * ICE.half * 0.85;
        tmp.set(aim.x + (side.x * Math.cos(a) * r), aim.y + Math.sin(a) * r, aim.z + (side.z * Math.cos(a) * r)).normalize();
        frost.emit(mouth.x, mouth.y, mouth.z, tmp.x * sp + mover.velocity.x * 0.5, tmp.y * sp + mover.velocity.y * 0.5, tmp.z * sp + mover.velocity.z * 0.5, rand(0.5, 0.78), rand(0.1, 0.35), rand(2.6, 4.6), Math.random() < 0.22 ? 1 : 0);
      }
      scanIce(dt, targets);
    }

    frost.update(dt, camera);
    sparks.update(dt, camera);

    if (reticle) {
      reticle.visible = live;
      if (live) { reticle.position.copy(eye).addScaledVector(aim, 60); paint(clock); }
    }
    return hits;
  }

  function dispose() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', onDown); document.removeEventListener('pointerup', onUp);
      document.removeEventListener('contextmenu', onMenu, true); window.removeEventListener('blur', onBlur);
    }
    for (const b of beams) b.removeFromParent();
    for (const s of [...muzzles, impact, chill]) { s.removeFromParent(); s.material.dispose(); }
    beamGeo.dispose(); beamMat.dispose();
    frost.dispose(); sparks.dispose();
    if (reticle) { reticle.removeFromParent(); reticle.material.dispose(); tex2.dispose(); }
  }

  return { update, laser, ice, hits, dispose };
}
