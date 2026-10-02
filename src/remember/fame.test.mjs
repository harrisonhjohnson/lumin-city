import test from 'node:test';
import assert from 'node:assert/strict';
import { createTown, DAY } from './town.js';
import { initCivic, buy, forecast } from './civic.js';
import { fame, served, nightly, likesOf, loves, giftWeight } from './fame.js';

const setup = () => { const t = createTown({ hour: 10 }); initCivic(t); return t; };

test('everyone loves one or two things; doing them well wins over their fans', () => {
  const t = setup();
  assert.ok(t.residents.every((r) => likesOf(r).length >= 1 && likesOf(r).length <= 2));
  const skaters = t.residents.filter((r) => loves(r, 'skating'));
  assert.ok(skaters.length > 30);
  assert.equal(fame(t, 'skate', 'A'), skaters.length);
  assert.ok(skaters.every((r) => r.opinion >= 0.02));
  const other = t.residents.find((r) => !loves(r, 'skating'));
  assert.ok(other.opinion > 0 && other.opinion < 0.01, 'a great round gets everyone talking a little');
});

test('the forecast moves as the city warms to you', () => {
  const t = setup(), before = forecast(t).you;
  for (const r of t.residents.slice(0, 300)) r.opinion = 0.6;
  assert.ok(forecast(t).you > before + 200 && forecast(t).share > 0.45);
});

test('cooking, owning the pizzeria and being a good landlord all build a name', () => {
  const t = setup();
  const ids = t.residents.slice(0, 10).map((r) => r.id);
  served(t, ids);
  assert.ok(ids.every((id) => t.person(id).opinion >= 0.05));
  const home = t.places.find((p) => p.kind === 'home' && t.tenantsOf(p.id).some((r) => r.landlord));
  buy(t, home.id, 1e9);
  const tenants = t.tenantsOf(home.id).filter((r) => r.landlord === 'player');
  const before = tenants.map((r) => r.opinion);
  t.day += 1; nightly(t);
  assert.ok(tenants.every((r, i) => r.opinion > before[i]));
});

test('gifts have diminishing returns', () => {
  const t = setup(), r = t.residents[3];
  const a = giftWeight(r, t), b = giftWeight(r, t), c = giftWeight(r, t);
  assert.ok(a === 1 && b < a && c < b);
});
