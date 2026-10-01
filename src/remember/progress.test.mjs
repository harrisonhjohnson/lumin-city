import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, load, unlock, finish, isOpen, canUnlock, stateOf, costOf, choose, forksReady, buyUpgrade, ownedUpgrades, practiceBonus, earn, UNLOCK_COST, FORK_COST, ROAD_NOT_TAKEN, MEMORIES_FOR } from './progress.js';

const play = (p, game, rank) => finish(p, game, rank).next;

test('one of three ways in is free; the others cost memories; later games wait for ranks', () => {
  let p = fresh();
  assert.ok(canUnlock(p, 'pizza') && canUnlock(p, 'skate') && canUnlock(p, 'patrol'));
  assert.equal(stateOf(p, 'taxi'), 'locked');
  p = unlock(p, 'pizza');
  assert.ok(isOpen(p, 'pizza') && isOpen(p, 'roam'));
  assert.equal(costOf(p, 'skate'), UNLOCK_COST);
  assert.ok(!canUnlock(p, 'taxi'));
  p = play(p, 'pizza', 'B');
  assert.equal(stateOf(p, 'taxi'), 'locked', 'a B is not enough for the cab');
  p = play(p, 'pizza', 'A');
  assert.equal(stateOf(p, 'taxi'), 'buy');
  assert.deepEqual(forksReady(p), ['pizza']);
});

test('a fork: the chosen side is cheap, the road not taken costs three times as much', () => {
  let p = play(play(unlock(fresh(), 'pizza'), 'pizza', 'A'), 'pizza', 'S');
  p = choose(p, 'pizza', 'shop');
  assert.equal(costOf(p, 'shop'), FORK_COST);
  assert.equal(costOf(p, 'taxi'), ROAD_NOT_TAKEN);
  assert.equal(stateOf(p, 'taxi'), 'forked');
  assert.deepEqual(forksReady(p), []);
  p = unlock(p, 'shop');
  assert.ok(isOpen(p, 'shop'));
  assert.equal(p.memories, MEMORIES_FOR.A + MEMORIES_FOR.S - FORK_COST);
});

test('an A against the aliens gives laser and ice, and opens the kaiju', () => {
  let p = { ...play(play(unlock(fresh(), 'patrol'), 'patrol', 'B'), 'patrol', 'S'), memories: 9000 };
  p = unlock(choose(p, 'patrol', 'aliens'), 'aliens');
  let r = finish(p, 'aliens', 'B');
  assert.equal(r.powers, null);
  assert.equal(stateOf(r.next, 'kaiju'), 'locked');
  r = finish(r.next, 'aliens', 'A');
  assert.ok(r.powers);
  assert.deepEqual(r.next.powers, ['laser', 'ice']);
  assert.equal(stateOf(r.next, 'kaiju'), 'buy');
  assert.ok(finish(unlock(r.next, 'kaiju'), 'kaiju', 'A').hero);
});

test('rounds pay cash and count attempts; practice and upgrades help', () => {
  let p = unlock(fresh(), 'skate');
  const r = finish(p, 'skate', 'C');
  assert.ok(r.cash > 0);
  assert.equal(r.next.attempts.skate, 1);
  assert.ok(practiceBonus(8) > practiceBonus(1) && practiceBonus(50) === practiceBonus(8));
  p = earn(r.next, 100);
  p = buyUpgrade(p, 'skate', 'grip-tape', 40);
  assert.ok(ownedUpgrades(p, 'skate').has('grip-tape'));
  assert.equal(p.cash, 60);
  assert.equal(buyUpgrade(p, 'skate', 'magnet', 90), p, 'cannot afford');
});

test('B or better keeps the power, once; best rank never goes down', () => {
  let p = unlock(fresh(), 'skate');
  let r = finish(p, 'skate', 'C');
  assert.equal(r.kept, null);
  r = finish(r.next, 'skate', 'B');
  assert.equal(r.kept.id, 'board');
  r = finish(r.next, 'skate', 'S');
  assert.equal(r.kept, null);
  r = finish(r.next, 'skate', 'D');
  assert.equal(r.next.best.skate, 'S');
});

test('load survives junk and old saves', () => {
  assert.deepEqual(load('not json'), fresh());
  const old = load('{"memories":-5,"unlocked":["skate","skate","nope"],"kept":["skate"]}');
  assert.deepEqual(old.unlocked, ['skate']);
  assert.equal(old.memories, 0);
  assert.deepEqual(old.forks, {});
});
