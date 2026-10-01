import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, load, unlock, finish, isOpen, canUnlock, UNLOCK_COST, MEMORIES_FOR } from './progress.js';

test('the first game is free, the second costs memories', () => {
  let p = fresh();
  assert.ok(canUnlock(p, 'skate'));
  p = unlock(p, 'skate');
  assert.ok(isOpen(p, 'skate'));
  assert.ok(isOpen(p, 'roam'));
  assert.ok(!canUnlock(p, 'race'));
  p = finish(p, 'skate', 'A').next;
  assert.equal(p.memories, MEMORIES_FOR.A);
  p = unlock(p, 'race');
  assert.ok(isOpen(p, 'race'));
  assert.equal(p.memories, MEMORIES_FOR.A - UNLOCK_COST);
});

test('free roam opens only after the first game', () => {
  assert.ok(!isOpen(fresh(), 'roam'));
});

test('B or better keeps the power, once; best rank never goes down', () => {
  let p = unlock(fresh(), 'aliens');
  let r = finish(p, 'aliens', 'C');
  assert.equal(r.kept, null);
  r = finish(r.next, 'aliens', 'B');
  assert.equal(r.kept.id, 'flight');
  r = finish(r.next, 'aliens', 'S');
  assert.equal(r.kept, null);
  r = finish(r.next, 'aliens', 'D');
  assert.equal(r.next.best.aliens, 'S');
  assert.deepEqual(r.next.kept, ['aliens']);
});

test('load survives junk', () => {
  assert.deepEqual(load('not json'), fresh());
  assert.deepEqual(load('{"memories":-5,"unlocked":["skate","skate","nope"]}').unlocked, ['skate']);
});
