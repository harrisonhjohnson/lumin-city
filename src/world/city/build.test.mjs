import assert from 'node:assert/strict';
import { buildCity, countInstances } from './build.js';
import { BUDGET, KIT, START, WORLD } from './bible.js';

const a = buildCity(), b = buildCity();
assert.equal(countInstances(a), countInstances(b), 'a seed builds the same city twice');
assert(countInstances(a) <= BUDGET.instances, `instances ${countInstances(a)} within ${BUDGET.instances}`);
assert(a.buildings.length > 300 && a.anchors.length > 1000);
for (const p of a.parts) assert(p.part === 'spire' || p.part in KIT, `${p.part} is a kit part`);
for (const p of a.parts.filter((p) => KIT[p.part]?.on === 'roof')) {
  const roof = a.buildings.find((bb) => bb.lot === p.lot && Math.abs(bb.height + 0.02 - p.y) < 1e-6 && p.x >= bb.minX && p.x <= bb.maxX && p.z >= bb.minZ && p.z <= bb.maxZ);
  assert(roof, `${p.part} on ${p.lot} rests on its roof`);
}
for (const [x, y, z] of a.anchors) assert(a.buildings.some((bb) => Math.abs(bb.height + 1.1 - y) < 1e-6 && [bb.minX, bb.maxX].includes(x) && [bb.minZ, bb.maxZ].includes(z)), 'anchor sits on a tier corner');
const startRoof = a.buildings.find((bb) => START.x >= bb.minX && START.x <= bb.maxX && START.z >= bb.minZ && START.z <= bb.maxZ);
assert(startRoof && startRoof.height === START.roof, 'the start parcel is a 24 m clear roof');
assert(!a.parts.some((p) => p.lot === startRoof.lot && KIT[p.part]?.on === 'roof'), 'nothing on the start roof');
for (const bb of a.buildings) if (bb.lot !== 'bridge') assert(bb.maxX <= -15 || bb.minX >= 15, `${bb.lot} keeps the route avenue open`);
for (const bb of a.buildings) assert(bb.height <= WORLD.ceiling);
assert.equal(a.parts.filter((p) => p.landmark === 'billboard').length, 1);
assert.equal(a.parts.filter((p) => p.part === 'spire').length, 1);
console.log(`Build: ${countInstances(a)} instances, ${a.buildings.length} tier boxes, ${a.anchors.length} anchors; roof parts rest on roofs; route avenue clear.`);
