import { BLOCK, MASSING, BROADWAY, LANDMARKS } from './bible.js';

// Height target for a point: base + attractor pull, before noise and parcel bonuses.
export function fieldHeight(x, z) {
  let h = MASSING.base;
  for (const a of MASSING.attractors) {
    const d = Math.hypot(x - a.x, z - a.z);
    if (d < a.radius) h += a.height * (1 - d / a.radius) ** 1.5;
  }
  return Math.min(MASSING.maxHeight, h);
}

// Broadway's x at a given z, and whether a footprint touches its corridor.
export function broadwayX(z) {
  const [x0, z0] = BROADWAY.from, [x1, z1] = BROADWAY.to;
  return x0 + ((z - z0) / (z1 - z0)) * (x1 - x0);
}
export function touchesBroadway(rect) {
  const half = BROADWAY.width / 2;
  for (const z of [rect.minZ, (rect.minZ + rect.maxZ) / 2, rect.maxZ]) {
    const bx = broadwayX(z);
    if (rect.maxX >= bx - half && rect.minX <= bx + half) return true;
  }
  return false;
}

export function landmarkAt(rect) {
  return LANDMARKS.find((l) => {
    const [lx, lz] = l.at, [w, , d] = l.size;
    return rect.maxX > lx - w / 2 && rect.minX < lx + w / 2 && rect.maxZ > lz - d / 2 && rect.minZ < lz + d / 2;
  }) || null;
}

// District names are what the lot brief carries; the fill lane picks style from them.
export function districtOf(x, z) {
  const park = LANDMARKS.find((l) => l.kind === 'void');
  if (park && Math.abs(x - park.at[0]) < park.size[0] / 2 && Math.abs(z - park.at[1]) < park.size[2] / 2) return 'park';
  for (const a of MASSING.attractors) if (Math.hypot(x - a.x, z - a.z) < a.radius * 0.7) return a.name;
  if (z < MASSING.attractors[0].z - MASSING.attractors[0].radius * 0.7) return 'upper';
  return 'trough';
}

export const AVENUE_XS = [-2, -1, 0, 1, 2].map((k) => k * BLOCK.avenuePitch);
export const STREET_ZS = (() => { const zs = []; for (let z = 220; z >= -660; z -= BLOCK.streetPitch) zs.push(z); return zs; })();
