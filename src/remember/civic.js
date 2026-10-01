// The city's business: who owns which building, tenants who can't pay, taxes and the treasury,
// the mayor and the hard call they make every day, and elections every ELECTION_EVERY days
// where every resident votes. Pure: works on a town from town.js; main.js shows the cards.

export const ELECTION_EVERY = 7;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round2 = (v) => Math.round(v * 100) / 100;
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// ---- setup --------------------------------------------------------------------------------

export function initCivic(town) {
  if (!town.civic) {
    // The sitting mayor: the most respected of the wealthy, whoever that is in this town.
    const rich = [...town.residents].sort((a, b) => b.money - a.money).slice(0, 12);
    const mayor = rich[hash(town.city + town.era) % rich.length];
    town.civic = {
      mayor: mayor.id, rival: mayor.id, running: false, treasury: round2(2000 * town.scale), tax: 0.05,
      nextElection: ELECTION_EVERY, lastCheckIn: town.day, decided: -1, flags: {}, history: [], debts: {}, evictions: 0,
    };
  }
  // Saves from when elections were further apart catch up to the current cycle.
  if (town.civic.nextElection - town.day > ELECTION_EVERY) town.civic.nextElection = town.day + ELECTION_EVERY;
  if (!town._civicHooked) { town.onDay.push(daily); town._civicHooked = true; }
  return town.civic;
}

// Every midnight: taxes on the day's work go to the treasury; an empty treasury costs the
// mayor goodwill (potholes, dark streetlights).
function daily(town) {
  const c = town.civic;
  let taxes = 0;
  for (const r of town.residents) {
    const due = round2(r.wage * c.tax);
    if (due > 0 && r.money > due) { r.money = round2(r.money - due); taxes += due; }
  }
  c.treasury = round2(c.treasury + taxes);
  // Shops you own pay you a fifth of the day's takings.
  for (const s of town.shops) {
    if (town.ownerOf(s.id) !== 'player') continue;
    const share = round2((town.stockOf(s.id)?.till || 0) * 0.2);
    if (share > 0) town.ledger.rent = round2((town.ledger.rent || 0) + share);
  }
  town.ledger.taxes = round2((town.ledger.taxes || 0) + taxes);
  if (c.treasury < 0) for (const r of town.residents) if (c.mayor === 'player') r.opinion = clamp(r.opinion - 0.02, -1, 1);
  // Upkeep: the city spends a little every day.
  c.treasury = round2(c.treasury - 120 * town.scale);
}

// ---- property -----------------------------------------------------------------------------

// What a building costs: about forty days of the rent it brings in, with a floor for a shop or
// an empty walk-up. Owners who like you sell a little cheaper.
export function priceOf(town, placeId) {
  const p = town.place(placeId);
  if (!p || p.kind === 'park' || p.kind === 'office') return null;
  const rent = town.tenantsOf(placeId).reduce((n, r) => n + r.rent, 0);
  const base = Math.max(rent * 40, (p.kind === 'shop' ? 900 : 600) * town.scale);
  const owner = town.person(town.ownerOf(placeId));
  return round2(base * (1 - Math.max(0, owner?.opinion || 0) * 0.2));
}
export function incomeOf(town, placeId) { return round2(town.tenantsOf(placeId).reduce((n, r) => n + (r.landlord ? r.rent : 0), 0)); }

// Buy a building: the seller is paid, the tenants now pay you. Returns the price, or null.
export function buy(town, placeId, cash) {
  const price = priceOf(town, placeId), owner = town.ownerOf(placeId);
  if (price === null || owner === 'player' || cash < price) return null;
  const seller = town.person(owner);
  if (seller) { town.pay(seller, price, `Sold ${town.shopName(placeId) || 'a building'} to the newcomer`); seller.opinion = clamp(seller.opinion + 0.1, -1, 1); }
  town.owners[placeId] = 'player';
  for (const r of town.tenantsOf(placeId)) {
    if (r.id === owner) { r.landlord = 'player'; r.rent = round2(r.wage * 0.3 + 4 * town.scale); }   // an owner-occupier now rents from you
    else if (r.landlord) r.landlord = 'player';
    town.note(r, 'Got a new landlord');
  }
  return price;
}
export function owned(town) { return Object.entries(town.owners).filter(([, o]) => o === 'player').map(([id]) => id); }

