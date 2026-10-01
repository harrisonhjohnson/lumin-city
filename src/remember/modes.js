import * as THREE from 'three';
import * as models from './models.js';
import { intersections, roadPoint, doorPoint, floorAt, PARK, INNER_STREETS, INNER_AVENUES } from './streets.js';
import { rankFor } from './memory.js';
import { collide } from './rig.js';
import { PERKS } from './progress.js';
import { START, WORLD } from '../world/city/bible.js';
import { kaiju } from './boss.js';

// The minigames and free roam. Each create(ctx) returns a round: where to start, what the
// narrator says first, and update(dt, mover, hud) which places, checks and scores things.
//   ctx = { world, group, rng, memory, hud, name, life, town, controls, progress, switchTo, talkTo, earn, scale, found, clock }
//   group is a THREE.Group in the scene the round may fill; main.js empties it afterwards.
//   life is the moving city (life.js); town the persistent residents (town.js) — fares,
//   customers and victims are real people who pay from, and lose, their own money.
//   switchTo(perkGame | null) changes how free roam moves; earn(dollars) pays the player.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const near = (a, b, r) => a.distanceToSquared(b) < r * r;
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const compass = (from, to) => {
  const a = Math.atan2(to.x - from.x, -(to.z - from.z)) * 180 / Math.PI;
  return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(((a + 360) % 360) / 45) % 8];
};
const where = (from, to) => `${Math.round(flatDist(from, to))} m ${compass(from, to)}`;

function animated(group) {
  const list = [];
  group.traverse((o) => { if (o.userData.animate) list.push(o); });
  return list;
}
function place(group, model, at, rot = 0) { model.position.copy(at); model.rotation.y = rot; group.add(model); return model; }

// A grind rail from a to b: a bar on short posts, top at a.y.
const railMetal = new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.6, roughness: 0.35 });
const railPost = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.7 });
function makeRail(a, b) {
  const g = new THREE.Group(), L = a.distanceTo(b), mid = a.clone().lerp(b, 0.5), rise = a.y - floorAt(mid.x, mid.z);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, L), railMetal));
  const posts = Math.max(2, Math.round(L / 3.5));
  for (let k = 0; k < posts; k++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, rise, 0.08), railPost);
    post.position.set(0, -rise / 2, -L / 2 + 0.6 + (L - 1.2) * k / (posts - 1)); g.add(post);
  }
  g.position.copy(mid);
  g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  return g;
}

// Someone running away on foot: flees the player once they're close, around buildings.
function runner(group, world, outfit) {
  const model = models.makeAvatar(outfit);
  group.add(model);
  const r = { model, pos: new THREE.Vector3(), heading: 0, speed: 0, fleeing: false,
    reset(at) { r.pos.copy(at); r.fleeing = false; r.speed = 0; model.visible = true; },
    update(dt, t, from) {
      const dx = r.pos.x - from.x, dz = r.pos.z - from.z, d = Math.hypot(dx, dz);
      if (d < 45) r.fleeing = true;
      if (r.fleeing) {
        const want = Math.atan2(-dx, -dz) + Math.PI + Math.sin(t * 1.7) * 0.5;
        r.heading += Math.atan2(Math.sin(want - r.heading), Math.cos(want - r.heading)) * Math.min(1, dt * 4);
        r.speed = (d > 90 ? 3 : 7.2) * (r.slow || 1);
        r.pos.x -= Math.sin(r.heading) * r.speed * dt; r.pos.z -= Math.cos(r.heading) * r.speed * dt;
        collide(r.pos, 0.45, world.solids(), 0);
        r.pos.x = THREE.MathUtils.clamp(r.pos.x, WORLD.x[0] + 5, WORLD.x[1] - 5); r.pos.z = THREE.MathUtils.clamp(r.pos.z, WORLD.z[0] + 5, WORLD.z[1] - 5);
      }
      model.position.set(r.pos.x, floorAt(r.pos.x, r.pos.z), r.pos.z); model.rotation.y = r.heading;
      model.userData.animate?.(t, r.fleeing ? r.speed : 0, { air: false });
    },
  };
  return r;
}

// A tall beam of light so a target reads from anywhere in the city.
function beacon(colour) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 120, 12, 1, true), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 60; g.add(beam);
  return g;
}

