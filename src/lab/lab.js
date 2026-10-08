import './lab.css';

// The lab page: renders public/lab/results.json (built by scripts/tally.mjs from saved runs).
// Each hard choice shows one row per option, and per model a dot for every run, filled when
// the model chose that option, with the count written beside it.

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const h = (tag, cls, ...kids) => { const n = el(tag, cls); for (const k of kids) if (k != null) n.append(k); return n; };
const usd = (v) => `$${Math.round(v).toLocaleString('en-US')}`;
const short = (name) => name.replace(/^Claude /, '');

function dots(count, total, side, name, option) {
  const row = h('span', `lab-dots is-${side}`);
  for (let i = 0; i < total; i++) row.append(el('i', i < count ? 'is-on' : null));
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', `${name} chose this in ${count} of ${total} runs`);
  row.title = `${name}: "${option}" in ${count} of ${total} runs`;
  return h('span', 'lab-pick', row, el('span', 'lab-count', `${count} of ${total}`));
}

function topPick(d, i) { return [...d.options].sort((a, b) => b.picks[i].count - a.picks[i].count)[0]; }

function matchup(m) {
  const names = m.sides.map((s) => short(s.name));
  const legend = h('p', 'lab-legend', ...names.map((n, i) => h('span', `lab-key is-${'ab'[i]}`, el('i'), el('span', null, n))));
  const avg = h('table', 'lab-avg',
    h('thead', null, h('tr', null, el('th', null, ''), ...names.map((n, i) => el('th', `is-${'ab'[i]}`, n)))),
    h('tbody', null,
      h('tr', null, el('th', null, 'Cash at the end'), ...m.averages.map((a) => el('td', null, usd(a.cash)))),
      h('tr', null, el('th', null, 'The city likes them'), ...m.averages.map((a) => el('td', null, `${a.liked}%`))),
      h('tr', null, el('th', null, 'Starved'), ...m.averages.map((a) => el('td', null, `${a.starved} of ${m.runs}`))),
      h('tr', null, el('th', null, 'Model cost per run'), ...m.averages.map((a) => el('td', null, `$${a.cost.toFixed(3)}`)))));
  avg.prepend(el('caption', 'lab-sr', `Averages over ${m.runs} runs`));

  const dilemmas = m.dilemmas.map((d) => {
    const tops = [0, 1].map((i) => topPick(d, i)), allSame = tops[0].id === tops[1].id && tops.every((t, i) => t.picks[i].count === d.asked[i]);
    const rows = d.options.map((o) => h('div', 'lab-opt',
      el('span', 'lab-opt-label', o.label),
      ...o.picks.map((p, i) => dots(p.count, d.asked[i] || m.runs, 'ab'[i], names[i], o.label))));
    const reasons = h('div', 'lab-reasons', ...tops.map((t, i) => (t.picks[i].reason ? h('p', `lab-reason is-${'ab'[i]}`, el('b', null, names[i]), el('span', null, `"${t.picks[i].reason}"`)) : null)));
    return h('section', `lab-dl${allSame ? '' : ' is-split'}`,
      h('header', null, el('h3', null, d.title), el('span', 'lab-tag', allSame ? 'Agreed every time' : 'They differ')),
      h('div', 'lab-opts', h('div', 'lab-opt lab-opt-head', el('span', null, ''), ...names.map((n, i) => el('span', `is-${'ab'[i]}`, n))), ...rows),
      reasons);
  });

  return h('article', 'lab-match',
    h('header', 'lab-match-head', el('h2', null, `${names[0]} vs ${names[1]}`), el('p', null, `Goal: ${m.goalLabel} · ${m.runs} run${m.runs > 1 ? 's' : ''}`), legend),
    avg, ...dilemmas);
}

// For each model that played under more than one goal (against a different model), its most
// common pick for each hard choice under each goal, so you can see what the goal changed.
function goalShift(matchups) {
  const by = new Map();
  for (const m of matchups) {
    if (m.sides[0].model === m.sides[1].model) continue;
    m.sides.forEach((sd, i) => {
      const g = (by.get(sd.model) || by.set(sd.model, { name: short(sd.name), side: 'ab'[i], goals: [] }).get(sd.model));
      g.goals.push({ label: m.goalLabel, runs: m.runs, picks: Object.fromEntries(m.dilemmas.map((d) => { const t = topPick(d, i); return [d.id, { label: t.label, count: t.picks[i].count, of: d.asked[i] || m.runs }]; })), titles: Object.fromEntries(m.dilemmas.map((d) => [d.id, d.title])) });
    });
  }
  const models = [...by.values()].filter((x) => x.goals.length >= 2);
  if (!models.length) return null;
  const ids = Object.keys(models[0].goals[0].picks), titles = models[0].goals[0].titles;
  const changed = (x, id) => new Set(x.goals.map((g) => g.picks[id].label)).size > 1;
  const counts = models.map((x) => `${x.name} changed ${ids.filter((id) => changed(x, id)).length} of ${ids.length}`).join('. ');
  const table = h('table', 'lab-shift',
    h('thead', null, h('tr', null, el('th', null, ''), ...models.flatMap((x) => x.goals.map((g) => el('th', `is-${x.side}`, `${x.name}: ${g.label}`))))),
    h('tbody', null, ...ids.map((id) => h('tr', null, el('th', null, titles[id]),
      ...models.flatMap((x) => x.goals.map((g) => { const p = g.picks[id]; const td = h('td', changed(x, id) ? 'is-changed' : null, el('span', null, p.label), el('small', null, `${p.count} of ${p.of} runs`)); return td; }))))));
  return h('section', 'lab-match lab-goal',
    h('header', 'lab-match-head', el('h2', null, 'What the goal changed'), el('p', null, `${counts}. Most common pick under each goal; changes are marked.`)),
    h('div', 'lab-scroll', table));
}

async function main() {
  const box = document.getElementById('results');
  try {
    const res = await fetch('/lab/results.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    box.replaceChildren(...[goalShift(data.matchups), ...data.matchups.map(matchup)].filter(Boolean), el('p', 'lab-updated', `Updated ${data.updated}.`));
  } catch {
    box.replaceChildren(el('p', 'lab-loading', 'The results could not be loaded.'));
  }
}
main();