// A tenant who couldn't pay: forgive it, give them a week, or evict. Friends hear about it.
export function tenantChoice(town, residentId) {
  const r = town.person(residentId), owed = r.rent + (town.civic.debts[r.id] || 0);
  const friends = r.friends.map((f) => town.person(f)?.first).filter(Boolean).slice(0, 2).join(' and ');
  return {
    kicker: 'RENT DAY', title: `${r.name} can't pay`,
    situation: `${r.first} owes you $${owed.toFixed(2)} and has $${r.money.toFixed(2)} to their name. ${r.job}${r.needs.hunger > 0.7 ? ', and hungry' : ''}. ${friends ? `Friends with ${friends}.` : ''}`,
    options: [
      { id: 'forgive', label: 'Let it go this month', effects: [{ text: `−$${owed.toFixed(2)}`, tone: 'bad' }, { text: `${r.first} won't forget it`, tone: 'good' }, { text: 'Their friends think better of you', tone: 'good' }] },
      { id: 'wait', label: 'Give them a week', effects: [{ text: 'They owe you double next week', tone: '' }, { text: `${r.first} is grateful`, tone: 'good' }] },
      { id: 'evict', label: 'Evict them', effects: [{ text: 'A flat for a tenant who pays', tone: 'good' }, { text: `${r.first} hates you`, tone: 'bad' }, { text: 'Word gets around', tone: 'bad' }] },
    ],
  };
}
export function resolveTenant(town, residentId, choice) {
  const r = town.person(residentId), c = town.civic, owed = r.rent + (c.debts[r.id] || 0);
  const ripple = (d) => { for (const f of r.friends) { const p = town.person(f); if (p) p.opinion = clamp(p.opinion + d, -1, 1); } };
  if (choice === 'forgive') { delete c.debts[r.id]; r.opinion = clamp(r.opinion + 0.4, -1, 1); ripple(0.1); town.note(r, 'My landlord let my rent go'); return 0; }
  if (choice === 'wait') { c.debts[r.id] = owed; r.opinion = clamp(r.opinion + 0.15, -1, 1); town.note(r, 'Got a week to find the rent'); return 0; }
  if (choice !== 'evict') return 0;
  // Evicted: they move into a building someone else owns and remember it.
  const elsewhere = town.places.filter((p) => p.kind === 'home' && town.ownerOf(p.id) !== 'player');
  const home = elsewhere[hash(r.id + town.day) % elsewhere.length];
  r.home = home.id; r.landlord = town.ownerOf(home.id) === r.id ? null : town.ownerOf(home.id);
  delete c.debts[r.id]; c.evictions++;
  r.opinion = -0.8; ripple(-0.25);
  for (const p of town.residents) if (p !== r) p.opinion = clamp(p.opinion - 0.02, -1, 1);
  town.note(r, 'Got evicted');
  return 0;
}
// A tenant on a week's grace pays it all back if they can, or comes up again.
export function collectDebts(town) {
  const c = town.civic, collected = [];
  for (const [id, owed] of Object.entries(c.debts)) {
    const r = town.person(id);
    if (r && r.money >= owed) { r.money = round2(r.money - owed); delete c.debts[id]; collected.push([r, owed]); }
  }
  return collected;
}

// ---- the mayor ----------------------------------------------------------------------------

export const approval = (town) => town.residents.reduce((n, r) => n + r.opinion, 0) / town.residents.length;
const groups = {
  all: () => true,
  poor: (r, t) => r.money < r.wage * 3 + 20 * t.scale,
  rich: (r) => r.money > r.wage * 12,
  parkgoers: (r) => r.traits.sociable > 0.55 || r.log.some((l) => /park/i.test(l.text)),
  shopkeepers: (r) => !!r.shop,
  renters: (r) => !!r.landlord,
  workers: (r) => r.jobKind === 'office' || r.jobKind === 'street',
};

