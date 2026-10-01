import { createUI } from './ui.js';

// Review harness for ui.js with fake data. ?scene=say|ask|askText|board|hud|results runs one scene; default runs the full flow.
// Progression pieces: board8 (locked/badged cards; &mem=600 sets the balance), memories, unlock (&title=SKATEBOARDING),
// confirm, roam (&score=1 also shows the score chip, &mem=0 hides the memories chip, &abil=5 changes the slot count, &meter=balance swaps the fare
// meter for the needle kind), progress (all of it, in order). board8&first=1 is the opening pick: seven open cards, none locked.
// Town pieces: talk (stranger -> reply flip -> friend -> broke and hungry; &who=stranger|friend|broke shows one card and stays open,
// &mood= &seed= &op= override it), wallet (&stack=1 adds the HUD and memories chips, &inf=1 starts on ∞), clock (&timer=1 runs a timer too),
// town (roam HUD + wallet + clock, then a friend walks up).
// ?root=body mounts on document.body, the way the game does.
const params = new URLSearchParams(location.search);
const ui = createUI(params.get('root') === 'body' ? document.body : document.getElementById('ui'));
window.__ui = ui;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.info('[ui-preview]', ...a);

const ACTIVITIES = [
  { id: 'skate', glyph: 'skate', colour: '#f2a93b', label: 'Skateboarding', hint: 'I was skateboarding through the city.' },
  { id: 'race', glyph: 'race', colour: '#e0322b', label: 'Street race', hint: 'I was driving in a car race.' },
  { id: 'heist', glyph: 'heist', colour: '#2b2f3a', label: 'The heist', hint: 'I was breaking into a museum to steal a jewel.' },
  { id: 'aliens', glyph: 'aliens', colour: '#3fb37f', label: 'Alien invasion', hint: 'I was defending the city from aliens with my superpowers.' },
  { id: 'patrol', glyph: 'patrol', colour: '#2b62a6', label: 'Night patrol', hint: 'I was patrolling the streets, fighting crime.' },
  { id: 'pizza', glyph: 'pizza', colour: '#d9621f', label: 'Pizza run', hint: 'I was delivering pizzas.' },
];

const mem = Number(params.get('mem') ?? 600);

// Eight cards: two played and badged, three the balance can buy, three it cannot.
const board8 = (total) => [
  { id: 'skate', glyph: 'skate', colour: '#f2a93b', label: 'Skateboarding', hint: 'I was skateboarding through the city.', badge: 'BEST: A' },
  { id: 'race', glyph: 'race', colour: '#e0322b', label: 'Street race', hint: 'I was driving in a car race.', locked: true, cost: 500 },
  { id: 'heist', glyph: 'heist', colour: '#2b2f3a', label: 'The heist', hint: 'I was breaking into a museum to steal a jewel.', locked: true, cost: 1000 },
  { id: 'aliens', glyph: 'aliens', colour: '#3fb37f', label: 'Alien invasion', hint: 'I was defending the city from aliens with my superpowers.', locked: true, cost: 1500 },
  { id: 'patrol', glyph: 'patrol', colour: '#2b62a6', label: 'Street patrol', hint: 'I was patrolling the streets, fighting crime.', badge: 'BEST: B' },
  { id: 'pizza', glyph: 'pizza', colour: '#d9621f', label: 'Pizza run', hint: 'I was delivering pizzas.', locked: true, cost: 600 },
  { id: 'taxi', glyph: 'taxi', colour: '#f6b90c', label: 'Cab driver', hint: 'I was driving a cab, fast.', locked: true, cost: 2000 },
  { id: 'roam', glyph: 'roam', colour: '#6b5b95', label: 'Just wander', hint: 'I was just walking around.', badge: 'KEPT: FLIGHT' },
].map((o) => (o.locked ? { ...o, afford: total >= o.cost } : o));

