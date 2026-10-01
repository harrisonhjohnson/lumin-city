import assert from 'node:assert/strict';
import { WORLD, PALETTE, FACADES, BUDGET, BLOCK, BUILDABLE, MASSING, BROADWAY, KIT, KIT_NAMES, LANDMARKS, LANDMARK_IDS, HUNT, RULES } from './bible.js';

assert(Object.keys(PALETTE).length <= 12, 'palette stays a closed, small list');
for (const f of FACADES) assert(f in PALETTE, `${f} is in the palette`);

assert.equal(BUILDABLE.x, BLOCK.avenuePitch - BLOCK.avenueWidth);
assert.equal(BUILDABLE.z, BLOCK.streetPitch - BLOCK.streetWidth);
assert(BUILDABLE.x > BUILDABLE.z, 'blocks are long along the street, like Manhattan');
assert(Math.floor(BUILDABLE.x / BLOCK.lotWidth) >= 8, 'a block frontage holds at least one full parcel');

for (const name of KIT_NAMES) {
  const part = KIT[name];
  assert(part.tris <= BUDGET.trisPerPart, `${name} within ${BUDGET.trisPerPart} tris`);
  assert(['roof', 'wall', 'street'].includes(part.on), `${name} has a placement`);
  assert(part.size.length === 3 && part.size.every((n) => n > 0), `${name} has a positive AABB`);
}
assert(KIT_NAMES.length >= 12 && KIT_NAMES.length <= 20, 'the kit is small enough to memorise');
for (const p of HUNT.hidingParts) assert(KIT[p]?.on === 'roof', `${p} is a roof part`);

assert.equal(new Set(LANDMARK_IDS).size, LANDMARKS.length, 'landmark ids are unique');
for (let i = 0; i < LANDMARKS.length; i++) for (let j = i + 1; j < LANDMARKS.length; j++) {
  const a = LANDMARKS[i], b = LANDMARKS[j];
  const apart = Math.abs(a.at[0] - b.at[0]) >= (a.size[0] + b.size[0]) / 2 || Math.abs(a.at[1] - b.at[1]) >= (a.size[2] + b.size[2]) / 2;
  assert(apart, `${a.id} and ${b.id} do not overlap`);
}
const [x0, x1] = WORLD.x, [z0, z1] = WORLD.z;
for (const l of LANDMARKS.filter((l) => l.id !== 'bridge')) assert(l.at[0] >= x0 && l.at[0] <= x1 && l.at[1] >= z0 && l.at[1] <= z1, `${l.id} is inside the playable box`);
for (const a of MASSING.attractors) assert(a.height <= MASSING.maxHeight);
assert(BROADWAY.from[1] === WORLD.z[1] && BROADWAY.to[1] === WORLD.z[0], 'Broadway runs the whole length');
assert(Object.keys(RULES).length >= 6);
console.log('Bible: palette closed, NYC block proportions, kit within budget, landmarks distinct and in bounds.');
