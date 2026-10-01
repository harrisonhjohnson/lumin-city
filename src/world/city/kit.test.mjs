import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { KIT, KIT_NAMES, BUDGET } from './bible.js';

// The Blender export is checked against the bible, not the other way round.
const kit = JSON.parse(readFileSync(new URL('../../../public/city/kit.json', import.meta.url), 'utf8'));
assert.deepEqual(Object.keys(kit.parts).sort(), [...KIT_NAMES].sort(), 'kit.glb has exactly the bible parts');
for (const [name, p] of Object.entries(kit.parts)) {
  assert(p.tris <= BUDGET.trisPerPart, `${name}: ${p.tris} tris over ${BUDGET.trisPerPart}`);
  assert.deepEqual(p.size, KIT[name].size, `${name} was built at the bible size`);
}
assert.equal(kit.over.length, 0);
const glb = statSync(new URL('../../../public/city/kit.glb', import.meta.url));
assert(glb.size > 1000 && glb.size < 512 * 1024, `kit.glb is ${glb.size} bytes`);
console.log(`Kit: ${KIT_NAMES.length} parts, max ${Math.max(...Object.values(kit.parts).map((p) => p.tris))} tris, ${Math.round(glb.size / 1024)} KB.`);
