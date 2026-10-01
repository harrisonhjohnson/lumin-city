import test from 'node:test';
import assert from 'node:assert/strict';
import { worldSettings, weatherChoices, rankFor, ACTIVITIES } from './memory.js';
import { composeLook, SEASONS } from '../world/city/eras.js';
import { buildCity } from '../world/city/build.js';
import { MOVERS } from './rig.js';

test('each answer adds a layer, and the haze thins until the time of day replaces it', () => {
  const stages = [{}, { city: 'tokyo' }, { city: 'tokyo', year: '1900' }, { city: 'tokyo', year: '1900', season: 'winter', weather: 'snow' }, { city: 'tokyo', year: '1900', season: 'winter', weather: 'snow', time: 'dusk' }].map(worldSettings);
  assert.deepEqual(stages.map((s) => s.stage), [0, 1, 2, 3, 4]);
  const densities = stages.slice(0, 4).map((s) => s.time.fogDensity);
  assert.deepEqual([...densities].sort((a, b) => b - a), densities);
  assert.equal(stages[4].time, 'dusk');
  assert.equal(stages[1].kit, false);
  assert.equal(stages[2].kit, true);
});

test('an unremembered city is white clay with no traffic or neon', () => {
  const look = composeLook({ city: 'nyc' });
  assert.equal(look.signs, null);
  assert.equal(look.traffic.none, true);
  const city = buildCity({ look });
  assert.equal(city.vehicles.length, 0);
  assert.ok(!Object.keys(city.boxes).some((k) => k.startsWith('neon')));
});

test('1900 builds low and neon-free; 2100 builds tall with hovering traffic', () => {
  const tallest = (era) => Math.max(...buildCity({ look: composeLook({ city: 'nyc', era, season: 'summer' }) }).buildings.filter((b) => b.lot !== 'bridge').map((b) => b.height));
  assert.ok(tallest('1900') < tallest('2000'));
  assert.ok(tallest('2100') > tallest('2000'));
  const future = buildCity({ look: composeLook({ city: 'nyc', era: '2100', season: 'summer' }) });
  assert.ok(future.vehicles.length > 0 && future.vehicles.every((v) => v.bottom >= 14));
  const past = buildCity({ look: composeLook({ city: 'nyc', era: '1900', season: 'summer' }) });
  assert.ok(!Object.keys(past.boxes).some((k) => k.startsWith('neon')));
  assert.ok(!past.parts.some((p) => p.part === 'cab'));
});

test('every season offers two weathers the city can draw', () => {
  for (const s of Object.keys(SEASONS)) assert.equal(weatherChoices(s).length, 2);
});

test('activities map to movers and ranks are ordered', () => {
  assert.equal(ACTIVITIES.length, 8);
  assert.ok(Object.keys(MOVERS).length >= 6);
  assert.equal(rankFor(9999, [4, 3, 2, 1]), 'S');
  assert.equal(rankFor(0, [4, 3, 2, 1]), 'D');
});