export const MODES = {
  skate: {
    mover: 'board', ride: 'board', time: 90, outfit: { shirt: '#f2a93b', pants: '#3b4a5c', hat: 'helmet' },
    title: 'Skateboarding',
    intro: (m) => [
      m.year === '2100' ? 'You had a hoverboard by then. You still called it skateboarding.' : 'You had your board under one arm and the whole afternoon ahead of you.',
      'Grab the glowing memories. The high ones need a jump. Land on a rail to grind it.',
    ],
    controls: 'W push · A/D carve · SPACE ollie · land on rails to grind, A/D to balance',
    create({ practice = 1, upgrades = new Set(), group, rng, controls }) {
      const rails = [];
      for (let i = 0; i < 14; i++) {
        const ax = rng.pick(INNER_AVENUES), side = rng() < 0.5 ? -1 : 1, x = ax + side * 13.6;
        const k = rng.int(0, INNER_STREETS.length - 2), zc = (INNER_STREETS[k] + INNER_STREETS[k + 1]) / 2 + rng.range(-8, 8);
        rails.push({ a: V(x, 0.8, zc - 13), b: V(x, 0.8, zc + 13) });
      }
      const [px, pz] = PARK.at;
      for (const [x0, z0, x1, z1] of [[px - 45, pz - 4, px - 12, pz - 4], [px + 12, pz + 4, px + 45, pz + 4], [px - 4, pz - 26, px - 4, pz - 8], [px + 4, pz + 8, px + 4, pz + 26]]) rails.push({ a: V(x0, 1.15, z0), b: V(x1, 1.15, z1) });
      for (const rl of rails) { rl.len = rl.a.distanceTo(rl.b); rl.dir = rl.b.clone().sub(rl.a).setY(0).normalize(); group.add(makeRail(rl.a, rl.b)); }
      const orbs = [];
      for (const rl of rails) for (const f of [0.3, 0.7]) orbs.push({ model: place(group, models.makeOrb('#8fe3ff'), rl.a.clone().lerp(rl.b, f).add(V(0, 0.9, 0))), high: true, got: false });
      for (let i = 0; i < 40; i++) {
        const p = roadPoint(rng, { lane: rng.range(-6, 6) });
        const high = rng() < 0.3;
        p.y = high ? 3 : 0.9;
        orbs.push({ model: place(group, models.makeOrb(high ? '#ff8fb1' : '#ffd66b'), p), high, got: false });
      }
      let score = 0, combo = 0, comboT = 0, got = 0, bestAir = 0, grind = null, bestGrind = 0;
      const startGrind = (m, hud) => {
        if (m.velocity.y > 0.5 || m.speed < 4) return;
        const f = m.feet;
        for (const rl of rails) {
          const t = THREE.MathUtils.clamp((f.x - rl.a.x) * rl.dir.x + (f.z - rl.a.z) * rl.dir.z, 0, rl.len) / rl.len;
          const on = rl.a.clone().lerp(rl.b, t);
          if (Math.hypot(f.x - on.x, f.z - on.z) > 0.8 || f.y < rl.a.y - 0.45 || f.y > rl.a.y + 1.3 || t <= 0 || t >= 1) continue;
          const along = (m.velocity.x * rl.dir.x + m.velocity.z * rl.dir.z) / Math.max(0.1, Math.hypot(m.velocity.x, m.velocity.z));
          if (Math.abs(along) < 0.45) continue;
          grind = { rl, t, sign: Math.sign(along), balance: 0, time: 0 };
          combo = Math.min(combo + 1, 5); comboT = 4;
          hud.toast('Grind!', 'good');
          return;
        }
      };
      return {
        spawn: { at: V(0, 0, 60), heading: 0 },
        objective: 'Collect the glowing memories',
        update(dt, m, hud) {
          if (upgrades.has('big-pop') && !m.M.popped) m.M = { ...m.M, hop: 11.5, popped: true };
          comboT -= dt; if (comboT <= 0 && !grind) combo = 0;
          if (grind && m.velocity.y > 1) { score += 100 * combo; hud.toast(`Hopped off  +${100 * combo}`, 'good'); grind = null; }
          if (!grind && !m.grounded) startGrind(m, hud);
          if (grind) {
            const g = grind, sp = Math.max(Math.abs(m.speed), 9);
            g.time += dt; g.t += g.sign * sp * dt / g.rl.len;
            g.balance += (Math.sin(g.time * 2.3) * 0.9 + (rng() - 0.5) * 2) * dt * (1 + g.time * 0.25) * (upgrades.has('grip-tape') ? 0.5 : 1) - controls.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) * dt * 2.2;
            const pts = Math.round(160 * dt * combo); score += pts;
            if (Math.abs(g.balance) > 1) {
              hud.toast('Bailed!', 'bad'); combo = 0; grind = null; m.speed *= 0.3; m.velocity.multiplyScalar(0.3); hud.meter(null);
            } else if (g.t <= 0 || g.t >= 1) {
              bestGrind = Math.max(bestGrind, g.time); hud.toast(`${g.time.toFixed(1)} s grind`, 'good'); grind = null; m.velocity.y = 4; m.grounded = false; hud.meter(null);
            } else {
              const at = g.rl.a.clone().lerp(g.rl.b, g.t);
              m.position.set(at.x, g.rl.a.y, at.z);
              m.speed = sp; m.velocity.set(g.rl.dir.x * sp * g.sign, 0, g.rl.dir.z * sp * g.sign);
              m.heading = Math.atan2(-m.velocity.x, -m.velocity.z); m.lean = g.balance * 0.5; m.grounded = true; m.air = 0;
              hud.meter('Balance', 0.5 + g.balance / 2, { balance: true });
              comboT = 4;
            }
          }
          const body = m.feet.add(V(0, 0.9, 0));
          for (const o of orbs) {
            if (o.got || !near(body, o.model.position, upgrades.has('magnet') ? 2.6 : 1.5)) continue;
            o.got = true; o.model.visible = false; got++;
            combo = Math.min(combo + 1, 5); comboT = 3;
            const pts = (o.high ? 200 : 100) * combo; score += pts;
            hud.toast(combo > 1 ? `×${combo} combo  +${pts}` : `+${pts}`, 'good');
          }
          if (m.landed) {
            if (m.landed > 0.55) { const pts = Math.round(m.landed * 100); score += pts; hud.toast(`Air ${m.landed.toFixed(1)} s  +${pts}`, 'good'); }
            bestAir = Math.max(bestAir, m.landed); m.landed = 0;
          }
          if (got === orbs.length) this.done = true;
          hud.set({ score, objective: `Memories ${got}/${orbs.length}` });
        },
        guide: (m) => { let best = null, bd = Infinity; for (const o of orbs) if (!o.got) { const d = o.model.position.distanceToSquared(m.feet); if (d < bd) { bd = d; best = o.model.position; } } return best; },
        results: () => ({ score: Math.round(score * practice), rank: rankFor(score * practice, [6000, 4300, 2800, 1300]), lines: [{ label: 'Memories', value: `${got}/${orbs.length}` }, { label: 'Best air', value: `${bestAir.toFixed(1)} s` }, { label: 'Longest grind', value: `${bestGrind.toFixed(1)} s` }] }),
      };
    },
  },

  race: {
    mover: 'car', time: 150, outfit: { shirt: '#e0322b', hat: 'helmet' },
    ride: (m) => (m.year === '1900' ? 'carriage' : m.year === '2100' ? 'hover' : 'car'),
    title: 'Street race',
    intro: (m) => [
      m.year === '1900' ? 'A carriage race. Down the middle of the avenue. The police were not amused.' : m.year === '2100' ? 'Hover cars, down at street level where they were not supposed to be.' : 'Two laps. Up the avenue, across, down the other side.',
      'Hit every gate. Beat the red car. Drift to fill your nitro.',
    ],
    controls: 'W gas · S brake · A/D steer · SPACE drift · SHIFT nitro',
    create({ practice = 1, upgrades = new Set(), group, memory, controls }) {
      const loop = [V(0, 0, 100), V(0, 0, -500), V(140, 0, -500), V(140, 0, 140), V(0, 0, 140)];
      const gates = [V(0, 0, -100), V(0, 0, -340), V(70, 0, -500), V(140, 0, -300), V(140, 0, -60), V(70, 0, 140), V(0, 0, 100)];
      // Gates on the avenues span east–west; gates on the cross streets turn a quarter.
      const gateModels = gates.map((g, i) => place(group, models.makeGate(i === gates.length - 1 ? '#ffffff' : '#ffd66b'), g, g.x === 0 || g.x === 140 ? 0 : Math.PI / 2));
      const segs = loop.map((p, i) => [p, loop[(i + 1) % loop.length]]);
      const lapLength = segs.reduce((n, [a, b]) => n + a.distanceTo(b), 0);
      const pointAt = (d) => {
        d = ((d % lapLength) + lapLength) % lapLength;
        for (const [a, b] of segs) { const L = a.distanceTo(b); if (d <= L) return a.clone().lerp(b, d / L); d -= L; }
        return loop[0].clone();
      };
      const rivalModel = memory.year === '1900' ? models.makeHorseCarriage() : memory.year === '2100' ? models.makeHoverCar('#ff3d8b') : models.makeRaceCar('#c0392b');
      const rival = place(group, rivalModel, loop[0].clone().add(V(5, 0, 0)));
      let rivalD = 0, rivalV = 0, next = 0, lap = 1, t = 0, finished = false, won = false, score = 0, nitro = upgrades.has('big-tank') ? 1 : 0.4;
      const LAPS = 2;
      const show = () => gateModels.forEach((g, i) => { g.visible = i === next; });
      show();
      return {
        spawn: { at: V(-5, 0, 100), heading: 0 },
        objective: 'Lap 1/2 · next gate',
        guide: () => gates[next],
        update(dt, m, hud) {
          t += dt;
          if (upgrades.has('sticky-tyres') && !m.M.sticky) m.M = { ...m.M, grip: m.M.grip * 1.6, turn: m.M.turn * 1.15, sticky: true };
          if (m.drifting) nitro = Math.min(1, nitro + dt * 0.35 * (upgrades.has('big-tank') ? 2 : 1));
          m.boosting = nitro > 0 && (controls.keys.has('ShiftLeft') || controls.keys.has('ShiftRight'));
          if (m.boosting) nitro = Math.max(0, nitro - dt * 0.45);
          hud.meter('Nitro', nitro);
          if (!finished) {
            rivalV = Math.min(33, rivalV + dt * 9); rivalD += rivalV * dt;
            const p = pointAt(rivalD), ahead = pointAt(rivalD + 4);
            const lane = V(ahead.z - p.z, 0, -(ahead.x - p.x)).normalize().multiplyScalar(4);
            rival.position.copy(p).add(lane); rival.lookAt(ahead.clone().add(lane)); rival.rotateY(Math.PI);
            rival.userData.animate?.(t, rivalV);
          }
          if (!finished && flatDist(m.feet, gates[next]) < 11) {
            next++;
            if (next === gates.length) {
              if (lap === LAPS) {
                finished = true; won = rivalD < lapLength * LAPS;
                score = Math.max(0, Math.round((170 - t) * 40)) + (won ? 2500 : 0);
                hud.toast(won ? 'You won!' : 'Second place.', won ? 'good' : 'bad');
                this.done = true;
              } else { lap++; next = 0; hud.toast('Final lap!', 'good'); }
            } else hud.toast(`Gate ${next + (lap - 1) * gates.length}/${gates.length * LAPS}`, 'good');
            show();
          }
          if (!finished && rivalD >= lapLength * LAPS && !this.rivalDone) { this.rivalDone = true; hud.toast('The red car finished.', 'bad'); }
          const behind = rivalD > (lap - 1) * lapLength + (next ? loopDistTo(gates[next - 1]) : 0);
          hud.set({ score, objective: `Lap ${lap}/${LAPS} · gate ${next + 1}/${gates.length} · ${behind ? 'behind' : 'ahead'} · ${where(m.feet, gates[Math.min(next, gates.length - 1)])}` });
        },
        results: () => ({ score: Math.round(score * practice), rank: rankFor(score * practice, [6500, 5000, 3500, 1500]), subtitle: won ? 'First across the line.' : finished ? 'So close.' : 'Out of time.', lines: [{ label: 'Result', value: finished ? (won ? '1st' : '2nd') : 'DNF' }, { label: 'Time', value: `${t.toFixed(1)} s` }] }),
      };
      function loopDistTo(g) {
        let d = 0;
        for (const [a, b] of segs) {
          const L = a.distanceTo(b), ab = b.clone().sub(a), t0 = THREE.MathUtils.clamp(g.clone().sub(a).dot(ab) / (L * L), 0, 1);
          if (a.clone().lerp(b, t0).distanceTo(g) < 2) return d + t0 * L;
          d += L;
        }
        return 0;
      }
    },
  },

  heist: {
    mover: 'foot', ride: 'foot', time: 120, outfit: { shirt: '#2b2f3a', pants: '#1b1a17', hat: 'mask' },
    title: 'The heist',
    intro: (m) => [
      `The museum in the park. The ${m.year === '1900' ? 'Tsar\'s' : m.year === '2100' ? 'last real' : 'Star of the'} ${m.city === 'tokyo' ? 'Pearl' : 'Diamond'} was on display, right out front.`,
      'Get past the searchlights, grab the jewel, reach the van. Three strikes and you are done.',
    ],
    controls: 'WASD move · SHIFT sprint · SPACE jump · Q smoke bomb · E taser (if you bought them)',
    create({ practice = 1, upgrades = new Set(), group, rng, controls }) {
      const [px, pz] = PARK.at, [pw, , pd] = PARK.size;
      const north = pz - pd / 2;
      place(group, models.makeMuseumFacade(), V(px, 0.36, north + 2.5), Math.PI);
      const jewelAt = V(px, 0.36, north + 16);
      const jewel = place(group, models.makeJewel(), jewelAt);
      const vanAt = V(0, 0, pz - 10);
      const van = place(group, models.makeVan(), vanAt, Math.PI); van.visible = false;
      const lights = [];
      const spots = [[px - 40, pz + 20], [px + 40, pz + 20], [px - 20, pz - 12], [px + 22, pz - 8], [px + 14, pz + 3], [px - 45, pz - 20], [px + 45, pz - 22]];
      for (const [x, z] of spots) {
        const s = place(group, models.makeSearchlight(), V(x, 0.36, z));
        lights.push({ model: s, base: rng() * Math.PI * 2, speed: (0.35 + rng() * 0.35) * (rng() < 0.5 ? -1 : 1), sweep: 0.9 + rng() * 1.2 });
      }
      // Guards walk loops with torches; their light catches you like the searchlights do.
      const guards = [[[px - 30, pz - 18], [px - 8, pz - 18], [px - 8, pz + 10], [px - 30, pz + 10]], [[px + 30, pz + 16], [px + 8, pz + 16], [px + 8, pz - 14], [px + 30, pz - 14]], [[px - 18, north + 22], [px + 18, north + 22]]].map((path, i) => {
        const model = place(group, models.makeAvatar({ shirt: '#1d2a44', pants: '#1d2a44', hat: 'cap' }), V(path[0][0], 0.36, path[0][1]));
        const torch = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        torch.geometry.translate(0, -4.5, 0); torch.geometry.rotateX(-Math.PI / 2 - 0.08); torch.position.set(0, 1.2, -0.3); model.add(torch);
        return { model, path: path.map(([x, z]) => V(x, 0.36, z)), leg: 0, wait: i };
      });
      const spawn = V(px, 0.36, pz + pd / 2 - 3);   // just inside the park's south wall, clear of parked cars
      let t = 0, strikes = 0, carrying = false, escaped = false, score = 0, grace = 0, smoke = 0, smokes = upgrades.has('smoke-bomb') ? 2 : 0, tasers = upgrades.has('taser') ? 3 : 0;
      const sight = upgrades.has('soft-shoes') ? 0.8 : 1;
      return {
        spawn: { at: spawn, heading: 0 },
        objective: 'Reach the jewel',
        guide: () => (carrying ? vanAt : jewelAt),
        update(dt, m, hud, mover) {
          t += dt; grace -= dt; smoke -= dt;
          const feet = m.feet;
          if (smokes && controls.took('KeyQ')) { smokes--; smoke = 4; grace = Math.max(grace, 4); hud.toast(`Smoke bomb! (${smokes} left)`, 'good'); }
          if (tasers && controls.took('KeyE')) {
            const g = guards.find((x) => x.model.position.distanceTo(feet) < 4.5 && !(x.stunned > 0));
            if (g) { tasers--; g.stunned = 8; g.model.rotation.z = Math.PI / 2; g.model.position.y = 0.6; hud.toast(`Zapped! (${tasers} left)`, 'good'); }
          }
          hud.meter(smoke > 0 ? 'Unseen' : null, smoke > 0 ? smoke / 4 : 0);
          const caught = () => {
            strikes++; grace = 2;
            hud.toast(strikes >= 3 ? 'Busted.' : `Spotted! Strike ${strikes}/3`, 'bad');
            if (strikes >= 3) { this.done = true; return true; }
            mover.teleport(carrying ? jewelAt.clone().setY(0.36) : spawn);
            return false;
          };
          for (const g of guards) {
            const o = g.model, to = g.path[(g.leg + 1) % g.path.length];
            if (g.stunned > 0) { g.stunned -= dt; if (g.stunned <= 0) { o.rotation.z = 0; o.position.y = 0.36; } continue; }
            if (g.wait > 0) { g.wait -= dt; o.userData.animate?.(t, 0, {}); o.rotation.y += Math.sin(t * 2) * dt * 0.8; }
            else {
              const dx = to.x - o.position.x, dz = to.z - o.position.z, d = Math.hypot(dx, dz);
              if (d < 0.3) { g.leg = (g.leg + 1) % g.path.length; g.wait = 1.4; }
              else { o.position.x += dx / d * 1.7 * dt; o.position.z += dz / d * 1.7 * dt; o.rotation.y = Math.atan2(-dx, -dz); }
              o.userData.animate?.(t, 1.7, {});
            }
            const px2 = feet.x - o.position.x, pz2 = feet.z - o.position.z, d2 = Math.hypot(px2, pz2);
            if (grace <= 0 && d2 < 9 * sight && d2 > 0.1 && (-Math.sin(o.rotation.y) * px2 - Math.cos(o.rotation.y) * pz2) / d2 > Math.cos(0.42 * sight)) { if (caught()) return; }
            else if (grace <= 0 && d2 < 1.6) { if (caught()) return; }
          }
          for (const l of lights) {
            const a = l.base + Math.sin(t * l.speed) * l.sweep;
            l.model.rotation.y = a;
            const reach = (l.model.userData.reach ?? 14) * sight, radius = (l.model.userData.radius ?? 5) * sight;
            const dx = feet.x - l.model.position.x, dz = feet.z - l.model.position.z, d = Math.hypot(dx, dz);
            if (grace > 0 || d > reach || d < 1) continue;
            const along = (-Math.sin(a) * dx - Math.cos(a) * dz) / d;
            if (along > Math.cos(Math.atan(radius / reach)) && caught()) return;
          }
          if (!carrying && flatDist(feet, jewelAt) < 1.8) { carrying = true; jewel.visible = false; van.visible = true; hud.toast('Got it! Now the van.', 'good'); }
          if (carrying && flatDist(feet, vanAt) < 4) {
            escaped = true; score = 3000 + Math.round((this.timeLeft ?? 0) * 25) - strikes * 500; this.done = true;
            hud.toast('Clean getaway.', 'good');
          }
          hud.set({ score, objective: `${carrying ? 'Get to the van' : 'Reach the jewel'} · ${where(feet, carrying ? vanAt : jewelAt)} · strikes ${strikes}/3` });
        },
        results: () => ({ score: Math.round(score * practice), rank: escaped ? rankFor(score * practice, [5000, 4200, 3500, 0]) : 'D', subtitle: escaped ? 'They never saw your face.' : strikes >= 3 ? 'Caught in the light.' : 'The alarm beat you.', lines: [{ label: 'Jewel', value: carrying ? 'Taken' : 'Still there' }, { label: 'Strikes', value: `${strikes}/3` }] }),
      };
    },
  },

  aliens: {
    mover: 'flight', ride: 'hero', time: 100, outfit: { shirt: '#3fb37f', pants: '#2b3d5c', hat: 'cape' },
    title: 'Alien invasion',
    intro: (m) => [
      `The saucers came in low over ${m.city === 'tokyo' ? 'Shinjuku' : 'Midtown'}. And you could fly. You'd always been able to fly.`,
      'Ram the saucers out of the sky before their beams take the city apart.',
    ],
    controls: 'WASD fly · SPACE up · C down · SHIFT boost · mouse steers',
    create({ practice = 1, upgrades = new Set(), group, rng, life }) {
      const ufos = [];
      let score = 0, downed = 0, lost = 0, combo = 0, comboT = 0, wave = 0;
      const spawnWave = () => {
        wave++;
        for (let i = 0; i < 8 + wave * 2; i++) {
          const p = V(rng.range(-220, 220), rng.range(45, 95), rng.range(-600, 180));
          const model = place(group, models.makeUFO(), p);
          ufos.push({ model, home: p.clone(), phase: rng() * 6.28, r: rng.range(15, 45), speed: rng.range(0.15, 0.35) * (1 + wave * 0.15), beam: 0, beaming: rng() < 0.4, down: false, vy: 0 });
        }
      };
      spawnWave();
      let t = 0;
      return {
        spawn: { at: V(-25, START.roof + 2, 4), heading: 0 },
        objective: 'Knock the saucers down',
        guide(m) {
          let best = null, bd = Infinity;
          for (const u of ufos) if (!u.down) { const d = u.model.position.distanceToSquared(m.feet); if (d < bd) { bd = d; best = u.model.position; } }
          return best;
        },
        update(dt, m, hud) {
          if (upgrades.has('jet-boots') && !m.M.jets) m.M = { ...m.M, boost: 82, jets: true };
          t += dt; comboT -= dt; if (comboT <= 0) combo = 0;
          const body = m.feet.add(V(0, 1, 0));
          for (const u of ufos) {
            const o = u.model;
            if (u.down) {
              if (!o.visible) continue;
              u.vy -= 30 * dt; o.position.y += u.vy * dt; o.rotation.z += dt * 5; o.rotation.x += dt * 3;
              if (o.position.y < -3) o.visible = false;
              continue;
            }
            o.position.set(u.home.x + Math.cos(t * u.speed + u.phase) * u.r, u.home.y + Math.sin(t * 1.3 + u.phase) * 2, u.home.z + Math.sin(t * u.speed + u.phase) * u.r);
            u.beam += dt;
            const on = u.beaming && (u.beam % 14) > 5;
            if (o.userData.beam) o.userData.beam.visible = on;
            // A beam lifts whatever vehicle is under it; reaching the saucer means it's gone.
            if (on && !u.prey && life) {
              const v = life.nearestVehicle(V(o.position.x, 0, o.position.z), 35);
              if (v) { u.prey = life.take(v); group.add(u.prey); u.prey.position.copy(v.position); hud.toast(`They're taking a ${v.kind === 'carriage' ? 'carriage' : v.kind === 'bus' ? 'bus' : v.kind === 'taxi' ? 'taxi' : 'car'}!`, 'bad'); }
            }
            if (u.prey) {
              const pr = u.prey;
              if (on) {
                pr.position.x += (o.position.x - pr.position.x) * Math.min(1, dt * 0.8); pr.position.z += (o.position.z - pr.position.z) * Math.min(1, dt * 0.8);
                pr.position.y += dt * (upgrades.has('jammer') ? 3.5 : 7); pr.rotation.y += dt * 1.5; pr.rotation.z = Math.sin(t * 2) * 0.3;
                if (pr.position.y > o.position.y - 3) { pr.visible = false; u.prey = null; lost++; score = Math.max(0, score - 150); hud.toast('Gone. Into the saucer.', 'bad'); }
              } else { pr.position.y = Math.max(0, pr.position.y - dt * 20); if (pr.position.y === 0) u.prey = null; }
            } else if (on && !life && (u.beam % 14) > 13.9) { lost++; score = Math.max(0, score - 100); hud.toast('They took a water tower!', 'bad'); u.beam += 0.2; }
            if (near(body, o.position, upgrades.has('big-fists') ? 8.5 : 6)) {
              if (u.prey) { u.prey.rotation.z = 0; const dropped = u.prey; u.prey = null; dropped.userData.falling = true; score += 200; hud.toast('Saved it!  +200', 'good'); }
              u.down = true; u.vy = 4; downed++;
              combo = Math.min(combo + 1, 6); comboT = 4;
              const pts = 250 + (combo - 1) * 75; score += pts;
              if (o.userData.beam) o.userData.beam.visible = false;
              hud.toast(combo > 1 ? `Chain ×${combo}  +${pts}` : `Saucer down  +${pts}`, 'good');
            }
          }
          for (const c of group.children) if (c.userData.falling) { c.position.y = Math.max(0, c.position.y - dt * 18); if (!c.position.y) c.userData.falling = false; }
          if (ufos.every((u) => u.down)) { hud.toast(`Wave ${wave} cleared!`, 'good'); spawnWave(); }
          hud.set({ score, objective: `Wave ${wave} · ${ufos.filter((u) => !u.down).length} saucers left` });
        },
        results: () => ({ score: Math.round(score * practice), rank: rankFor(score * practice, [6000, 4200, 2600, 1200]), subtitle: downed > 20 ? 'The city never knew how close it came.' : 'They will be back.', lines: [{ label: 'Saucers down', value: String(downed) }, { label: 'Things abducted', value: String(lost) }] }),
      };
    },
  },

  patrol: {
    mover: 'swing', ride: 'hero', time: 120, outfit: { shirt: '#2b62a6', pants: '#e0322b', hat: 'mask' },
    title: 'Street patrol',
    intro: (m) => [
      m.year === '1900' ? 'You swung from the telegraph wires. People thought you were a very large bat.' : 'You swung from roof to roof, listening for trouble.',
      'Crimes pop up across the city. Swing down and tackle the crook before they get away. They run.',
    ],
    controls: 'HOLD MOUSE or SHIFT web · SPACE jump / wall kick · WASD steer · mouse aims',
    create({ practice = 1, upgrades = new Set(), group, rng, world, town, earn, scale, name }) {
      const crook = runner(group, world, { shirt: '#e0322b', pants: '#1b1a17', hat: 'mask' });
      let t = 0, victim = null, stolen = 0;
      const CRIMES = ['A purse snatching', 'A hot dog cart robbery', 'A car break-in', 'Someone stealing a bicycle', 'A pickpocket on the corner', 'Someone jaywalking. Menacingly.', 'A stolen pigeon', 'A mugging outside the deli'];
      const spots = intersections();
      const marker = place(group, models.makeCrimeMarker(), V(0, 0.2, 0));
      const beam = place(group, beacon('#ff4b4b'), V(0, 0, 0));
      let crime = null, left = 0, score = 0, stopped = 0, missed = 0;
      const next = (from) => {
        const pool = spots.filter((s) => { const d = flatDist(s, from); return d > 120 && d < 380; });
        const at = rng.pick(pool.length ? pool : spots).clone().add(V(rng.range(-8, 8), 0, rng.range(-3, 3)));
        crime = { at, what: rng.pick(CRIMES) }; left = 40 + (upgrades.has('police-radio') ? 12 : 0);
        crook.reset(at);
        // Someone out on the street nearby is the one who gets robbed.
        const near = town?.outdoors({ x: at.x, z: at.z }, 160) || [];
        victim = near.length ? near[Math.floor(rng() * near.length)].resident : null;
        stolen = victim ? Math.round(Math.min(victim.money * 0.4, 60 * scale) * 100) / 100 : 0;
        if (victim) { town.pay(victim, -stolen, `Got robbed of $${stolen.toFixed(2)}`); victim.scared = 1; crime.what = `${victim.first} ${victim.last} got robbed`; }
      };
      return {
        spawn: { at: V(START.x, START.roof, START.z), heading: 0 },
        objective: '',
        guide: () => crook.pos,
        update(dt, m, hud) {
          t += dt;
          if (!crime) { next(m.feet); hud.toast(`${crime.what}!`, 'bad'); }
          left -= dt;
          crook.slow = upgrades.has('sneakers') ? 0.8 : 1;
          crook.update(dt, t, m.feet);
          marker.position.set(crook.pos.x, 0.2, crook.pos.z); beam.position.set(crook.pos.x, 0, crook.pos.z);
          if (flatDist(m.feet, crook.pos) < 3 && m.feet.y < 4) {
            const pts = 400 + Math.round(left * 15); score += pts; stopped++;
            if (victim) {
              const reward = Math.round(stolen * 0.2 * (0.5 + victim.traits.kind) * 100) / 100;
              town.pay(victim, stolen - reward, `${name} got my money back`); victim.scared = 0; victim.met = true; victim.opinion = Math.min(1, victim.opinion + 0.4); earn?.(reward);
              hud.toast(`${victim.first} got their $${stolen.toFixed(2)} back and gave you $${reward.toFixed(2)}`, 'good');
            } else hud.toast(`Stopped!  +${pts}`, 'good'); next(m.feet); hud.toast(`${crime.what}!`, 'bad');
          } else if (left <= 0) {
            missed++; if (victim) victim.scared = 0; hud.toast(victim ? `Too late. ${victim.first}'s money is gone.` : 'Too late. They got away.', 'bad'); next(m.feet); hud.toast(`${crime.what}!`, 'bad');
          }
          hud.set({ score, objective: `${crime.what} · ${crook.fleeing ? 'they\'re running · ' : ''}${where(m.feet, crook.pos)} · ${Math.ceil(left)} s` });
        },
        results: () => ({ score: Math.round(score * practice), rank: rankFor(score * practice, [3800, 2600, 1500, 600]), subtitle: stopped >= 5 ? 'The city slept a little easier.' : 'Tomorrow night, then.', lines: [{ label: 'Crimes stopped', value: String(stopped) }, { label: 'Got away', value: String(missed) }] }),
      };
    },
  },

  pizza: {
    mover: 'scooter', ride: 'scooter', time: 150, outfit: { shirt: '#d9621f', pants: '#2b3d5c', hat: 'cap' },
    title: 'Pizza run',
    intro: (m) => [
      m.year === '1900' ? 'A motor scooter in 1900. You were ahead of your time, and the pizza was still hot.' : 'Six pies on the back of the scooter. Thirty minutes or it was free.',
      'Deliver to the glowing doors. Faster means bigger tips.',
    ],
    controls: 'W gas · S brake · A/D steer · mouse looks',
    create({ practice = 1, upgrades = new Set(), group, rng, world, town, earn, scale, controls }) {
      const briefs = world.city.city.briefs, window_ = upgrades.has('thermal-bag') ? 60 : 40;
      let nitro = 1;
      const shop = doorPoint(rng, briefs, V(0, 0, 60), [0, 80]);
      let customer = null;
      const door = place(group, models.makeDoorMarker(), V(0, 0, 0));
      let target = null, since = 0, score = 0, delivered = 0, tips = 0;
      const TOTAL = 6;
      const next = (from) => {
        // A resident at home orders; their door is the target.
        const home = town && town.residents.filter((r) => r.act.at === r.home && r.act.kind !== 'sleep').map((r) => ({ r, d: town.place(r.home).door })).filter(({ d }) => { const k = Math.hypot(d.x - from.x, d.z - from.z); return k > 110 && k < 300; });
        const pickd = home?.length ? home[Math.floor(rng() * home.length)] : null;
        customer = pickd?.r || null;
        target = pickd ? { at: V(pickd.d.x, 0.18, pickd.d.z) } : doorPoint(rng, briefs, from, [110, 300]);
        door.position.copy(target.at); since = 0;
      };
      next(shop.at);
      return {
        spawn: { at: shop.at.clone().setY(0).add(V(0, 0, shop.facing * 6)), heading: shop.facing > 0 ? Math.PI / 2 : -Math.PI / 2 },
        objective: '',
        guide: () => target.at,
        update(dt, m, hud) {
          since += dt;
          if (flatDist(m.feet, target.at) < 5) {
            const tip = Math.max(0, Math.round((window_ - since) * 12 * 40 / window_)); tips += tip;
            score += 300 + tip; delivered++;
            if (customer) {
              const price = 12 * scale, dollars = Math.min(customer.money, price + price * (tip / 480) * (0.5 + customer.traits.kind));
              town.pay(customer, -dollars, `Got a pizza delivered${since < 25 ? ', still hot' : ', cold'}`); customer.needs.hunger = 0; customer.met = true;
              customer.opinion = Math.max(-1, Math.min(1, customer.opinion + (since < 25 ? 0.1 : -0.05))); earn?.(dollars);
              hud.toast(`${customer.first} paid $${dollars.toFixed(2)}${tip ? ' with a tip' : ''}`, 'good');
            } else hud.toast(tip ? `Delivered! Tip +${tip}` : 'Delivered. No tip.', 'good');
            if (delivered === TOTAL) { this.done = true; score += Math.round((this.timeLeft ?? 0) * 20); return; }
            next(m.feet);
          }
          if (!m.M.tuned) m.M = { ...m.M, hop: upgrades.has('hop') ? 8.5 : m.M.hop, tuned: true };
          if (upgrades.has('nitrous')) {
            m.boosting = nitro > 0 && (controls.keys.has('ShiftLeft') || controls.keys.has('ShiftRight'));
            nitro = m.boosting ? Math.max(0, nitro - dt * 0.35) : Math.min(1, nitro + dt * 0.08);
          }
          hud.meter(upgrades.has('nitrous') && m.boosting ? 'Nitrous' : 'Tip', upgrades.has('nitrous') && m.boosting ? nitro : Math.max(0, (window_ - since) / window_));
          hud.set({ score, objective: `Pizza ${delivered + 1}/${TOTAL}${customer ? ` for ${customer.first}` : ''} · ${where(m.feet, target.at)}` });
        },
        results: () => ({ score: Math.round(score * practice), rank: rankFor(score * practice, [5200, 4000, 2800, 1400]), subtitle: delivered === TOTAL ? 'Every pie, still warm.' : 'Some of them got it free.', lines: [{ label: 'Delivered', value: `${delivered}/${TOTAL}` }, { label: 'Tips', value: `$${(tips / 100).toFixed(2)}` }] }),
      };
    },
  },

  taxi: {
    mover: 'car', time: 60, outfit: { shirt: '#f6b90c', pants: '#2b3d5c', hat: 'cap' },
    ride: (m) => (m.year === '1900' ? 'carriage' : 'cab'),
    title: 'Cab driver',
    intro: (m) => [
      m.year === '1900' ? 'A hansom cab and a horse called Biscuit. Everyone in town was late for something.' : m.year === '2100' ? 'The last cab in the city that still touched the road. People paid extra for that.' : 'You were driving a cab. Every fare was in a hurry, and so were you.',
      'Pick up the people waving, get them there fast. Every fare buys you more time. Near misses pay.',
    ],
    controls: 'W gas · S brake · A/D steer · SPACE drift · SHIFT boost · stop next to a fare to pick up',
    create({ practice = 1, upgrades = new Set(), group, rng, world, life, town, controls, earn, scale, name }) {
      const briefs = world.city.city.briefs;
      const flag = place(group, beacon('#ffd66b'), V(0, -999, 0));
      const door = place(group, models.makeDoorMarker(), V(0, -999, 0));
      let fare = null, rider = null, dest = null, fareLeft = 0, score = 0, fares = 0, misses = 0, cash = 0, nitro = 0.3, extra = 0;
      const seen = new Set();
      const findFare = (from) => {
        const ped = life?.pickFare(from, 50, 220);
        if (ped) { life.claim(ped); fare = { ped, at: ped.position, resident: ped.residentId ? town?.person(ped.residentId) : null }; }
        else {
          const spot = doorPoint(rng, briefs, from, [50, 220]);
          const model = place(group, models.makeAvatar({ shirt: rng.pick(['#2b62a6', '#3fb37f', '#e0322b', '#6b5b95']), hat: rng() < 0.4 ? 'cap' : null }), spot.at.clone().setY(0.18));
          fare = { model, at: model.position };
        }
      };
      return {
        spawn: { at: V(0, 0, 60), heading: 0 },
        objective: 'Find a fare',
        guide: () => (rider ? dest.at : fare?.at),
        update(dt, m, hud) {
          if (!fare && !rider) findFare(m.feet);
          if (m.drifting) nitro = Math.min(1, nitro + dt * 0.3 * (upgrades.has('turbo') ? 2 : 1));
          m.boosting = nitro > 0 && (controls.keys.has('ShiftLeft') || controls.keys.has('ShiftRight'));
          if (m.boosting) nitro = Math.max(0, nitro - dt * 0.4);
          if (fare && !rider) {
            flag.position.set(fare.at.x, 0, fare.at.z);
            fare.model?.userData.animate?.(this.t = (this.t || 0) + dt, 0, { wave: true });
            if (flatDist(m.feet, fare.at) < (upgrades.has('quick-stop') ? 10 : 7) && Math.abs(m.speed) < (upgrades.has('quick-stop') ? 14 : 6)) {
              if (fare.ped) life.board(fare.ped); else fare.model.visible = false;
              rider = fare; fare = null;
              // A resident goes where they were already headed; anyone else picks a door.
              const R = rider.resident, goal = R?.act.kind === 'walk' ? town.place(R.act.to) : null;
              if (R) town.hail(R, m.feet);
              dest = goal && flatDist(V(goal.door.x, 0, goal.door.z), m.feet) > 60 ? { at: V(goal.door.x, 0.18, goal.door.z), place: goal.id } : doorPoint(rng, briefs, m.feet, [140, 420]);
              if (R && !dest.place) dest.place = dest.brief?.id && town.place(dest.brief.id) ? dest.brief.id : R.home;
              fareLeft = Math.round(flatDist(m.feet, dest.at) / 11 + 8);
              door.position.copy(dest.at); flag.position.y = -999;
              hud.toast(`${R ? `${R.first}: ` : ''}${rng.pick(['To the station, fast!', 'Step on it!', 'I\'m late for my own wedding!', 'Follow that car! Kidding. Just hurry.', 'Uptown, and don\'t spare the horses.'])}`, 'info');
            }
          }
          if (rider) {
            fareLeft -= dt;
            hud.meter('Fare', Math.max(0, fareLeft / 40));
            // Near misses: passing close to traffic at speed.
            if (life && Math.abs(m.speed) > 18) for (const v of life.vehicles) {
              if (v.parked || v.kind === 'hover' || seen.has(v.id)) continue;
              const d = flatDist(v.position, m.feet);
              if (d < 3.6 && d > 1.9) { seen.add(v.id); misses++; score += 40; hud.toast('Near miss  +40', 'good'); setTimeout(() => seen.delete(v.id), 3000); }
            }
            if (flatDist(m.feet, dest.at) < (upgrades.has('quick-stop') ? 11 : 8) && Math.abs(m.speed) < (upgrades.has('quick-stop') ? 15 : 7)) {
              const bonus = Math.max(0, Math.round(fareLeft * 25 * (upgrades.has('charm') ? 1.3 : 1))), pay = 300 + bonus;
              score += pay; fares++;
              // The fare comes out of their own pocket; the tip depends on the ride and on them.
              const R = rider.resident, meter = Math.round((3 + flatDist(rider.at, dest.at) / 80) * scale * 100) / 100;
              const tip = R ? Math.round(meter * (fareLeft > 0 ? 0.1 + R.traits.kind * 0.25 + Math.max(0, R.opinion) * 0.2 : 0) * (upgrades.has('charm') ? 1.5 : 1) * 100) / 100 : 0;
              const paid = R ? Math.min(R.money, meter + tip) : meter;
              if (R) { town.pay(R, -paid, `Took a cab with ${name}${fareLeft > 0 ? ', fast' : ', slow'}`); R.opinion = Math.max(-1, Math.min(1, R.opinion + (fareLeft > 0 ? 0.12 : -0.08))); R.met = true; }
              cash += paid; earn?.(paid);
              const more = Math.max(4, Math.round(fareLeft * 0.8) + 6); extra += more; this.addTime?.(more);
              hud.toast(fareLeft > 0 ? `Fare paid  +${pay}  ·  +${more} s` : `They paid. Barely.  +${pay}`, 'good');
              if (rider.ped) life.release(rider.ped, dest.at.clone().setY(0.18)); else { rider.model.visible = true; rider.model.position.copy(dest.at); }
              if (rider.resident) town.dropOff(rider.resident, dest.place);
              rider = null; dest = null; door.position.y = -999; hud.meter('Nitro', nitro);
            }
          } else hud.meter('Nitro', nitro);
          hud.set({ score, objective: rider ? `Drop off · ${where(m.feet, dest.at)} · ${Math.max(0, Math.ceil(fareLeft))} s` : fare ? `Pick up the fare · ${where(m.feet, fare.at)}` : 'Find a fare' });
        },
        results: () => ({ score: Math.round(score * practice), rank: rankFor(score * practice, [4500, 3200, 2000, 900]), subtitle: fares >= 6 ? 'Best cabbie in the city.' : 'The meter was running.', lines: [{ label: 'Fares', value: String(fares) }, { label: 'Near misses', value: String(misses) }, { label: 'Cash', value: `$${cash.toFixed(2)}` }] }),
      };
    },
  },

  // No timer, no score: walk the city you remembered, with whatever powers you kept.
  roam: {
    mover: 'foot', ride: 'foot', time: null, outfit: { shirt: '#6b5b95', pants: '#2b3d5c' },
    title: 'Just wander',
    intro: (m) => [
      m.year === '1900' ? 'Nothing much. Just walking, dodging the carriages, looking up.' : 'Nothing much. I was just walking around, watching everyone.',
      'Little memories are lying around the city. Pick them up. Press M when you want to wake up.',
    ],
    controls: 'WASD move · number keys switch powers · E use · M wake up',
    create({ practice = 1, upgrades = new Set(), group, rng, life, town, controls, progress, switchTo, talkTo, found, clock, cash, earn, scale, inspectPlace }) {
      const kept = progress.kept.filter((g) => PERKS[g]);
      const rides = kept.filter((g) => PERKS[g].mover);
      const money = kept.includes('heist');
      const slots = [{ key: '1', id: 'foot', label: 'On foot', glyph: 'foot', game: null }, ...rides.map((g, i) => ({ key: String(i + 2), id: PERKS[g].id, label: PERKS[g].label, glyph: PERKS[g].glyph, game: g }))];
      let active = 'foot', t = 0, picked = 0;
      const orbs = [];
      for (let i = 0; i < 24; i++) { const p = roadPoint(rng, { lane: rng.range(-10, 10) }); p.y = 1; orbs.push(place(group, models.makeOrb('#ffd66b'), p)); }
      const show = (hud) => hud.abilities(slots.map((sl) => ({ ...sl, active: sl.id === active })));
      return {
        spawn: { at: V(-5, 0, 40), heading: 0 },
        objective: kept.length ? 'Wander. Your kept powers are on the number keys.' : 'Wander. Score a B or better to keep a power.',
        guide: (m) => { let best = null, bd = Infinity; for (const o of orbs) if (o.visible) { const d = o.position.distanceToSquared(m.feet); if (d < bd) { bd = d; best = o.position; } } return best; },
        update(dt, m, hud) {
          t += dt;
          if (t < dt * 1.5) { show(hud); hud.set({ score: null, time: null }); }
          for (const sl of slots) if (controls.took(`Digit${sl.key}`) && sl.id !== active) { active = sl.id; switchTo(sl.game); show(hud); hud.toast(sl.label); return; }
          if (controls.took('KeyM')) { this.done = true; return; }
          const body = m.feet.add(V(0, 1, 0));
          for (const o of orbs) if (o.visible && body.distanceTo(o.position) < 2.2) { o.visible = false; picked++; found(25); hud.toast('A little memory  +25', 'good'); }
          hud.clock?.(clock?.());
          // People first: anyone within a few steps can be talked to. Residents are the town's
          // own people; visitors are just passing through.
          const ped = life && active === 'foot' ? life.nearestPed?.(m.feet, 4.5, { residentsOnly: false }) : null;
          const resident = ped?.residentId ? town?.person(ped.residentId) : null;
          const v = life && active === 'foot' && !ped ? life.nearestVehicle(m.feet, 4.5) : null;
          const far = !ped && !v && life && active === 'foot' ? life.nearestPed?.(m.feet, 30) : null;
          const farRes = far?.residentId ? town?.person(far.residentId) : null;
          const price = Math.round(600 * scale), have = cash();
          hud.prompt(ped ? `E · TALK TO ${resident?.met ? resident.first.toUpperCase() : resident ? 'THEM' : 'THE STRANGER'}` : v ? `E · BUY THIS ${v.kind === 'carriage' ? 'CARRIAGE' : v.kind.toUpperCase()}  (${money ? '$∞' : `$${price.toLocaleString()}`})` : farRes ? `${farRes.met ? farRes.first.toUpperCase() : 'SOMEONE WHO LIVES HERE'} · ${Math.round(far.position.distanceTo(m.feet))} M · WALK UP TO TALK` : null);
          // Front doors: walk up to a building to see its deed (and buy it).
          const door = !ped && !v && town && active === 'foot' ? town.places.find((p) => p.kind !== 'park' && p.kind !== 'office' && Math.hypot(p.door.x - m.feet.x, p.door.z - m.feet.z) < 3) : null;
          if (door) hud.prompt(`E · ${town.ownerOf(door.id) === 'player' ? 'YOUR BUILDING' : 'LOOK AT THIS BUILDING'}`);
          if (ped && controls.took('KeyE')) { hud.prompt(null); talkTo(resident, ped); return; }
          if (door && controls.took('KeyE')) { hud.prompt(null); inspectPlace(door); return; }
          if (!ped && !v && !door && controls.took('KeyE')) hud.toast('Nobody close enough. Walk right up to someone (or a front door), then press E.');
          if (v && controls.took('KeyE')) {
            if (!money && have < price) hud.toast(`It's $${price.toLocaleString()}. You have $${have.toFixed(2)}. Drive a cab, or keep the jewel.`, 'bad');
            else {
              if (!money) earn(-price); const model = life.take(v); active = 'bought'; switchTo('bought', model, v.kind); show(hud); hud.prompt(null); hud.toast(`Sold. It's yours.`, 'good'); }
          }
          hud.set({ objective: `${picked} memories found · ${slots.find((sl) => sl.id === active)?.label || 'Driving'}` });
        },
        results: () => ({ score: picked * 25, rank: null, subtitle: 'You woke up.', lines: [{ label: 'Memories found', value: String(picked) }] }),
      };
    },
  },

  // The pizzeria's kitchen: a counter game drawn by ui.kitchen(), not a round in the street.
  // main.js runs it; this entry carries the words and the rank lines.
  shop: {
    kitchen: true, time: 90, title: 'Pizza shop',
    intro: (m) => [
      m.year === '1900' ? 'A wood oven, flour to your elbows, and a queue out the door onto the cobbles.' : m.year === '2100' ? 'The printers broke, so the owner made everyone cook by hand. People queued round the block for it.' : 'Behind the counter at last. The lunch rush was about to hit.',
      'Dough, sauce, cheese, toppings, then pull it out of the oven when it\'s golden. Don\'t keep anyone waiting.',
    ],
    ranks: [5500, 4200, 3000, 1800],
  },

  kaiju,
};

export { animated, INNER_STREETS };
