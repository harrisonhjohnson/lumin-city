import { BLOCK, BUILDABLE, MASSING, WORLD, START } from './bible.js';
import { createRng } from './rng.js';
import { blocks } from './blocks.js';
import { fieldHeight, touchesBroadway, landmarkAt } from './districts.js';

const LOTS_PER_ROW = Math.floor(BUILDABLE.x / BLOCK.lotWidth);
const ROW_DEPTH = BUILDABLE.z / 2;

// Parcel size by district: Midtown merges many lots, the trough keeps brownstone widths.
const PARCEL_RANGE = { midtown: [3, 8], downtown: [2, 6], trough: [1, 3], upper: [1, 4], park: [0, 0] };

// A lot brief is the boundary between authored work and fill work. Everything a fill row
// may decide is downstream of it; everything it states is fixed.
export function lots(seed = WORLD.seed) {
  const rng = createRng(seed);
  const briefs = [];
  const claimed = new Set();
  for (const block of blocks()) {
    if (block.district === 'park') continue;
    const [minLots, maxLots] = PARCEL_RANGE[block.district];
    for (const side of ['N', 'S']) {
      const z = side === 'N' ? block.minZ + ROW_DEPTH / 2 : block.maxZ - ROW_DEPTH / 2;
      let lot = 0;
      while (lot < LOTS_PER_ROW) {
        const count = Math.min(rng.int(minLots, maxLots), LOTS_PER_ROW - lot);
        const w = count * BLOCK.lotWidth - 0.6, x = block.minX + (lot + count / 2) * BLOCK.lotWidth;
        const rect = { minX: x - w / 2, maxX: x + w / 2, minZ: z - ROW_DEPTH / 2 + 0.3, maxZ: z + ROW_DEPTH / 2 - 0.3 };
        const corner = lot === 0 || lot + count === LOTS_PER_ROW;
        const avenueSide = lot === 0 ? 'west' : lot + count === LOTS_PER_ROW ? 'east' : null;
        let landmark = landmarkAt(rect);
        if (landmark && claimed.has(landmark.id)) landmark = null; else if (landmark) claimed.add(landmark.id);
        if (!touchesBroadway(rect) || landmark) {
          let h = fieldHeight(x, z) + rng() * MASSING.noise;
          h *= 0.7 + 0.08 * count;
          if (corner) h *= 1.15;
          h = Math.min(MASSING.maxHeight, Math.round(h));
          // The start roof is authored: fixed height, kept clear.
          const reserved = Math.abs(START.x - x) <= w / 2 && Math.abs(START.z - z) <= (ROW_DEPTH - 0.6) / 2 ? 'start' : null;
          if (reserved) h = START.roof;
          briefs.push({
            id: `${block.id}-${side}${lot}`, block: block.id, district: block.district, side,
            x, z, w, d: ROW_DEPTH - 0.6, lots: count, corner, avenueSide,
            facing: side === 'N' ? 'north' : 'south',
            heightTarget: h,
            maxTiers: h <= MASSING.troughMax || w < 14 ? 1 : h >= MASSING.slabMinHeight && w >= 22 ? 3 : 2,
            landmark: landmark ? landmark.id : null,
            reserved,
          });
        }
        lot += count;
      }
    }
  }
  return briefs;
}
export { LOTS_PER_ROW, ROW_DEPTH };
