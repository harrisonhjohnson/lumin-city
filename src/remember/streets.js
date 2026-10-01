import * as THREE from 'three';
import { AVENUE_XS, STREET_ZS } from '../world/city/districts.js';
import { WORLD, LANDMARKS } from '../world/city/bible.js';

// Street geometry the minigames place things on. Avenues run north–south at AVENUE_XS,
// streets east–west at STREET_ZS; both are clear of buildings.
export const INNER_AVENUES = AVENUE_XS.filter((x) => Math.abs(x) < WORLD.x[1] - 20);
export const INNER_STREETS = STREET_ZS.filter((z) => z > WORLD.z[0] + 10 && z < WORLD.z[1] - 10);
export const PARK = LANDMARKS.find((l) => l.kind === 'void');

// Ground height under a point: the park's lawn stands on a low wall; everything else is road.
export function floorAt(x, z) {
  const [px, pz] = PARK.at, [w, , d] = PARK.size;
  return Math.abs(x - px) < w / 2 && Math.abs(z - pz) < d / 2 ? 0.36 : 0;
}

export function intersections() {
  const out = [];
  for (const x of INNER_AVENUES) for (const z of INNER_STREETS) out.push(new THREE.Vector3(x, 0, z));
  return out;
}

// A random point on a road: along an avenue or a street, off the intersections' centres.
export function roadPoint(rng, { lane = 0 } = {}) {
  if (rng() < 0.5) {
    const x = rng.pick(INNER_AVENUES) + lane, z = THREE.MathUtils.lerp(INNER_STREETS.at(-1), INNER_STREETS[0], rng());
    return new THREE.Vector3(x, 0, z);
  }
  const z = rng.pick(INNER_STREETS) + lane, x = THREE.MathUtils.lerp(INNER_AVENUES[0], INNER_AVENUES.at(-1), rng());
  return new THREE.Vector3(x, 0, z);
}

// A front door: the sidewalk in front of a real parcel, facing the street it fronts.
export function doorPoint(rng, briefs, near = null, range = [60, 260]) {
  const pool = briefs.filter((b) => !b.landmark && !b.reserved && Math.abs(b.x) < WORLD.x[1] - 20).filter((b) => {
    if (!near) return true;
    const d = Math.hypot(b.x - near.x, b.z - near.z);
    return d > range[0] && d < range[1];
  });
  const b = rng.pick(pool.length ? pool : briefs);
  const side = b.facing === 'north' ? -1 : 1;
  return { at: new THREE.Vector3(b.x, 0.18, b.z + side * (b.d / 2 + 1.6)), facing: side, brief: b };
}
