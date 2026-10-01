import assert from 'node:assert/strict';
import { applyKnobs, readKnobs, knobsMoved, reshapeBrief, describeKnobs, KNOB_NAMES, KNOBS } from './knobs.js';
import { validate } from './validate.js';
import { lots } from './lots.js';
import { buildCity } from './build.js';

const all = lots(), city = buildCity();
const block = all.filter((b) => b.block === 'b1-2' && !b.landmark && !b.reserved);
const keep = Object.fromEntries(KNOB_NAMES.map((n) => [n, 'keep']));
const legal = (b0, r, k) => { const b = reshapeBrief(b0, k); return validate('LotFill', r.fill, b).ok && validate('RoofDressing', r.roof, b, { fill: r.fill }).ok && validate('Facade', r.facade, b).ok; };

// Every option of every knob, alone, yields a legal row on every parcel.
let single = 0;
for (const n of KNOB_NAMES) for (const v of (KNOBS[n].noul ? ['on'] : Object.keys(KNOBS[n].ask.criteria))) {
  if (v === 'keep') continue;
  for (const b of block) { const r = applyKnobs(b, city.fills[b.id], { ...keep, [n]: v }); assert(legal(b, r, { ...keep, [n]: v }), `${b.id} ${n}=${v}`); single++; }
}
// Loud combinations, all legal, and each knob lands.
const combos = [
  { ...keep, material: 'facade3', height: 'taller', windows: 'brighter', roof_waterTower: 'on', roof_antenna: 'on', fireEscapes: 'on', roofEdge: 'cornice' },
  { ...keep, height: 'shorter', windows: 'dimmer', roof: 'clear', storefronts: 'off', massing: 'slab', roofEdge: 'parapet' },
  { ...keep, material: 'facade4', massing: 'stepped', roof_billboardFrame: 'on', scaffolding: 'on', awnings: 'on' },
];
for (const k of combos) for (const b of block) {
  const cur = city.fills[b.id], r = applyKnobs(b, cur, k);
  assert(legal(b, r, k), `${b.id} ${JSON.stringify(k)}`);
  if (k.material !== 'keep') assert.equal(r.fill.material, k.material);
  if (k.roof === 'clear') assert.equal(r.roof.parts.length, 0);
  if (k.roofEdge !== 'keep') assert.equal(r.fill.parapet, k.roofEdge);
  if (k.massing === 'slab') assert.equal(r.fill.tiers.length, 1);
  if (k.awnings === 'on') for (const w of Object.values(r.facade.walls)) assert(w.awning && w.storefront);
  if (k.storefronts === 'off') for (const w of Object.values(r.facade.walls)) assert(!w.storefront && !w.awning);
}
const tall = block.map((b) => applyKnobs(b, city.fills[b.id], combos[0]));
const grew = tall.filter((r, i) => r.fill.tiers.at(-1).h > city.fills[block[i].id].fill.tiers.at(-1).h * 1.3).length;
assert(grew >= block.length * 0.7, `taller grows most parcels by 30%+ (${grew}/${block.length})`);
const towers = tall.filter((r) => r.roof.parts.some((p) => p.part === 'waterTower')).length;
const eligible = tall.filter((r, i) => { const t = r.fill.tiers.at(-1); return t.h >= 20 && Math.min(block[i].w, block[i].d) - 2 * t.inset >= 4.6; }).length;
assert.equal(towers, eligible, 'water towers land on every roof that can hold one');
const rebuilt = buildCity({ fillFor: (b) => (b.block === 'b1-2' ? tall[block.findIndex((x) => x.id === b.id)] : null) });
for (const [i, b] of block.entries()) assert.equal(rebuilt.fills[b.id].fill.tiers.at(-1).h, tall[i].fill.tiers.at(-1).h, `${b.id} keeps its reshaped height on rebuild`);

// Low-confidence answers read as keep; the panel line names what moved.
const k = readKnobs({ material: { choice: 'facade1', confidence: 0.2 }, height: { choice: 'taller', confidence: 0.9 }, roof_antenna: { noul: 0.9 }, roof_chimney: { noul: 0.3 }, needsModel: { noul: 0.1 } });
assert.equal(k.material, 'keep'); assert.equal(k.height, 'taller'); assert.equal(k.roof_antenna, 'on'); assert.equal(k.roof_chimney, 'keep'); assert(knobsMoved(k)); assert.equal(describeKnobs(k), 'taller, antennas on the roofs');
console.log(`Knobs: ${KNOB_NAMES.length} knobs, ${single} single-option rows + ${combos.length} combos × ${block.length} parcels all legal; ${towers}/${eligible} towers.`);