// Twelve cards as a path: tiers run left to right, lines join a card to what it unlocks, and the last tier is an either/or.
const board12 = (total) => [
  { id: 'skate', glyph: 'skate', label: 'Skateboarding', hint: 'I was skateboarding through the city.', tier: 0, state: 'done', rank: 'A', leadsTo: ['race', 'pizza', 'taxi'] },
  { id: 'race', glyph: 'race', label: 'Street race', hint: 'I was driving in a car race.', tier: 1, state: 'done', rank: 'B', leadsTo: ['heist'] },
  { id: 'pizza', glyph: 'pizza', label: 'Pizza run', hint: 'I was delivering pizzas.', tier: 1, state: 'open', leadsTo: ['shop'] },
  { id: 'taxi', glyph: 'taxi', label: 'Cab driver', hint: 'I was driving a cab, fast.', tier: 1, state: 'buy', cost: 500, leadsTo: ['aliens'] },
  { id: 'heist', glyph: 'heist', label: 'The heist', hint: 'I was breaking into a museum to steal a jewel.', tier: 2, state: 'buy', cost: 1000, leadsTo: ['patrol', 'owner'] },
  { id: 'shop', glyph: 'shop', label: 'Pizza shop', hint: 'I was running the oven on a Friday night.', tier: 2, state: 'locked', requirement: 'Get an A in Pizza run', leadsTo: ['mayor'] },
  { id: 'aliens', glyph: 'aliens', label: 'Alien invasion', hint: 'I was defending the city from aliens.', tier: 2, state: 'buy', cost: 1500, leadsTo: ['patrol'] },
  { id: 'patrol', glyph: 'patrol', label: 'Street patrol', hint: 'I was patrolling the streets.', tier: 3, state: 'locked', requirement: 'Win the Street race', leadsTo: ['kaiju', 'hero'] },
  { id: 'mayor', glyph: 'mayor', label: 'Become Mayor', hint: 'I was running for office.', tier: 3, state: 'locked', requirement: 'Own three buildings', leadsTo: [] },
  { id: 'owner', glyph: 'owner', label: 'Own the city', hint: 'I owned half of Main Street.', tier: 3, state: 'locked', requirement: 'Earn $5,000 in tips', leadsTo: [] },
  { id: 'kaiju', glyph: 'kaiju', label: 'Kaiju rampage', hint: 'I was the monster.', tier: 4, state: 'forked', cost: 1200, fork: 'VILLAIN OR HERO', leadsTo: [] },
  { id: 'hero', glyph: 'hero', label: 'Earth’s mightiest', hint: 'I was saving everyone.', tier: 4, state: 'buy', cost: 1200, fork: 'VILLAIN OR HERO', leadsTo: [] },
].map((o) => (o.cost != null ? { ...o, afford: o.state !== 'locked' && total >= o.cost } : o));

const ABILITIES = [
  { id: 'foot', label: 'On foot' },
  { id: 'skate', label: 'Skateboard' },
  { id: 'race', label: 'Race car' },
  { id: 'aliens', label: 'Flight' },
  { id: 'patrol', label: 'Web swing' },
  { id: 'pizza', label: 'Scooter' },
  { id: 'taxi', label: 'Cab' },
  { id: 'heist', label: 'Cash' },
];

