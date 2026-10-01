import test from 'node:test';
import assert from 'node:assert/strict';
import { createTown, DAY } from './town.js';
import { initCivic, priceOf, buy, owned, tenantChoice, resolveTenant, decisionFor, decide, election, approval, goalProgress, ELECTION_EVERY } from './civic.js';
import { fresh } from './progress.js';

const fresher = () => { const t = createTown({ hour: 10 }); initCivic(t); return t; };
const aHome = (t) => t.places.find((p) => p.kind === 'home' && t.tenantsOf(p.id).some((r) => r.landlord) && t.ownerOf(p.id) !== 'player');

test('buying a building pays the seller and makes its tenants pay you rent at midnight', () => {
  const t = fresher(), home = aHome(t), price = priceOf(t, home.id), seller = t.person(t.ownerOf(home.id)), before = seller.money;
  assert.equal(buy(t, home.id, price - 1), null, 'not enough cash');
  assert.equal(buy(t, home.id, price), price);
  assert.equal(seller.money, Math.round((before + price) * 100) / 100);
  assert.deepEqual(owned(t), [home.id]);
  for (const r of t.tenantsOf(home.id)) r.money = 1e6;
  for (let s = 0; s < DAY; s += 120) t.tick(120);
  assert.ok(t.ledger.rent > 0);
});

test('a tenant who cannot pay lands on the ledger, and evicting them has consequences', () => {
  const t = fresher(), home = aHome(t);
  buy(t, home.id, 1e9);
  const tenant = t.tenantsOf(home.id).find((r) => r.landlord === 'player');
  tenant.money = 0; tenant.wage = 0;
  for (let s = 0; s < DAY; s += 120) t.tick(120);
  assert.ok(t.ledger.unpaid.includes(tenant.id));
  assert.equal(tenantChoice(t, tenant.id).options.length, 3);
  const friend = t.person(tenant.friends[0]), fo = friend.opinion;
  resolveTenant(t, tenant.id, 'evict');
  assert.notEqual(tenant.home, home.id);
  assert.ok(tenant.opinion < -0.5 && friend.opinion < fo);
});

test('a mayor decision moves opinion and money; the park can only be sold once', () => {
  const t = fresher();
  const d = decisionFor(t);
  assert.ok(d.options.length >= 2);
  const before = approval(t), money = t.civic.treasury;
  decide(t, 'park', 'pave');
  assert.ok(t.civic.flags.parkGone && t.civic.treasury > money && approval(t) < before);
  for (let day = 0; day < 40; day++) { t.day = day; assert.notEqual(decisionFor(t).id, 'park'); }
});

test('an election every thirty days, decided by votes; well-liked candidates win', () => {
  const t = fresher();
  assert.equal(t.civic.nextElection, ELECTION_EVERY);
  for (const r of t.residents) r.opinion = -0.5;
  let res = election(t);
  assert.ok(!res.won && res.total > 0 && res.candidates[0].votes < res.candidates[1].votes);
  for (const r of t.residents) r.opinion = 0.7;
  res = election(t);
  assert.ok(res.won);
  assert.equal(t.civic.mayor, 'player');
  assert.equal(goalProgress(t, fresh()).mayor, 1);
});

test('civic state survives a save', () => {
  const t = fresher(); buy(t, aHome(t).id, 1e9); decide(t, 'taxes', 'raise');
  const u = createTown({ saved: JSON.parse(JSON.stringify(t.save())), hour: 10 }); initCivic(u);
  assert.equal(owned(u).length, 1);
  assert.equal(u.civic.tax, t.civic.tax);
});
