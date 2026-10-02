import test from 'node:test';
import assert from 'node:assert/strict';
import { createTown } from './town.js';
import { initCivic } from './civic.js';
import { buildCity } from '../world/city/build.js';
import { questFor, accept, complete, completableAtTalk, expire, pizzaNightly, pizzaShift } from './quests.js';
import { lootToday, pickUp, collectiblesFor } from './loot.js';

const buildings = buildCity().buildings;
const can = { ride: true, buildings, park: { x: -70, z: -140, w: 110, d: 62 }, island: { x: 305, z: [-705, 285] } };
const setup = () => { const t = createTown({ hour: 10 }); initCivic(t); return t; };

test('about a third of people have something you can help with, and it fits their life', () => {
  const t = setup();
  const qs = t.residents.map((r) => questFor(r, t, can)).filter(Boolean);
  assert.ok(qs.length > t.residents.length * 0.2 && qs.length < t.residents.length * 0.5, `${qs.length} quests`);
  assert.ok(new Set(qs.map((q) => q.type)).size >= 3);
  for (const q of qs) if (q.type === 'rent') assert.equal(t.person(q.who).landlord, 'player');
  assert.equal(questFor(t.person(qs[0].who), t, can), qs[0], 'asking again gives the same quest');
});

test('a lost item is hidden in the city, found, and given back for a big opinion boost', () => {
  const t = setup();
  let q;
  for (const r of t.residents) { const x = questFor(r, t, { ...can, ride: false }); if (x?.type === 'lost') { q = x; break; } }
  accept(t, q);
  assert.ok(!completableAtTalk(q));
  const item = lootToday(t, buildings, can).find((it) => it.quest === q.id);
  assert.ok(item && Number.isFinite(item.x));
  pickUp(t, item);
  assert.ok(completableAtTalk(q));
  const before = t.person(q.who).opinion;
  complete(t, q);
  assert.ok(t.person(q.who).opinion > before + 0.4 && q.state === 'done');
});

test('rides run out; the pizzeria slips until someone works a good shift', () => {
  const t = setup();
  let q;
  for (const r of t.residents) { const x = questFor(r, t, can); if (x?.type === 'ride') { q = x; break; } }
  accept(t, q); t.clock = q.data.due + 1;
  assert.deepEqual(expire(t).map((x) => x.id), [q.id]);
  for (let i = 0; i < 4; i++) pizzaNightly(t);
  assert.ok(t.civic.pizza < 0.6);
  const p = t.residents.map((r) => questFor(r, t, { buildings: null })).find((x) => x?.type === 'pizza');
  accept(t, p);
  assert.equal(pizzaShift(t).length, 1);
  assert.equal(p.state, 'done');
});

test('a daily scatter of loot: same on reload, keepsakes go in the collection', () => {
  const t = setup(), a = lootToday(t, buildings, can);
  assert.ok(a.length >= 20 && a.some((it) => it.where === 'on a rooftop'));
  const k = a.find((it) => it.kind === 'keepsake');
  pickUp(t, k);
  assert.ok(t.collection[k.label] && collectiblesFor('2000').includes(k.label));
  const u = createTown({ saved: JSON.parse(JSON.stringify(t.save())), hour: 10 });
  assert.ok(!lootToday(u, buildings, can).some((it) => it.id === k.id));
});
