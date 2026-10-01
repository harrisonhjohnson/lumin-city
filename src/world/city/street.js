import { BLOCK, BUILDABLE, LANDMARKS, WORLD } from './bible.js';
import { AVENUE_XS, STREET_ZS } from './districts.js';
import { blocks } from './blocks.js';
import { createRng } from './rng.js';

// Everything that makes the ground look like New York rather than a grid: paint, lamps,
// trees, traffic, subway entrances, steam stacks, the park. Pure like build.js: it pushes
// box records ([x, y, z, w, h, d], y is the centre) and kit parts, and returns the steam
// stack tops for scene.js to puff from, and the vehicles' footprints (the game layer bumps
// into them; the swing city doesn't).
const CURB = 0.18;                                   // sidewalk slab top
const AVENUE_HALF = (BLOCK.avenuePitch - BUILDABLE.x - 2 * BLOCK.sidewalk) / 2;   // road half-width, 12 m
const STREET_HALF = (BLOCK.streetPitch - BUILDABLE.z - 2 * BLOCK.sidewalk) / 2;   // 6 m
const nearStreet = (z) => Math.min(...STREET_ZS.map((sz) => Math.abs(z - sz)));
const nearAvenue = (x) => Math.min(...AVENUE_XS.map((ax) => Math.abs(x - ax)));

//   traffic  the look's traffic style: { none, lift (hover height), cabs, buses, colours }
export function streetLife(push, parts, seed = WORLD.seed, traffic = {}) {
  const rng = createRng(seed + 31);
  const grid = blocks();
  crosswalks(push);
  laneMarkings(push, grid);
  lamps(push, grid);
  trees(push, grid, rng);
  const vehicles = traffic.none ? [] : cars(push, parts, rng, traffic);
  subway(push, grid, rng);
  const steam = steamStacks(push, rng);
  park(push, rng);
  return { steam, vehicles };
}

// Zebra stripes on all four arms of every intersection, stripes parallel to the traffic.
function crosswalks(push) {
  const gap = 1.7, stripe = 0.85;
  for (const ax of AVENUE_XS) for (const sz of STREET_ZS) {
    for (const side of [-1, 1]) {
      const zc = sz + side * (STREET_HALF + 1.8);
      for (let x = ax - AVENUE_HALF + 1; x < ax + AVENUE_HALF; x += gap) push('paintWhite', x, 0.03, zc, stripe, 0.02, 3.2);
      const xc = ax + side * (AVENUE_HALF + 1.8);
      for (let z = sz - STREET_HALF + 1; z < sz + STREET_HALF; z += gap) push('paintWhite', xc, 0.03, z, 3.2, 0.02, stripe);
    }
  }
}

// Avenues run one way in three lanes: white dashes between them. Streets get a double
// yellow down the middle of each block.
function laneMarkings(push, grid) {
  for (const ax of AVENUE_XS) for (let z = WORLD.z[0]; z < WORLD.z[1]; z += 9) {
    if (nearStreet(z) < 11) continue;
    for (const dx of [-4, 4]) push('paintWhite', ax + dx, 0.02, z, 0.15, 0.025, 4);
  }
  for (const b of grid) for (const sz of [b.streetNorth, b.streetSouth]) for (const dz of [-0.4, 0.4]) push('paintYellow', b.cx, 0.02, sz + dz, BUILDABLE.x - 8, 0.025, 0.12);
}

// Cobra-head lamps at the kerb: a dark pole and an amber head reaching over the road.
function lamps(push, grid) {
  const pole = (x, z) => push('trim', x, CURB + 3.2, z, 0.2, 6.4, 0.2);
  for (const b of grid) {
    for (const [side, edge, toward] of [['west', b.minX, -1], ['east', b.maxX, 1]]) {
      const x = edge + toward * 2.4;
      for (const dz of [-22, 0, 22]) { pole(x, b.cz + dz); push('lamp', x + toward * 0.7, CURB + 6.5, b.cz + dz, 1.6, 0.25, 0.4); }
    }
    for (const [edge, toward] of [[b.minZ, -1], [b.maxZ, 1]]) {
      const z = edge + toward * 2.4;
      for (const dx of [-40, -20, 0, 20, 40]) { pole(b.cx + dx, z); push('lamp', b.cx + dx, CURB + 6.5, z + toward * 0.7, 0.4, 0.25, 1.6); }
    }
  }
}

// Street trees on the street-facing sidewalks, between the lamps.
function trees(push, grid, rng) {
  for (const b of grid) for (const [edge, toward] of [[b.minZ, -1], [b.maxZ, 1]]) for (const dx of [-30, -10, 10, 30]) {
    if (rng() > 0.65) continue;
    tree(push, b.cx + dx, edge + toward * 1.9, 2.2 + rng() * 1, 2.6, CURB);
  }
}
function tree(push, x, z, crown, trunkH, base) {
  push('trunk', x, base + trunkH / 2, z, 0.32, trunkH, 0.32);
  push('leaf', x, base + trunkH + crown / 2 - 0.3, z, crown, crown, crown);
}

