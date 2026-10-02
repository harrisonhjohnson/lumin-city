import test from 'node:test';
import assert from 'node:assert/strict';
import { createTown } from './town.js';
import { buildSocial, nightly, access, isInfluential, influence, seen } from './social.js';

const setup = () => { const t = createTown({ hour: 10 }); buildSocial(t); return t; };

test('a few people are hubs; most know a handful', () => {
  const t = setup(), degrees = t.residents.map((r) => t.social.links.get(r.id).size).sort((a, b) => a - b);
  const median = degrees[degrees.length >> 1], top = degrees.at(-1);
  assert.ok(top > median * 3, `hub ${top} vs median ${median}`);
  const influential = t.residents.filter((r) => isInfluential(t, r)).length;
  assert.ok(influential > 5 && influential < t.residents.length * 0.2, `${influential} influential`);
});

test('helping a well-connected person spreads your name to the people they know', () => {
  const t = setup();
  const hub = [...t.residents].sort((a, b) => t.social.cloutOf(b.id) - t.social.cloutOf(a.id))[0];
  hub.opinion = 0.9; seen(t, hub);
  const friends = t.social.linksOf(hub.id).map((id) => t.person(id));
  nightly(t);
  assert.ok(friends.filter((f) => f.opinion > 0).length >= friends.length * 0.8);
  assert.ok(influence(t) > 0);
});

test('interest fades when you stop showing up', () => {
  const t = setup(), r = t.residents[50];
  r.opinion = 0.6; r.seen = t.day;
  t.day += 10;
  for (let i = 0; i < 5; i++) nightly(t);
  assert.ok(r.opinion < 0.5);
});

test('the influential are busy until someone close vouches for you', () => {
  const t = setup();
  const big = t.residents.find((r) => isInfluential(t, r));
  assert.equal(access(t, big).ok, false);
  t.person(t.social.linksOf(big.id)[0]).opinion = 0.6;
  const a = access(t, big);
  assert.ok(a.ok && a.voucher);
});
