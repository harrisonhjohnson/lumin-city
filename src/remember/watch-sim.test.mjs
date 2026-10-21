import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, runMatch, advance, ready, over, begin, apply, wrapUp, record, playback } from './watch-sim.js';
import { MODELS } from './agent-brain.js';

const [HAIKU, SONNET] = MODELS.map((m) => m.id);
const SETTINGS = { mode: 'duel', model: HAIKU, modelB: SONNET, goal: 'rich', own: '', city: 'nyc', year: '2000', days: 1, dilemmas: true };

// A scripted player that only reads its report: decides when asked, eats, talks, works, wanders.
function scripted(seed) {
  let n = seed;
  return (report) => {
    n++;
    const pick = report.match(/DECISION NEEDED[\s\S]*?\n- (\w+):/);
    if (pick) return { tool: { name: 'decide', args: { choice: pick[1], reason: 'scripted' } }, thought: `deciding ${pick[1]}` };
    if (/NOT eaten/.test(report) && /Pizzas: [1-9]/.test(report)) return { tool: { name: 'eat', args: {} }, thought: 'eat' };
    const person = report.match(/\[(r\d{3})\]/), place = [...report.matchAll(/^- (b\d+|park):/gm)][n % 5];
    if (n % 4 === 0 && person) return { tool: { name: 'talk', args: { person: person[1], move: 'chat' } }, thought: 'chat' };
    if (n % 4 === 1) return { tool: { name: 'work', args: { hours: 2 } }, thought: 'work' };
    if (n % 4 === 2 && place) return { tool: { name: 'walk_to', args: { place: place[1] } }, thought: 'walk' };
    return { tool: { name: 'wait', args: { hours: 1 } }, thought: 'wait' };
  };
}

// Plays like the browser: the clock moves in uneven frame-sized slices between turns.
async function framed(m, brains, slices) {
  let f = 0;
  while (!over(m)) {
    const due = ready(m);
    if (!due.length) { advance(m, slices[f++ % slices.length]); continue; }
    for (const sd of due) { const turn = begin(sd); if (turn) apply(sd, turn, await brains[sd.i](turn.report)); }
  }
  wrapUp(m);
  return m;
}

test('a recorded match replays exactly, whatever the frame rate', async () => {
  const live = await runMatch(createMatch(SETTINGS), [scripted(0), scripted(7)]);
  const rec = JSON.parse(JSON.stringify(record(live)));
  assert.ok(rec.sides.every((s) => s.turns.length > 10));
  assert.ok(rec.sides.every((s) => s.choices.length >= 4), 'the hard choices came up');

  for (const slices of [[16.7 * 4], [3, 250, 41, 900], [1e9]]) {
    const pbs = rec.sides.map((_, i) => playback(rec, i));
    const again = await framed(createMatch(rec.settings), pbs.map((pb) => (report) => pb.next(report)), slices);
    assert.deepEqual(pbs.map((pb) => pb.drift), [null, null], `no drift at ${slices}`);
    assert.ok(pbs.every((pb) => pb.done()));
    assert.deepEqual(record(again, { when: rec.when }).sides.map((s) => s.score), rec.sides.map((s) => s.score));
  }
});

test('playback flags the first turn whose report differs', async () => {
  const rec = record(await runMatch(createMatch({ ...SETTINGS, mode: 'solo' }), [scripted(3)]));
  rec.sides[0].turns[4].report += ' (edited)';
  const pb = playback(rec, 0);
  await runMatch(createMatch(rec.settings), [(report) => pb.next(report)]);
  assert.equal(pb.drift?.turn, 5);
});