const PEOPLE = {
  stranger: {
    name: 'Rosa Flanagan', job: 'Baker', place: 'Rossi’s Bakery', mood: 'fine', money: 214.5, opinion: null, portraitSeed: 41,
    line: 'Morning. You’re not from around here, are you? The bread’s still warm, if you’re buying.',
    facts: ['Lives on 4th & 23rd', 'Last: ate at Kim’s Pizzeria', 'Opens at six, sharp'],
    options: [
      { id: 'hello', label: 'Say hello', hint: 'costs nothing' },
      { id: 'buy', label: 'Buy a loaf', hint: '$4.00' },
      { id: 'ask', label: 'Ask about the street' },
      { id: 'bye', label: 'Walk on' },
    ],
  },
  friend: {
    name: 'Marco Rivera', job: 'Barista', place: 'Corner Café', mood: 'happy', money: 1240, opinion: 0.82, portraitSeed: 'marco',
    line: 'There he is! The usual? I already put the milk on.',
    facts: ['Lives on Bleecker', 'Last: ran the Pizza Run', 'Owes you a favour'],
    options: [
      { id: 'usual', label: 'The usual', hint: '$3.50' },
      { id: 'chat', label: 'Catch up' },
      { id: 'favour', label: 'Call in the favour' },
    ],
  },
  broke: {
    name: 'Dmitri Okonkwo-Reyes', job: 'Dock worker', place: 'Pier 9', mood: 'hungry', money: 3.25, opinion: -0.4, portraitSeed: 907,
    line: 'Haven’t eaten since yesterday. Can’t even afford a heel of bread.',
    facts: ['Rents a room on Mott', 'Last: slept at the docks', 'Shift ends at four'],
    options: [
      { id: 'meal', label: 'Buy him a meal', hint: '$9.00' },
      { id: 'lend', label: 'Lend him $20', hint: 'You only have $12', disabled: true },
      { id: 'ask', label: 'Ask what happened' },
      { id: 'bye', label: 'Walk on' },
    ],
  },
};
const REPLIES = {
  hello: ['Well. Aren’t you polite. Good to meet you.', 'happy', 0.18],
  buy: ['Four dollars. Thank you, dear. Mind, it’s hot.', 'happy', 0.1],
  ask: ['Quiet street, mostly. Mind the pigeons.', 'fine', 0.06],
  usual: ['Coming up. On the house, this once.', 'happy', 0.9],
  chat: ['Busy week. Everybody’s tired, everybody’s broke.', 'tired', 0.84],
  favour: ['Ha. Name it.', 'happy', 0.86],
  meal: ['I… thank you. I won’t forget that.', 'happy', -0.1],
  bye: ['Take care of yourself.', 'fine', 0.1],
};
const clockText = (day, m) => `DAY ${day} · ${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${m % 1440 >= 720 ? 'PM' : 'AM'}`;