// The daily hard call. Effects: opinion change per group, treasury change, a tax change, and
// city flags (the park paved, a new tower) the world can show.
export const DECISIONS = [
  { id: 'park', title: 'Pave the park?', situation: 'A developer wants the park for a tower. The city would take a fortune in fees.',
    options: [
      { id: 'pave', label: 'Sell the park', apply: { treasury: 6000, groups: { parkgoers: -0.35, rich: 0.15, all: -0.05 }, flag: 'parkGone' }, effects: [{ text: '+ a fortune for the city', tone: 'good' }, { text: 'Park lovers furious', tone: 'bad' }] },
      { id: 'keep', label: 'Keep the park', apply: { groups: { parkgoers: 0.15, rich: -0.1 } }, effects: [{ text: 'Park lovers grateful', tone: 'good' }, { text: 'Developers sulk', tone: 'bad' }] },
    ], once: 'parkGone' },
  { id: 'tower', title: 'A new tower downtown?', situation: 'Plans for the tallest building in the city. Jobs, shade, traffic.',
    options: [
      { id: 'build', label: 'Approve it', apply: { treasury: -1500, groups: { workers: 0.15, renters: -0.1 }, flag: 'tower' }, effects: [{ text: 'Workers cheer', tone: 'good' }, { text: 'Rents creep up', tone: 'bad' }, { text: '− city money', tone: 'bad' }] },
      { id: 'block', label: 'Block it', apply: { groups: { renters: 0.1, workers: -0.1 } }, effects: [{ text: 'Neighbours relieved', tone: 'good' }, { text: 'Fewer jobs', tone: 'bad' }] },
    ] },
  { id: 'taxes', title: 'Raise taxes?', situation: 'The treasury is thin. Raising taxes fills it; nobody likes paying.',
    options: [
      { id: 'raise', label: 'Raise them', apply: { tax: 0.03, groups: { all: -0.08, poor: -0.08 } }, effects: [{ text: 'More money every day', tone: 'good' }, { text: 'Everyone grumbles', tone: 'bad' }] },
      { id: 'cut', label: 'Cut them', apply: { tax: -0.02, groups: { all: 0.08, rich: 0.05 } }, effects: [{ text: 'Popular', tone: 'good' }, { text: 'Less money every day', tone: 'bad' }] },
      { id: 'hold', label: 'Leave them', apply: {}, effects: [{ text: 'Nothing changes', tone: '' }] },
    ] },
  { id: 'lunch', title: 'Free lunch for the poor?', situation: 'A soup kitchen downtown, paid for by the city.',
    options: [
      { id: 'fund', label: 'Fund it', apply: { treasury: -1200, groups: { poor: 0.25, rich: -0.05 }, feed: true }, effects: [{ text: 'The poor eat', tone: 'good' }, { text: '− city money', tone: 'bad' }] },
      { id: 'no', label: 'Can\'t afford it', apply: { groups: { poor: -0.15 } }, effects: [{ text: 'Money kept', tone: 'good' }, { text: 'The poor remember', tone: 'bad' }] },
    ] },
  { id: 'rent', title: 'Cap the rent?', situation: 'Tenants want rent capped. Landlords — including you, maybe — do not.',
    options: [
      { id: 'cap', label: 'Cap it', apply: { groups: { renters: 0.25, rich: -0.25 }, rentCap: true }, effects: [{ text: 'Renters love you', tone: 'good' }, { text: 'Landlords (and your rent) suffer', tone: 'bad' }] },
      { id: 'free', label: 'Let the market decide', apply: { groups: { rich: 0.15, renters: -0.15 } }, effects: [{ text: 'Landlords happy', tone: 'good' }, { text: 'Renters angry', tone: 'bad' }] },
    ] },
  { id: 'shops', title: 'Close Main Street to cars?', situation: 'A car-free street: good for shops, terrible for cabbies.',
    options: [
      { id: 'close', label: 'Close it', apply: { groups: { shopkeepers: 0.25, workers: -0.1 } }, effects: [{ text: 'Shops boom', tone: 'good' }, { text: 'Drivers furious', tone: 'bad' }] },
      { id: 'open', label: 'Keep cars', apply: { groups: { shopkeepers: -0.1, workers: 0.05 } }, effects: [{ text: 'Traffic flows', tone: 'good' }, { text: 'Shops struggle', tone: 'bad' }] },
    ] },
];

