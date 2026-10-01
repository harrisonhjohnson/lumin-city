import assert from 'node:assert/strict';
import { blocks } from './blocks.js';
import { lots } from './lots.js';
import { fieldHeight, broadwayX, touchesBroadway, districtOf } from './districts.js';
import { BLOCK, BUILDABLE, MASSING, WORLD, LANDMARK_IDS } from './bible.js';

const bs = blocks();
assert(bs.length >= 40, `enough blocks (${bs.length})`);
for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
  const a = bs[i], b = bs[j];
  assert(a.maxX <= b.minX || b.maxX <= a.minX || a.maxZ <= b.minZ || b.maxZ <= a.minZ, `${a.id}/${b.id} do not overlap`);
}
for (const b of bs) {
  assert(b.maxX <= 0 || b.minX >= 0, `${b.id} never sits on the route avenue`);
  assert.equal(+(b.maxX - b.minX).toFixed(6), BUILDABLE.x);
  assert.equal(+(b.maxZ - b.minZ).toFixed(6), BUILDABLE.z);
}
assert(bs.some((b) => b.district === 'park'), 'one block is the park');
assert(bs.some((b) => b.district === 'midtown') && bs.some((b) => b.district === 'trough'));

assert(fieldHeight(MASSING.attractors[0].x, MASSING.attractors[0].z) > fieldHeight(-200, -100), 'Midtown is taller than the edge');
assert(fieldHeight(0, 0) <= MASSING.troughMax + MASSING.noise, 'the start sits in the trough');
assert(broadwayX(WORLD.z[1]) === -60 && broadwayX(WORLD.z[0]) === 200);
assert(touchesBroadway({ minX: broadwayX(-300) - 3, maxX: broadwayX(-300) + 3, minZ: -310, maxZ: -290 }));
assert(!touchesBroadway({ minX: 200, maxX: 220, minZ: -310, maxZ: -290 }));
assert.equal(districtOf(-70, -140), 'park');

const a = lots(), b = lots();
assert.equal(a.length, b.length, 'seed gives the same parcel count');
assert.deepEqual(a[17], b[17]);
assert(a.length >= 250, `a real city's worth of parcels (${a.length})`);
const ids = new Set(a.map((l) => l.id)); assert.equal(ids.size, a.length, 'brief ids unique');
for (const l of a) {
  assert(l.heightTarget > 0 && l.heightTarget <= MASSING.maxHeight, `${l.id} height in range`);
  assert(l.w > 0 && l.d > 0 && l.lots >= BLOCK.parcelLots[0] && l.lots <= BLOCK.parcelLots[1]);
  assert([1, 2, 3].includes(l.maxTiers));
  assert(l.landmark === null || LANDMARK_IDS.includes(l.landmark));
}
const parcelsLostToBroadway = bs.filter((b) => b.district !== 'park').length * 2 * 3 - a.length;
assert(parcelsLostToBroadway !== 0 || a.some((l) => touchesBroadway({ minX: l.x - l.w / 2, maxX: l.x + l.w / 2, minZ: l.z - l.d / 2, maxZ: l.z + l.d / 2 }) === false));
assert(a.filter((l) => l.landmark === 'spire').length >= 1, 'the spire lands on a parcel');
assert(a.filter((l) => l.landmark === 'flatiron').length >= 1, 'the flatiron lands on a parcel');
console.log(`Decomposition: ${bs.length} blocks tile cleanly, ${a.length} parcel briefs, deterministic for seed ${WORLD.seed}.`);
