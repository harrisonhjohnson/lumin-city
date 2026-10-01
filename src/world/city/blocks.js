import { BLOCK, BUILDABLE } from './bible.js';
import { AVENUE_XS, STREET_ZS, districtOf } from './districts.js';

// A block is the buildable rectangle between two avenues and two streets. Columns run
// east–west by index, rows north–south; the x=0 avenue (the route) is never built on.
export function blocks() {
  const out = [];
  for (let c = 0; c < AVENUE_XS.length - 1; c++) {
    const cx = (AVENUE_XS[c] + AVENUE_XS[c + 1]) / 2;
    for (let r = 0; r < STREET_ZS.length - 1; r++) {
      const cz = (STREET_ZS[r] + STREET_ZS[r + 1]) / 2;
      out.push({
        id: `b${c}-${r}`, col: c, row: r, cx, cz,
        minX: cx - BUILDABLE.x / 2, maxX: cx + BUILDABLE.x / 2,
        minZ: cz - BUILDABLE.z / 2, maxZ: cz + BUILDABLE.z / 2,
        avenueWest: AVENUE_XS[c], avenueEast: AVENUE_XS[c + 1],
        streetNorth: STREET_ZS[r + 1], streetSouth: STREET_ZS[r],
        district: districtOf(cx, cz),
      });
    }
  }
  return out;
}
export const blockPitch = { x: BLOCK.avenuePitch, z: BLOCK.streetPitch };