export function decisionFor(town) {
  const pool = DECISIONS.filter((d) => !d.once || !town.civic.flags[d.once]);
  const d = pool[hash(town.day + town.city) % pool.length];
  return { kicker: `MAYOR · DAY ${town.day}`, title: d.title, situation: `${d.situation} The treasury holds $${Math.round(town.civic.treasury).toLocaleString()}.`, id: d.id, options: d.options.map(({ id, label, effects }) => ({ id, label, effects })) };
}
export function decide(town, decisionId, optionId) {
  const d = DECISIONS.find((x) => x.id === decisionId), o = d?.options.find((x) => x.id === optionId);
  if (!o) return;
  const a = o.apply, c = town.civic;
  if (a.treasury) c.treasury = round2(c.treasury + a.treasury * town.scale);
  if (a.tax) c.tax = clamp(round2(c.tax + a.tax), 0, 0.3);
  if (a.flag) c.flags[a.flag] = true;
  if (a.rentCap) for (const r of town.residents) if (r.landlord) r.rent = round2(r.rent * 0.85);
  if (a.feed) for (const r of town.residents) if (groups.poor(r, town)) r.needs.hunger = 0;
  for (const [g, delta] of Object.entries(a.groups || {})) for (const r of town.residents) if (groups[g](r, town)) r.opinion = clamp(r.opinion + delta, -1, 1);
  c.history.push({ day: town.day, decision: d.id, option: o.id });
  c.decided = town.day;
}

// ---- elections ----------------------------------------------------------------------------

export const daysToElection = (town) => town.civic.nextElection - town.day;
// Everyone votes. They vote for you if they like you more than they like the other candidate;
// a sitting mayor's record (approval) counts for or against them.
export function election(town) {
  const c = town.civic, youIn = c.mayor === 'player';
  const other = town.person(c.rival) || town.residents[0];
  const record = youIn ? approval(town) : 0;
  let you = 0, them = 0, stay = 0;
  for (const r of town.residents) {
    const noise = ((hash(r.id + town.day) % 1000) / 1000 - 0.5) * 0.3;
    const forYou = r.opinion + (youIn ? record * 0.5 : 0) + noise;
    const forThem = (r.id === other.id ? 1 : 0.12 + (other.friends.includes(r.id) ? 0.4 : 0) + (youIn ? 0 : 0.05)) - (r.traits.sociable < 0.2 ? 0.2 : 0);
    if (r.needs.energy < 0.1 && r.traits.diligent < 0.3) { stay++; continue; }
    if (forYou > forThem) you++; else them++;
  }
  const won = you > them;
  c.nextElection = town.day + ELECTION_EVERY;
  c.running = false;
  const result = { candidates: [{ name: 'You', votes: you, you: true }, { name: other.name, votes: them, you: false }], total: you + them, turnout: (you + them) / town.residents.length, won };
  if (won) {
    c.mayor = 'player';
    // In everyone's good graces — for now.
    for (const r of town.residents) r.opinion = clamp(r.opinion + 0.2, -1, 1);
  } else if (youIn) { c.mayor = other.id; }
  c.history.push({ day: town.day, election: { you, them, won } });
  return result;
}

// ---- goals --------------------------------------------------------------------------------

export const OWN_SHARE = 0.4;   // "own the city": 40% of the homes
export function goalProgress(town, progress) {
  const homes = town.places.filter((p) => p.kind === 'home').length;
  const mine = owned(town).filter((id) => town.place(id)?.kind === 'home').length;
  return {
    mayor: town.civic.mayor === 'player' ? 1 : clamp((approval(town) + 0.2) / 0.8, 0, 0.95),
    owner: clamp(mine / (homes * OWN_SHARE), 0, 1),
    hero: progress.achieved.includes('hero') ? 1 : (progress.best.kaiju ? 0.8 : progress.powers.includes('laser') ? 0.6 : progress.best.aliens ? 0.4 : progress.best.patrol ? 0.2 : 0),
  };
}
