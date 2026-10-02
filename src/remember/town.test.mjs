import test from 'node:test';
import assert from 'node:assert/strict';
import { createTown, DAY, placesFor } from './town.js';

const total = (t) => t.residents.reduce((n, r) => n + r.money, 0);

test('the same day always has the same people', () => {
  const a = createTown({ city: 'nyc', era: '2000' }), b = createTown({ city: 'nyc', era: '2000' });
  assert.equal(a.residents.length, 600);
  assert.deepEqual(a.residents.map((r) => r.name), b.residents.map((r) => r.name));
  assert.equal(new Set(a.residents.map((r) => r.id)).size, 600);
  assert.notDeepEqual(createTown({ city: 'tokyo', era: '1900' }).residents[0].name, a.residents[0].name);
});

test('every shop has a keeper and every home a door', () => {
  const t = createTown();
  for (const s of t.shops) assert.ok(t.residents.some((r) => r.shop === s.id), s.id);
  for (const p of placesFor()) assert.ok(Number.isFinite(p.door.x) && Number.isFinite(p.door.z));
});

test('a simulated day: people sleep, work, eat, and money moves between them', () => {
  const t = createTown({ hour: 6 });
  const kinds = new Set();
  const start = total(t);
  for (let s = 0; s < DAY; s += 60) { t.tick(60); for (const r of t.residents) kinds.add(r.act.kind); }
  for (const k of ['sleep', 'walk', 'eat-out', 'park']) assert.ok(kinds.has(k), k);
  assert.ok(kinds.has('work') || kinds.has('street'));
  assert.ok(t.residents.some((r) => r.log.some((l) => /^Ate at /.test(l.text))));
  assert.ok(t.residents.some((r) => r.stats.earned > 0));
  assert.notEqual(total(t), start);
  assert.equal(t.day, 1);
  assert.ok(t.residents.every((r) => r.money >= 0 && Object.values(r.needs).every((n) => n >= 0 && n <= 1)));
});

test('some people are outdoors near the middle of town at midday', () => {
  const t = createTown({ hour: 11 });
  for (let s = 0; s < 3600; s += 30) t.tick(30);
  assert.ok(t.outdoors({ x: 0, z: -200 }, 240).length >= 15);
});

test('save and load keeps everyone, and resumes at the remembered hour', () => {
  const t = createTown({ hour: 9 });
  for (let s = 0; s < 7200; s += 60) t.tick(60);
  const raw = JSON.parse(JSON.stringify(t.save()));
  const u = createTown({ saved: raw, hour: 9 });
  assert.ok(u.clock >= t.clock && Math.abs(u.hour - 9) < 1e-9);
  assert.deepEqual(u.residents.map((r) => r.money), t.residents.map((r) => r.money));
});

test('a cab ride: hailed, carried, dropped off where they were going', () => {
  const t = createTown({ hour: 10 });
  for (let s = 0; s < 1800; s += 30) t.tick(30);
  const r = t.residents.find((p) => p.act.kind === 'walk');
  const dest = r.act.to;
  t.hail(r, { x: 1, z: 2 });
  t.tick(3600);
  assert.equal(r.act.kind, 'ride');
  t.dropOff(r, dest);
  assert.notEqual(r.act.kind, 'ride');
});

test('a town saved with fewer people grows to the full roster, keeping everyone it had', () => {
  const t = createTown({ hour: 9 });
  const old = JSON.parse(JSON.stringify(t.save()));
  old.residents = old.residents.slice(0, 240);
  old.residents[5].opinion = 0.9;
  const u = createTown({ saved: old, hour: 9 });
  assert.equal(u.residents.length, 600);
  assert.equal(u.residents[5].opinion, 0.9);
  assert.equal(new Set(u.residents.map((r) => r.id)).size, 600);
});
