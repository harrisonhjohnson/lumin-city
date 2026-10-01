import assert from 'node:assert/strict';
import { buildCity, countInstances } from './build.js';
import { BUDGET, START, WORLD } from './bible.js';
import { LOOKS, LOOK_IDS, paletteFor } from './looks.js';
import { TIMES, WEATHERS } from './conditions.js';

const nyc = buildCity({ look: 'nyc' }), tokyo = buildCity({ look: 'tokyo' });
const neon = (c) => Object.entries(c.boxes).filter(([k]) => k.startsWith('neon')).reduce((n, [, v]) => n + v.length, 0);
const count = (c, part) => c.parts.filter((p) => p.part === part).length;

// NYC is the default city; its neon is Times Square only, far less than Tokyo's.
assert.equal(countInstances(nyc), countInstances(buildCity()), 'nyc is the default city');
assert(neon(nyc) > 0 && neon(nyc) < neon(buildCity({ look: 'tokyo' })) / 4, `nyc neon is Midtown only (${neon(nyc)})`);
assert(nyc.briefs.filter((b) => b.district !== 'midtown').every((b) => !nyc.boxes.neonRed?.some((r) => r[0] === b.x && r[2] === b.z)), 'no neon roof signs outside Midtown');

// Tokyo reads as a different city: neon on the walls, no water towers or fire escapes, taller.
assert(neon(tokyo) > 500, `tokyo has neon (${neon(tokyo)})`);
assert.equal(count(tokyo, 'waterTower'), 0);
assert.equal(count(tokyo, 'fireEscape'), 0);
assert.equal(count(tokyo, 'cornice'), 0);
const avg = (c) => c.buildings.reduce((s, b) => s + b.height, 0) / c.buildings.length;
assert(avg(tokyo) > avg(nyc) * 1.1, 'tokyo runs taller');

// Every look stays inside the budgets and the playable box, and keeps the start roof.
for (const look of LOOK_IDS) {
  const c = look === 'nyc' ? nyc : look === 'tokyo' ? tokyo : buildCity({ look });
  assert(countInstances(c) <= BUDGET.instances, `${look}: ${countInstances(c)} instances within ${BUDGET.instances}`);
  for (const b of c.buildings) assert(b.height <= WORLD.ceiling, `${look}: ${b.lot} under the ceiling`);
  const start = c.buildings.find((b) => START.x >= b.minX && START.x <= b.maxX && START.z >= b.minZ && START.z <= b.maxZ);
  assert.equal(start.height, START.roof, `${look}: start roof stays 24 m`);
  for (const m of Object.keys(c.boxes)) assert(paletteFor(look)[m] !== undefined, `${look}: ${m} has a colour`);
}

// Stored rows are validated before the look: reshape reads back heights the rules accept.
for (const id of Object.keys(tokyo.fills)) assert.deepEqual(tokyo.fills[id].fill, nyc.fills[id].fill);

// Fewer lit windows late at night than at midnight: each facade tier carries its lit chance.
const lit = (c) => Object.entries(c.boxes).filter(([k]) => /^facade\d$/.test(k)).flatMap(([, v]) => v).reduce((s, r) => s + (r[6] ?? 0), 0);
assert(lit(buildCity({ lit: TIMES.late.lit })) < lit(nyc));

for (const [id, t] of Object.entries(TIMES)) for (const k of ['label', 'background', 'fog', 'fogDensity', 'hemi', 'sun', 'lit']) assert(t[k] !== undefined, `time ${id} has ${k}`);
for (const [id, w] of Object.entries(WEATHERS)) for (const k of ['label', 'fog', 'tint', 'wet']) assert(w[k] !== undefined, `weather ${id} has ${k}`);
for (const [id, l] of Object.entries(LOOKS)) for (const k of ['label', 'palette', 'roofSwap', 'walls', 'narrowLift', 'wideLift']) assert(l[k] !== undefined, `look ${id} has ${k}`);