const scenes = {
  async say() {
    ui.worldNote('the streets are coming back…');
    await ui.say('Let’s see if we can find that day again. It was a long time ago, wasn’t it?');
    log('say resolved');
  },
  async ask() {
    const id = await ui.ask('Remind me — did you live in New York or Tokyo?', [
      { id: 'nyc', label: 'New York', hint: 'the avenues, the steam' },
      { id: 'tokyo', label: 'Tokyo', hint: 'the crossings, the neon' },
    ]);
    log('ask →', id);
    await ui.say('That’s right.', { hold: false });
    const year = await ui.ask('And what year was it?', [
      { id: '1900', label: '1900' },
      { id: '2000', label: '2000' },
      { id: '2100', label: '2100' },
    ]);
    log('year →', year);
    await ui.say('Of course.', { hold: false });
    const season = await ui.ask('And the season?', [
      { id: 'spring', label: 'Spring', hint: 'first green' },
      { id: 'summer', label: 'Summer', hint: 'open windows' },
      { id: 'autumn', label: 'Autumn', hint: 'low gold light' },
      { id: 'winter', label: 'Winter', hint: 'quiet, cold' },
    ]);
    log('season →', season);
  },
  async askText() {
    const name = await ui.askText('What did they call you, back then?', { placeholder: 'a name…', maxLength: 16, fallback: 'Friend' });
    log('askText →', name);
  },
  async board() {
    const id = await ui.ask('Remind me — what were you doing that day?', ACTIVITIES, { style: 'board' });
    log('board →', id);
    ui.hideDialogue();
  },
  async board8() {
    if (mem) ui.memories(mem);
    const cards = params.has('first')
      ? board8(mem).filter((c) => c.id !== 'roam').map(({ locked, cost, afford, ...c }) => ({ ...c, badge: 'PICK ONE' }))
      : board8(mem);
    const id = await ui.ask('Remind me — what were you doing that day?', cards, { style: 'board' });
    log('board8 →', id);
    ui.hideDialogue();
    return id;
  },
  async board12() {
    if (mem) ui.memories(mem);
    const id = await ui.ask('Remind me — which road were you on?', board12(mem), { style: 'board' });
    log('board12 →', id);
    ui.hideDialogue();
    return id;
  },
  async ledger() {
    await ui.ledger({
      kicker: 'The city sleeps',
      title: 'Day 3 is over',
      rows: [
        { label: 'Fares and tips', value: '+$214.50', tone: 'good' },
        { label: 'Rent collected, four flats', value: '+$320.00', tone: 'good' },
        { label: 'Oven repairs', value: '−$45.00', tone: 'bad' },
        { label: 'Approval', value: '62% (+3)', tone: 'good' },
        { label: 'Become Mayor', progress: 0.4, value: '2 of 5 buildings' },
        { label: 'Own the city', progress: 0.1, value: '$1,240 of $12,000' },
        { label: 'In the till tonight', value: '$1,729.50', total: true },
      ],
      note: 'Rosa asked after you. The bakery smells like Tuesday.',
    });
    log('ledger resolved');
  },
  async decision() {
    const rent = params.get('kind') === 'rent';
    const id = await ui.decision(rent ? {
      kicker: 'Landlord · Day 3',
      title: 'Dmitri can’t pay',
      situation: 'Dmitri Okonkwo-Reyes is eleven days behind on the room on Mott. He says the docks cut his shifts. His rent is $42.',
      options: [
        { id: 'evict', label: 'Evict him', effects: [{ text: 'Room free to let', tone: 'good' }, { text: 'Neighbours wary', tone: 'bad' }, { text: 'Opinion −0.6', tone: 'bad' }] },
        { id: 'wait', label: 'Give him a week', effects: [{ text: 'Rent: $0 this week', tone: 'bad' }, { text: 'Opinion +0.2', tone: 'good' }] },
      ],
    } : {
      kicker: 'Mayor’s desk · Day 3',
      title: 'The bridge toll',
      situation: 'The council wants to raise the bridge toll to pay for the new library. Half the city crosses it every morning.',
      options: [
        { id: 'raise', label: 'Raise the toll', effects: [{ text: '+$2,400 a day', tone: 'good' }, { text: 'Approval −8', tone: 'bad' }] },
        { id: 'hold', label: 'Hold the line', effects: [{ text: 'Library waits a year' }, { text: 'Approval +2', tone: 'good' }] },
        { id: 'tax', label: 'Tax the big flats', effects: [{ text: 'Landlords furious', tone: 'bad' }, { text: '+$900 a day', tone: 'good' }, { text: 'Approval +1', tone: 'good' }] },
      ],
    });
    log('decision →', id);
  },
  async election() {
    const lose = params.has('lose');
    await ui.election({
      title: 'Mayor of Lower Manhattan',
      candidates: [
        { name: 'Rosa Flanagan', votes: 4120 },
        { name: 'Kid', votes: lose ? 3380 : 5230, you: true },
        { name: 'Marco Rivera', votes: lose ? 5960 : 2890 },
        { name: 'Dmitri Okonkwo-Reyes', votes: 1210 },
      ],
      total: lose ? 14670 : 13450,
      turnout: 0.63,
    });
    log('election resolved');
  },
  async shop() {
    let cashNow = Number(params.get('cash') ?? 140);
    const owned = new Set();
    const ITEMS = [
      { id: 'stone-oven', label: 'Stone oven', text: 'A wider golden zone. Forgiving on busy nights.', price: 120, glyph: 'shop' },
      { id: 'prep-cook', label: 'Prep cook', text: 'Sauce and cheese go on by themselves.', price: 90, glyph: 'foot' },
      { id: 'loyal-customers', label: 'Loyal customers', text: 'Regulars wait longer before they walk out.', price: 200, glyph: 'mayor' },
      { id: 'scooter', label: 'Delivery scooter', text: 'Faster pizza runs across town.', price: 340, glyph: 'pizza' },
    ];
    for (;;) {
      const id = await ui.shop({ title: 'Before you head out…', cash: cashNow, items: ITEMS.map((i) => ({ ...i, owned: owned.has(i.id), afford: cashNow >= i.price })) });
      log('shop →', id);
      if (!id) break;
      owned.add(id);
      cashNow -= ITEMS.find((i) => i.id === id).price;
    }
  },
  async property() {
    const kind = params.get('kind') || 'owned';
    const base = { address: '412 Mott Street', kind: 'Walk-up apartments · 4 flats', price: 184000, income: 168 };
    const tenants = [
      { name: 'Dmitri Okonkwo-Reyes', rent: 42, paying: false },
      { name: 'Keisha Johnson', rent: 48, paying: true },
      { name: 'Luis Rivera', rent: 40, paying: true },
      { name: 'Priya Park', rent: 38, paying: true },
    ];
    const data = {
      sale: { ...base, owner: '', tenants, income: null, options: [{ id: 'buy', label: 'Buy it', hint: '$184,000' }, { id: 'view', label: 'Look around' }] },
      broke: { ...base, owner: '', tenants: [], kind: 'Corner bakery', address: '90 Bleecker', price: 520000, income: 340, options: [{ id: 'buy', label: 'Buy it', hint: 'Need $482,000 more', disabled: true }, { id: 'view', label: 'Look around' }] },
      theirs: { ...base, owner: 'Rosa Flanagan', tenants, options: [{ id: 'view', label: 'Look around' }] },
      owned: { ...base, owner: 'You', tenants, options: [{ id: 'collect', label: 'Collect rent', hint: '$128 waiting' }, { id: 'view', label: 'View tenants' }, { id: 'sell', label: 'Sell', hint: '$184,000' }] },
    }[kind];
    const id = await ui.property(data);
    log('property →', id);
  },
  async kitchen() {
    const NAMES = ['Rosa Flanagan', 'Marco Rivera', 'Dmitri Okonkwo-Reyes', 'Keisha Johnson', 'Luis Rivera', 'Priya Park', 'Sal Moretti', 'Grace Chen', 'Tony Alvarez', 'Mei Tanaka', 'Eddie Brooks', 'Fatima Haddad', 'Rob Kowalski', 'Yolanda King', 'Kevin Doyle', 'Ana Silva', 'Danny Cruz', 'Jen Park', 'Mike Bell', 'Sofia Rossi'];
    const T = [[], ['pepperoni'], ['mushroom', 'olive'], ['pepperoni', 'basil'], ['olive'], ['pepperoni', 'mushroom', 'pepper'], ['basil', 'pepper'], ['mushroom']];
    const orders = NAMES.map((name, i) => ({ name, topping: T[(i * 5 + 1) % T.length] }));
    const upgrades = (params.get('ups') || '').split(',').filter(Boolean);
    const res = await ui.kitchen({ title: 'Pizza shop rush', duration: Number(params.get('dur')) || 90, orders, upgrades });
    window.__kitchen = res;
    log('kitchen →', JSON.stringify(res));
    ui.hideDialogue();
    await ui.results({ title: 'Pizza shop rush', subtitle: `${res.served} pizzas out the door.`, score: res.score, rank: res.score >= 5500 ? 'S' : res.score >= 4200 ? 'A' : res.score >= 3000 ? 'B' : 'C', lines: res.lines, actions: [{ id: 'again', label: 'Another shift' }] });
  },
  async memories() {
    ui.memories(1200);
    await wait(1600);
    ui.memories(1450, 250);
    await wait(2400);
    ui.memories(450, -1000);
    await wait(2400);
    ui.memories(null);
    await wait(700);
    ui.memories(450);
    log('memories done');
  },
  async unlock() {
    await ui.unlock({ kicker: 'YOURS TO KEEP', title: params.get('title') || 'Flight', text: 'You remember how to fly. Press 4 in the city to take off.' });
    log('unlock 1 resolved');
    await ui.unlock({ kicker: 'REMEMBERED', title: 'Skateboarding', text: 'You can play this one now. The board is waiting.' });
    log('unlock 2 resolved');
  },
  async confirm() {
    const yes = await ui.confirm('Unlock Street race for 500 memories?', 'Yes, remember it', 'Not yet');
    log('confirm →', yes);
    ui.hideDialogue();
    return yes;
  },
  async roam() {
    const n = Number(params.get('abil')) || ABILITIES.length;
    const slots = (active) => ABILITIES.slice(0, n).map((a, i) => ({ ...a, key: String(i + 1), active: i === active }));
    if (params.get('mem') !== '0') ui.memories(2450);
    ui.hud.show();
    ui.hud.set({ title: 'Just wander', objective: 'Nothing to win. Press 1–8 to swap powers', score: params.has('score') ? 1250 : null, money: '∞' });
    ui.hud.abilities(slots(0));
    ui.hud.prompt('E · TAKE THE CAB  ($∞)');
    const balance = params.get('meter') === 'balance';
    const meter = (v) => (balance ? ui.hud.meter('Balance', v, { balance: true }) : ui.hud.meter('Fare', v));
    meter(balance ? 0.58 : 0.8);
    let k = 0;
    let fare = 0.8;
    const timer = setInterval(() => {
      k += 1;
      ui.hud.abilities(slots(Math.floor(k / 6) % n));
      fare = fare <= 0.02 ? 1 : fare - 0.02;
      meter(balance ? 0.5 + Math.sin(k / 4) * 0.42 : fare);
    }, 300);
    window.__stopHud = () => clearInterval(timer);
    log('roam running');
  },
  async progress() {
    await ui.say('Every round earns memories. Look at them stack up.', { hold: false });
    ui.memories(600, 600);
    await wait(2200);
    const cards = board8(600);
    const id = await ui.ask('Pick a card. The locked ones cost memories.', cards, { style: 'board' });
    const card = cards.find((c) => c.id === id);
    if (card.locked && await ui.confirm(`Unlock ${card.label} for ${card.cost.toLocaleString('en-US')} memories?`, 'Yes, remember it', 'Not yet')) {
      ui.memories(600 - card.cost, -card.cost);
      await ui.unlock({ kicker: 'REMEMBERED', title: card.label, text: card.hint.replace(/^I was /, 'You were ').replace(/\.$/, ' — and you can do it again.') });
    }
    ui.hideDialogue();
    await ui.unlock({ kicker: 'YOURS TO KEEP', title: 'Flight', text: 'You remember how to fly. Press 4 in the city to take off.' });
    await scenes.roam();
  },
  async talk() {
    const who = params.get('who');
    const withParams = (p) => ({
      ...p,
      ...(params.has('mood') ? { mood: params.get('mood') } : {}),
      ...(params.has('seed') ? { portraitSeed: params.get('seed') } : {}),
      ...(params.has('op') ? { opinion: params.get('op') === 'null' ? null : Number(params.get('op')) } : {}),
    });
    const visit = async (key) => {
      const p = withParams(PEOPLE[key]);
      let id = await ui.talk(p);
      log('talk →', key, id);
      if (id && id !== 'bye') {
        const [line, mood, opinion] = REPLIES[id] || ['Hm.', 'fine', p.opinion ?? 0];
        id = await ui.talk({ ...p, line, mood, opinion, options: [{ id: 'more', label: 'Say something else' }, { id: 'bye', label: 'Goodbye' }] });
        log('reply →', id);
      }
      return id;
    };
    if (who && PEOPLE[who]) {
      await visit(who);
      return;
    }
    for (const key of ['stranger', 'friend', 'broke']) {
      await visit(key);
      ui.closeTalk();
      await wait(500);
    }
    log('talk done');
  },
  async wallet() {
    ui.wallet(params.has('inf') ? '∞' : 1240);
    if (params.has('stack')) {
      ui.memories(2450);
      ui.hud.show();
      ui.hud.set({ title: 'Just wander', objective: 'Walk the town. Talk to anyone.', score: 1250, money: '∞' });
    }
    await wait(1800);
    ui.wallet(1290);
    await wait(2200);
    ui.wallet(1263.5);
    await wait(2200);
    ui.wallet('∞');
    await wait(1500);
    ui.wallet(null);
    await wait(900);
    ui.wallet(1240);
    log('wallet done');
  },
  async clock() {
    ui.hud.show();
    ui.hud.set({ title: 'Just wander', objective: 'Walk the town. Talk to anyone.', score: null, time: params.has('timer') ? 90 : null });
    let m = 18 * 60 + 40;
    ui.hud.clock(clockText(2, m));
    const timer = setInterval(() => {
      m += 5;
      ui.hud.clock(clockText(2 + Math.floor(m / 1440), m % 1440));
    }, 500);
    window.__stopHud = () => clearInterval(timer);
    log('clock running');
  },
  async town() {
    ui.memories(2450);
    ui.wallet(1240);
    ui.hud.show();
    ui.hud.set({ title: 'Just wander', objective: 'Walk the town. Talk to anyone.', score: null, time: null });
    ui.hud.clock(clockText(2, 18 * 60 + 40));
    ui.hud.abilities(ABILITIES.map((a, i) => ({ ...a, key: String(i + 1), active: i === 0 })));
    await wait(1200);
    ui.hud.prompt('E · TALK TO MARCO');
    await wait(900);
    ui.hud.prompt(null);
    const id = await ui.talk(PEOPLE.friend);
    log('town talk →', id);
    if (id === 'usual') ui.wallet(1240 - 3.5);
  },
  async hud() {
    ui.hud.show();
    ui.hud.set({ title: 'Pizza delivery', objective: 'Deliver 5 pizzas before the timer runs out', time: 90, score: 0 });
    for (const c of ['3', '2', '1', 'GO!']) await ui.hud.callout(c);
    let time = 90;
    let score = 0;
    ui.hud.toast('WASD move · SHIFT sprint · SPACE jump · mouse looks');
    await wait(400);
    ui.hud.toast('Delivered — nice one', 'good');
    await wait(500);
    ui.hud.toast('Cold pizza. Hurry up', 'info');
    await wait(500);
    ui.hud.toast('Crashed into a hydrant', 'bad');
    const timer = setInterval(() => {
      time -= 1;
      ui.hud.set({ time });
      if (time % 3 === 0) ui.hud.set({ score: (score += 150) });
      if (time <= 0) clearInterval(timer);
    }, 1000);
    window.__stopHud = () => clearInterval(timer);
    await wait(1200);
    ui.hud.set({ time: 14, score: 1250, objective: 'Two pizzas to go' });
  },
  async results() {
    const id = await ui.results({
      title: 'Pizza run',
      subtitle: 'Not bad, Kid.',
      score: 4820,
      rank: 'S',
      lines: [
        { label: 'Pizzas delivered', value: '7 / 8' },
        { label: 'Fastest run', value: '0:41' },
        { label: 'Tips', value: '$36' },
        { label: 'Remembered', value: 'New York City, 2000' },
      ],
      actions: [
        { id: 'again', label: 'Play it again' },
        { id: 'other', label: 'Something else that day' },
        { id: 'new', label: 'Remember a different day' },
      ],
    });
    log('results →', id);
  },
  async full() {
    ui.worldNote('the streets are coming back…');
    await scenes.say();
    ui.worldNote('colour is coming back…');
    await scenes.ask();
    await ui.say('Ah — so the weather must have been…', { hold: false });
    const weather = await ui.ask('Was it clear, or was it raining?', [
      { id: 'clear', label: 'Clear' },
      { id: 'rain', label: 'Rain' },
      { id: 'fog', label: 'Fog' },
      { id: 'snow', label: 'Snow' },
    ]);
    log('weather →', weather);
    await scenes.askText();
    ui.worldNote('');
    await scenes.board();
    await ui.fade(1, 500);
    await ui.fade(0, 500);
    await scenes.hud();
    await wait(4000);
    window.__stopHud?.();
    ui.hud.hide();
    await scenes.results();
    ui.worldNote('');
    await ui.fade(1, 600);
  },
};

const scene = new URLSearchParams(location.search).get('scene') || 'full';
Promise.resolve(scenes[scene]?.()).catch((e) => console.error(e));
