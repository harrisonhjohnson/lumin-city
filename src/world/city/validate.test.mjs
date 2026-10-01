import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from './validate.js';
import { CONTRACT_NAMES } from './contracts/index.js';
import { lots } from './lots.js';
import { defaultLotFill, defaultRoofDressing, defaultFacade } from './zoning.js';

const briefs = lots();
const briefById = new Map(briefs.map((b) => [b.id, b]));
for (const name of CONTRACT_NAMES) {
  const rows = JSON.parse(readFileSync(new URL(`./contracts/exemplars/${name}.json`, import.meta.url)));
  assert(rows.length >= 2, `${name} has exemplars`);
  for (const row of rows) {
    const r = validate(name, row, row.lot ? briefById.get(row.lot) : undefined);
    assert(r.ok, `${name} exemplar ${row.lot ?? row.landmark}: ${r.errors.join('; ')}`);
  }
}
// Every default fill row is a legal row — the generator obeys its own contracts.
let checked = 0;
for (const brief of briefs) {
  const fill = defaultLotFill(brief);
  if (brief.landmark) continue;
  for (const [name, row] of [['LotFill', fill], ['RoofDressing', defaultRoofDressing(brief, fill)], ['Facade', defaultFacade(brief, fill)]]) {
    const r = validate(name, row, brief, { fill });
    assert(r.ok, `${name} default for ${brief.id}: ${r.errors.join('; ')}`);
    checked++;
  }
}
// Bad rows fail on the named rule.
const brief = briefs.find((b) => b.heightTarget > 40 && !b.landmark && b.maxTiers >= 2);
const bad = [
  ['LotFill', { lot: brief.id, tiers: [{ h: 40, inset: 0 }, { h: 30, inset: 4 }], material: 'facade0', warmth: 0.2, parapet: 'cornice' }, /not above/],
  ['LotFill', { lot: brief.id, tiers: [{ h: 20, inset: 0 }], material: 'brick', warmth: 0.2, parapet: 'cornice' }, /material fails/],
  ['LotFill', { lot: brief.id, tiers: [{ h: 500, inset: 0 }], material: 'facade0', warmth: 0.2, parapet: 'cornice' }, /fails/],
  ['RoofDressing', { lot: brief.id, parts: [{ part: 'waterTower', x: 0, z: 0, rot: 0 }, { part: 'waterTower', x: 1, z: 0, rot: 0 }] }, /overlap/],
  ['RoofDressing', { lot: brief.id, parts: [{ part: 'waterTower', x: 90, z: 0, rot: 0 }] }, /hangs past|fails/],
  ['RoofDressing', { lot: brief.id, parts: [{ part: 'gargoyle', x: 0, z: 0, rot: 0 }] }, /fails/],
  ['RoofDressing', { lot: brief.id, parts: [{ part: 'chimney', x: 0, z: 0, rot: 0 }] }, /walk-ups/],
  ['Facade', { lot: brief.id, walls: { [brief.facing === 'north' ? 'south' : 'north']: { fireEscape: false, storefront: false, awning: false, scaffolding: false, cornice: false } } }, /party wall/],
  ['Billboard', { lot: brief.id, copy: 'ELEVATE YOUR VIBE', color: 'cab' }, /coined/],
  ['Clue', { landmark: 'spire', text: 'Unlock the journey to the needle.', where: 'city' }, /coined/],
];
for (const [name, row, re] of bad) {
  const r = validate(name, row, briefById.get(row.lot));
  assert(!r.ok && r.errors.some((e) => re.test(e)), `${name} bad row should fail ${re}: ${r.errors.join('; ')}`);
}
console.log(`Validate: exemplars pass, ${checked} default rows pass, ${bad.length} bad rows fail on the named rule.`);
