import './agent-ui.css';

// The screens for watching models play: the setup card, a mind panel per model (its thinking
// as it streams, what it did, what the town said back, the hard choices it made), the control
// bar, a tag over each one's head, and the end card (one model, or two side by side).

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const h = (tag, cls, ...kids) => { const n = el(tag, cls); for (const k of kids) if (k != null) n.append(k); return n; };
const button = (cls, text, onClick) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; };
const usd = (v) => `$${Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)}`;

export function createAgentUI() {
  const root = el('div', 'rm-ui rm-ag');
  document.body.append(root);

  // ---- setup --------------------------------------------------------------------------------

  function setup({ models, goals, cities, years }) {
    return new Promise((resolve) => {
      const pick = { mode: 'solo', model: models[0].id, modelB: models[models.length - 1].id, goal: goals[0].id, city: cities[0].id, year: '2000', days: 1, dilemmas: true };
      const group = (label, key, options, onPick) => {
        const row = h('div', 'rm-ag-opts');
        const btns = options.map((o) => {
          const b = button('rm-ag-opt', null, () => {
            pick[key] = o.id;
            btns.forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
            onPick?.(o.id);
          });
          b.append(h('b', null, o.label)); if (o.hint) b.append(el('small', null, o.hint));
          b.classList.toggle('is-on', o.id === pick[key]);
          b.setAttribute('aria-pressed', String(o.id === pick[key]));
          row.append(b);
          return b;
        });
        return h('fieldset', 'rm-ag-field', el('legend', null, label), row);
      };
      const modelOpts = models.map((m) => ({ id: m.id, label: m.label, hint: m.hint }));
      const modelA = group('Model', 'model', modelOpts), modelB = group('Model B', 'modelB', modelOpts);
      modelB.hidden = true;
      const mode = group('Players', 'mode', [{ id: 'solo', label: 'One model' }, { id: 'duel', label: 'Head to head', hint: 'Twin towns, same choices' }], (v) => {
        modelB.hidden = v !== 'duel';
        modelA.querySelector('legend').textContent = v === 'duel' ? 'Model A' : 'Model';
      });
      const own = el('textarea', 'rm-ag-own');
      own.placeholder = 'Or write your own goal: "Make Rosa the baker your best friend"';
      own.maxLength = 220; own.rows = 2;
      const done = (v) => { card.remove(); removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      addEventListener('keydown', onKey);
      const card = h('div', 'rm-ag-setup',
        h('div', 'rm-ag-card',
          el('p', 'rm-ag-kicker', 'Watch an AI play'),
          el('h2', 'rm-ag-title', 'Who plays the town?'),
          el('p', 'rm-ag-lede', 'Claude moves in with a little cash and two pizzas. It has to eat every day, pick its jobs, and decide what kind of neighbour to be. You watch it think.'),
          mode, modelA, modelB,
          group('Goal', 'goal', goals.map((g) => ({ id: g.id, label: g.label }))),
          own,
          group('Hard choices', 'dilemmas', [{ id: true, label: 'On', hint: 'Six dilemmas on day one' }, { id: false, label: 'Off' }]),
          h('div', 'rm-ag-pair', group('City', 'city', cities), group('Year', 'year', years.map((y) => ({ id: y.id, label: y.label })))),
          group('How long', 'days', [{ id: 1, label: 'One day' }, { id: 2, label: 'Two days' }]),
          h('div', 'rm-ag-go',
            button('rm-ag-btn is-ghost', 'Back', () => done(null)),
            button('rm-ag-btn', 'Start watching', () => done({ ...pick, own: own.value.trim() })))));
      root.append(card);
      card.querySelector('.rm-ag-btn:not(.is-ghost)').focus({ preventScroll: true });
    });
  }

  // ---- the control bar ----------------------------------------------------------------------

  function controls({ speeds, speed, names = [], onSpeed, onPause, onStop, onFocus }) {
    root.classList.toggle('is-duel', names.length > 1);
    let paused = false;
    const pauseBtn = button('rm-ag-chip rm-ag-pause', 'Pause', () => { paused = !paused; pauseBtn.textContent = paused ? 'Play' : 'Pause'; pauseBtn.classList.toggle('is-on', paused); onPause(paused); });
    const speedBtns = speeds.map((s) => { const b = button('rm-ag-chip', `${s}×`, () => { onSpeed(s); speedBtns.forEach((x) => x.classList.toggle('is-on', x === b)); }); b.classList.toggle('is-on', s === speed); return b; });
    const follow = names.length > 1 ? names.map((n, i) => button(`rm-ag-chip rm-ag-follow is-${'ab'[i]}`, `Follow ${n}`, () => { setFocus(i); onFocus(i); })) : [];
    const setFocus = (i) => follow.forEach((b, k) => b.classList.toggle('is-on', k === i));
    setFocus(0);
    const bar = h('div', 'rm-ag-bar', pauseBtn, h('span', 'rm-ag-group', ...speedBtns), follow.length ? h('span', 'rm-ag-group', ...follow) : null, button('rm-ag-x', 'End run', () => onStop()));
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Run controls');
    root.append(bar);
    return { setFocus, close() { bar.remove(); root.classList.remove('is-duel'); } };
  }

  // ---- a mind panel -------------------------------------------------------------------------

  function panel({ model, goal, side = 'right', badge = '' }) {
    const feed = el('div', 'rm-ag-feed');
    feed.setAttribute('aria-live', 'polite');
    const stat = (label) => { const v = el('b', null, '–'); return [h('div', 'rm-ag-stat', el('small', null, label), v), v]; };
    const [sCash, vCash] = stat('Cash'), [sClock, vClock] = stat('Time'), [sCity, vCity] = stat('Liked'), [sFood, vFood] = stat('Pizzas'), [sTurn, vTurn] = stat('Turn'), [sCost, vCost] = stat('Spent');
    const notebook = el('p', 'rm-ag-note-text', 'Empty so far.');
    const box = h('aside', `rm-ag-panel is-${side}${badge ? ` is-${badge.toLowerCase()}` : ''}`,
      h('header', 'rm-ag-head', h('div', 'rm-ag-who', el('small', null, badge ? `Model ${badge}` : 'Watching'), el('b', null, model))),
      el('p', 'rm-ag-goal', goal),
      h('div', 'rm-ag-stats', sCash, sClock, sCity, sFood, sTurn, sCost),
      feed,
      h('details', 'rm-ag-note', el('summary', null, 'Its notebook'), notebook));
    box.setAttribute('aria-label', `What ${model} is thinking`);
    root.append(box);

    const stick = () => feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    const scroll = (was) => { if (was) feed.scrollTop = feed.scrollHeight; };
    const add = (node) => { const was = stick(); feed.append(node); scroll(was); return node; };

    return {
      turn(time) {
        const thought = el('p', 'rm-ag-thought'), entry = add(h('section', 'rm-ag-entry is-thinking', h('div', 'rm-ag-when', el('span', null, time), el('i', null, 'thinking…')), thought));
        const settle = () => { entry.classList.remove('is-thinking'); entry.querySelector('.rm-ag-when i').textContent = ''; if (!thought.textContent) thought.remove(); };
        return {
          thought(text) { const was = stick(); thought.textContent = text; scroll(was); },
          act(label, result, ok, talk) {
            const was = stick();
            settle();
            entry.append(h('p', 'rm-ag-act', el('span', null, 'Does'), el('b', null, label)));
            if (talk) entry.append(h('blockquote', 'rm-ag-say', el('small', null, talk.name), el('span', null, talk.line)));
            const rest = talk && !talk.keep ? result.replace(/^[^:]+: "[^"]*"\s*/, '') : result;
            if (rest) entry.append(el('p', `rm-ag-res${ok ? '' : ' is-bad'}`, rest));
            scroll(was);
          },
          error(msg) { settle(); entry.append(el('p', 'rm-ag-res is-bad', msg)); },
        };
      },
      dilemma({ title, text }) { add(h('section', 'rm-ag-dilemma', el('small', null, 'A hard choice'), el('b', null, title), el('p', null, text))); },
      note(text) { add(el('p', 'rm-ag-night', text)); },
      notebook(text) { notebook.textContent = text || 'Empty so far.'; },
      focus(on) { box.classList.toggle('is-focus', on); },
      stats({ cash, cashDelta, clock, pizzas, ate, city, turn, turns, cost }) {
        vCash.textContent = usd(cash);
        vCash.dataset.delta = cashDelta ? `${cashDelta > 0 ? '+' : '−'}${usd(Math.abs(cashDelta))}` : '';
        vCash.classList.toggle('is-up', cashDelta > 0); vCash.classList.toggle('is-down', cashDelta < 0);
        vFood.textContent = String(pizzas);
        vFood.dataset.delta = ate ? 'ate today' : 'hungry';
        vFood.classList.toggle('is-up', ate); vFood.classList.toggle('is-down', !ate);
        vClock.textContent = clock; vCity.textContent = `${city}%`; vTurn.textContent = `${turn}/${turns}`; vCost.textContent = `$${cost.toFixed(cost < 0.1 ? 3 : 2)}`;
      },
      close() { box.remove(); },
    };
  }

  // ---- over their heads ---------------------------------------------------------------------

  const tags = new Map();
  function showTag(key, x, y, text, thinking) {
    let tag = tags.get(key);
    if (!tag) { tag = el('div', `rm-ag-tag is-${key}`); root.append(tag); tags.set(key, tag); }
    tag.hidden = false;
    tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    if (tag.textContent !== text) tag.textContent = text;
    tag.classList.toggle('is-thinking', !!thinking);
  }
  function hideTags() { for (const t of tags.values()) t.hidden = true; }
  const hideTag = (key) => { const t = tags.get(key); if (t) t.hidden = true; };

  // ---- the end ------------------------------------------------------------------------------

  const downloadBtn = (download) => (download ? button('rm-ag-btn is-ghost', 'Download the run', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(download.data, null, 2)], { type: 'application/json' }));
    const a = el('a'); a.href = url; a.download = download.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }) : null);

  function finish(card) {
    return new Promise((resolve) => {
      const done = (v) => { card.remove(); resolve(v); };
      card.querySelector('[data-go="title"]').addEventListener('click', () => done('title'));
      card.querySelector('[data-go="again"]').addEventListener('click', () => done('again'));
      root.append(card);
      card.querySelector('[data-go="again"]').focus({ preventScroll: true });
    });
  }
  const goButtons = (download) => {
    const back = el('button', 'rm-ag-btn is-ghost', 'Back to the title'), again = el('button', 'rm-ag-btn', 'Watch another run');
    back.type = again.type = 'button'; back.dataset.go = 'title'; again.dataset.go = 'again';
    return h('div', 'rm-ag-go', downloadBtn(download), back, again);
  };
  const choiceList = (choices) => (choices?.length ? h('div', 'rm-ag-picks', el('p', 'rm-ag-kicker', 'The hard choices'),
    ...choices.map((c) => h('section', 'rm-ag-pick', el('b', null, c.title), h('div', 'rm-ag-pick-row',
      ...c.cols.map((col) => h('div', `rm-ag-pick-col${col.cls ? ` ${col.cls}` : ''}${c.same ? '' : ' is-diff'}`, col.name ? el('small', null, col.name) : null, el('span', null, col.label || 'never came up'), col.reason ? el('i', null, `"${col.reason}"`) : null)))))) : null);

  function end({ title, rows, choices, download }) {
    return finish(h('div', 'rm-ag-setup',
      h('div', 'rm-ag-card rm-ag-end',
        el('p', 'rm-ag-kicker', 'The run is over'),
        el('h2', 'rm-ag-title', title),
        h('dl', 'rm-ag-rows', ...rows.flatMap(([k, v, tone]) => [el('dt', null, k), el('dd', tone ? `is-${tone}` : null, v)])),
        choiceList(choices?.map((c) => ({ title: c.title, same: true, cols: [{ label: c.label, reason: c.reason }] }))),
        goButtons(download))));
  }

  // Two models side by side: the numbers, then each hard choice with both answers and reasons.
  function compare({ title, names, rows, choices, download }) {
    const cell = (v, tone) => el('td', tone ? `is-${tone}` : null, v);
    const table = h('table', 'rm-ag-cmp',
      h('thead', null, h('tr', null, el('th', null, ''), el('th', 'is-a', names[0]), el('th', 'is-b', names[1]))),
      h('tbody', null, ...rows.map(([k, a, b, ta, tb]) => h('tr', null, el('th', null, k), cell(a, ta), cell(b, tb)))));
    return finish(h('div', 'rm-ag-setup',
      h('div', 'rm-ag-card rm-ag-end rm-ag-wide',
        el('p', 'rm-ag-kicker', 'Head to head is over'),
        el('h2', 'rm-ag-title', title),
        table,
        choiceList(choices.map((c) => ({ title: c.title, same: c.a?.choice === c.b?.choice, cols: [{ cls: 'is-a', name: names[0], ...c.a }, { cls: 'is-b', name: names[1], ...c.b }] }))),
        goButtons(download))));
  }

  return { setup, controls, panel, showTag, hideTag, hideTags, end, compare };
}
