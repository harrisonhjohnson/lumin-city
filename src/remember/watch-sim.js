// A match: one model, or two head to head, each in its own copy of the same seeded town. Shared
// by the browser, the batch runner and replays, so a run plays out identically in all three.
//
// The clock moves in whole STEP ticks on a fixed grid (or up to the moment a model is free), and
// stands still while any model is due a turn. Frame rate and playback speed only change how fast
// the ticks come, never which ticks happen, so a recorded run replays exactly from its actions.

import { createTown, START_HOUR } from './town.js';
import { initCivic } from './civic.js';
import { buildSocial } from './social.js';
import * as quests from './quests.js';
import * as fame from './fame.js';
import * as A from './agent.js';
import { MODELS, GOALS } from './agent-brain.js';

export const STEP = 60;
export const REPLAY_VERSION = 2;

export function watchTown({ city = 'nyc', year = '2000', time = 'dawn' } = {}) {
  const t = createTown({ city, era: year, hour: START_HOUR[time] ?? 6 });
  initCivic(t);
  buildSocial(t);
  t.onDay.push(quests.pizzaNightly, fame.nightly);
  t.civic.lastCheckIn = t.day + (t.hour >= 20 ? 1 : 0);
  return t;
}

export const turnsFor = (model, days) => days * (model.name === 'Haiku' ? 80 : 60);
export const goalTextOf = (s) => s.own || GOALS.find((g) => g.id === s.goal)?.text || GOALS[0].text;
const modelOf = (id) => MODELS.find((m) => m.id === id) || (() => { throw new Error(`Unknown model ${id}`); })();

// settings: { mode: 'solo' | 'duel', model, modelB, goal, own, city, year, days, dilemmas, watched }
export function createMatch(settings, { town } = {}) {
  const duel = settings.mode === 'duel', goalText = goalTextOf(settings);
  const picks = (duel ? [settings.model, settings.modelB] : [settings.model]).map(modelOf);
  const names = picks.map((m, i) => (duel && picks[0].id === picks[1].id ? `${m.name} ${'AB'[i]}` : m.name));
  const sides = picks.map((model, i) => {
    const t = i === 0 && town ? town : watchTown({ city: settings.city, year: settings.year });
    const agent = A.createAgent(t, { goal: goalText, name: model.name, days: settings.days, turns: turnsFor(model, settings.days), dilemmas: settings.dilemmas, watched: !!settings.watched });
    return { i, model, name: names[i], town: t, agent, cost: 0, log: [], notes: [] };
  });
  return { settings: { ...settings, goalText }, duel, names, sides, carry: 0 };
}

export const finished = (sd) => A.finished(sd.agent, sd.town);
export const over = (m) => m.sides.every(finished);
export const ready = (m) => m.sides.filter((sd) => !finished(sd) && sd.town.clock >= sd.agent.busyUntil);

// The night's news lands in sd.notes for whoever is showing it.
function night(sd) { A.settle(sd.agent, sd.town); const n = A.midnight(sd.agent, sd.town); if (n) sd.notes.push(n); }

// Spend up to `budget` game seconds. Stops early, dropping the rest, when a model is due a turn.
export function advance(m, budget) {
  m.carry += budget;
  for (;;) {
    const live = m.sides.filter((sd) => !finished(sd));
    if (!live.length || ready(m).length) { m.carry = 0; return; }
    const clock = m.sides[0].town.clock;
    const wake = Math.min(...live.map((sd) => Math.min(sd.agent.busyUntil, sd.agent.endClock)));
    const dt = Math.min(wake, (Math.floor(clock / STEP) + 1) * STEP) - clock;
    if (dt > m.carry) return;
    m.carry -= dt;
    for (const sd of m.sides) { sd.town.tick(dt); night(sd); }
  }
}

// A side's turn, in two halves around the model's thinking. begin() returns the report to send,
// plus a hard choice that just arrived (to show once), or null if the run ended at midnight.
export function begin(sd) {
  night(sd);
  if (finished(sd)) return null;
  const report = A.observe(sd.agent, sd.town), p = sd.agent.pending;
  const fresh = p && !sd.log.some((e) => e.dilemma === p.id) ? p : null;
  return { report, dilemma: fresh, time: timeOf(sd.town) };
}

// r: { tool, thought, text, usage } from the model (or a recording). Returns the logged entry.
export function apply(sd, turn, r, cost = 0) {
  const res = r.tool ? A.act(sd.agent, sd.town, r.tool.name, r.tool.args) : A.act(sd.agent, sd.town, 'wait', { hours: 0.25 });
  if (!r.tool) res.result = `It didn't pick an action${r.text ? `: "${r.text.slice(0, 160)}"` : ''}. Fifteen minutes went by.`;
  sd.cost += cost;
  const entry = { time: turn.time, report: turn.report, thought: r.thought || '', action: r.tool, text: r.text || undefined, label: res.label, result: res.result, ok: res.ok, usage: r.usage, dilemma: turn.dilemma?.id };
  sd.log.push(entry);
  return { entry, res };
}

export function wrapUp(m) { for (const sd of m.sides) { const last = A.wrapUp(sd.agent, sd.town); if (last) sd.notes.push(last); } }

export function record(m, { when = new Date().toISOString(), stopped = false } = {}) {
  return {
    v: REPLAY_VERSION, game: 'lumin.city', kind: m.duel ? 'head-to-head' : 'solo', when, stopped, settings: m.settings,
    sides: m.sides.map((sd) => ({ name: sd.name, model: sd.model.id, cost: sd.cost, score: A.scoreOf(sd.agent, sd.town), choices: sd.agent.choices, notebook: sd.agent.notebook, turns: sd.log })),
  };
}

// A brain that plays back a recording. Each turn hands back what the model did then, and flags
// the first turn whose report differs from the one the model saw (the sim has drifted).
export function playback(rec, i) {
  const turns = rec.sides[i].turns;
  let k = 0;
  const pb = {
    drift: null,
    done: () => k >= turns.length,
    next(report) {
      const t = turns[k++];
      if (!t) return null;
      if (!pb.drift && t.report !== report) pb.drift = { turn: k, time: t.time };
      return { tool: t.action, thought: t.thought, text: t.text, usage: t.usage };
    },
  };
  return pb;
}

// Plays a whole match with no clock to wait on: brains[i](report, sd) resolves to { tool, thought,
// text, usage, cost }. Ready sides think in parallel, as in the browser.
export async function runMatch(m, brains, { onTurn } = {}) {
  while (!over(m)) {
    const due = ready(m);
    if (!due.length) { advance(m, Infinity); continue; }
    await Promise.all(due.map(async (sd) => {
      const turn = begin(sd);
      if (!turn) return;
      const r = await brains[sd.i](turn.report, sd);
      const out = apply(sd, turn, r || {}, r?.cost || 0);
      onTurn?.(sd, out);
    }));
  }
  wrapUp(m);
  return m;
}

export function timeOf(t) { const h = t.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; }