// One-way avenues (direction alternates), taxis and buses in three lanes; streets get a
// moving lane of taxis and kerbs of parked cars. Nothing sits in an intersection.
function cars(push, parts, rng, { lift = 0, cabs = true, buses = true, colours = ['carDark', 'carDark', 'carSilver', 'carRed', 'carBlue'] } = {}) {
  const vehicles = [];
  const footprint = (x, z, w, h, d) => vehicles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, bottom: lift, height: lift + h });
  const car = (x, z, alongZ) => {
    const c = rng.pick(colours);
    push(c, x, lift + 0.55, z, alongZ ? 1.8 : 4.3, 0.8, alongZ ? 4.3 : 1.8);
    push('glass', x, lift + 1.25, z, alongZ ? 1.55 : 2.2, 0.6, alongZ ? 2.2 : 1.55);
    footprint(x, z, alongZ ? 1.8 : 4.3, 1.55, alongZ ? 4.3 : 1.8);
  };
  const cab = (x, z, rot, alongZ) => {
    if (!cabs) return car(x, z, alongZ);
    parts.push({ part: 'cab', x, y: lift, z, rot, sx: 1, sz: 1, lot: null });
    footprint(x, z, alongZ ? 1.7 : 4, 1.3, alongZ ? 4 : 1.7);
  };
  const bus = (x, z, alongZ) => {
    if (!buses) return car(x, z, alongZ);
    push('bus', x, lift + 1.75, z, alongZ ? 2.6 : 11.5, 3.1, alongZ ? 11.5 : 2.6);
    push('glass', x, lift + 2.4, z, alongZ ? 2.66 : 10.2, 0.9, alongZ ? 10.2 : 2.66);
    footprint(x, z, alongZ ? 2.6 : 11.5, 3.3, alongZ ? 11.5 : 2.6);
  };
  AVENUE_XS.forEach((ax, k) => {
    const rot = k % 2 ? 0 : 2;
    for (const dx of [-8, 0, 8]) {
      let z = WORLD.z[0] + rng.range(0, 30);
      while (z < WORLD.z[1] - 20) {
        const kind = rng(), len = kind > 0.9 ? 11.5 : 4.3;
        if (nearStreet(z) >= 11 + len / 2) {
          if (kind < 0.55) cab(ax + dx, z, rot, true);
          else if (kind > 0.9) bus(ax + dx, z, true);
          else car(ax + dx, z, true);
        }
        z += len + rng.range(6, 26);
      }
    }
  });
  STREET_ZS.forEach((sz, r) => {
    const rot = r % 2 ? 1 : 3;
    for (let x = -264; x < 264; x += rng.range(12, 34)) {
      const lane = rng() > 0.5 ? 1.7 : -1.7;
      if (nearAvenue(x) < 16 || rng() < 0.3) continue;
      if (rng() > 0.4) cab(x, sz + lane, rot, false);
      else car(x, sz + lane, false);
    }
    for (const side of [-1, 1]) for (let x = -262; x < 262; x += 5.8) {
      if (nearAvenue(x) < 15 || rng() > 0.55) continue;
      if (rng() > 0.9) cab(x, sz + side * 4.7, rot, false);
      else car(x, sz + side * 4.7, false);
    }
  });
  return vehicles;
}

// Green globes on the corners of a few blocks: a stair box, two posts, two lamps.
function subway(push, grid, rng) {
  for (const b of grid) {
    if (rng() > 0.6) continue;
    const dx = rng() > 0.5 ? 1 : -1, dz = rng() > 0.5 ? 1 : -1;
    const x = b.cx + dx * (BUILDABLE.x / 2 + 1.5), z = b.cz + dz * (BUILDABLE.z / 2 + 1.5);
    push('trim', x, CURB + 0.55, z, 1.6, 1.1, 1.6);
    for (const s of [-1, 1]) {
      push('trim', x + s * 0.65, CURB + 1.6, z + s * 0.65, 0.14, 3.2, 0.14);
      push('subwayGlobe', x + s * 0.65, CURB + 3.4, z + s * 0.65, 0.45, 0.45, 0.45);
    }
  }
}

// Orange-and-white stacks standing in the road at intersections; scene.js makes them steam.
function steamStacks(push, rng) {
  const tops = [];
  const inner = AVENUE_XS.slice(1, -1);
  for (let i = 0; i < 26; i++) {
    const x = rng.pick(inner) + rng.range(-8, 8), z = rng.pick(STREET_ZS.slice(1, -1)) + rng.range(-3, 3);
    push('steamStack', x, 1.7, z, 0.8, 3.4, 0.8);
    push('paintWhite', x, 2.6, z, 0.86, 0.5, 0.86);
    tops.push([x, 3.4, z]);
  }
  return tops;
}

// The one green block: a stone-walled park with a lawn, paths, a reservoir and a wood.
function park(push, rng) {
  const l = LANDMARKS.find((m) => m.kind === 'void');
  if (!l) return;
  const [cx, cz] = l.at, [w, , d] = l.size;
  push('stone', cx, 0.15, cz, w, 0.3, d);
  push('grass', cx, 0.33, cz, w - 4, 0.06, d - 4);
  push('path', cx, 0.362, cz, w - 4, 0.02, 2.6);
  push('path', cx, 0.362, cz, 2.6, 0.02, d - 4);
  const pond = { x: cx - 24, z: cz - 12, w: 34, d: 20 };
  push('water', pond.x, 0.372, pond.z, pond.w, 0.03, pond.d);
  push('water', pond.x + 10, 0.372, pond.z + 8, 22, 0.03, 16);
  for (let i = 0, placed = 0; i < 400 && placed < 90; i++) {
    const x = cx + rng.range(-w / 2 + 5, w / 2 - 5), z = cz + rng.range(-d / 2 + 5, d / 2 - 5);
    if (Math.abs(x - pond.x) < pond.w / 2 + 3 && Math.abs(z - pond.z) < pond.d / 2 + 3) continue;
    if (Math.abs(x - (pond.x + 10)) < 14 && Math.abs(z - (pond.z + 8)) < 11) continue;
    if (Math.abs(x - cx) < 3 || Math.abs(z - cz) < 3) continue;
    tree(push, x, z, 3.6 + rng() * 2.6, 3.4, 0.36);
    placed++;
  }
}
