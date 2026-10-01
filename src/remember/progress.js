// What the player has earned across days: memories (the currency), the path of games
// (which are open, which forks were taken), best ranks and attempts, the powers kept for
// free roam, cash and the upgrades it bought, and the life goal. Pure reducers over a plain
// object; main.js persists it.

const RANKS = ['D', 'C', 'B', 'A', 'S'];
export const atLeast = (rank, floor) => !!rank && RANKS.indexOf(rank) >= RANKS.indexOf(floor);
export const KEEP_RANK = 'B';
export const MEMORIES_FOR = { S: 1500, A: 1000, B: 700, C: 400, D: 150 };
export const CASH_FOR = { S: 120, A: 80, B: 50, C: 30, D: 15 };   // 2000 dollars; main.js scales by era

// The path. Three ways in; each leads somewhere once you're good enough at it. A fork is an
// either/or: the side you choose costs FORK_COST, the road not taken costs ROAD_NOT_TAKEN.
//   requires  { game: rank } needed before the node can be bought
//   cost      memories to open it once required ranks are met
export const UNLOCK_COST = 1000, FORK_COST = 1000, ROAD_NOT_TAKEN = 3000;
export const PATH = {
  skate:  { tier: 0, start: true, leadsTo: ['race'] },
  pizza:  { tier: 0, start: true, leadsTo: ['shop', 'taxi'] },
  patrol: { tier: 0, start: true, leadsTo: ['heist', 'aliens'] },
  race:   { tier: 1, requires: { skate: 'B' }, cost: UNLOCK_COST },
  shop:   { tier: 1, requires: { pizza: 'A' }, fork: 'pizza' },
  taxi:   { tier: 1, requires: { pizza: 'A' }, fork: 'pizza' },
  heist:  { tier: 1, requires: { patrol: 'B' }, fork: 'patrol' },
  aliens: { tier: 1, requires: { patrol: 'B' }, fork: 'patrol' },
  kaiju:  { tier: 2, requires: { aliens: 'A' }, cost: 1500 },
};
export const FORKS = {
  pizza:  { title: 'WORK THE SHOP OR DRIVE A CAB', question: 'The pizzeria offered you a place behind the counter. Or you could take the cab your uncle keeps offering. Which was it?', options: ['shop', 'taxi'] },
  patrol: { title: 'VILLAIN OR HERO', question: 'Fighting crime on the street, you saw both sides of this city. Did you go after the jewel in the museum, or did you stay and protect the city from what was coming?', options: ['heist', 'aliens'] },
};
export const GAMES = Object.keys(PATH);

// The power each game leaves you with in free roam at KEEP_RANK or better. Aliens at an A
// also gives laser vision and ice breath (POWERS).
export const PERKS = {
  skate:  { id: 'board',   label: 'Skateboard',     glyph: 'skate',  mover: 'board',   ride: 'board',   text: 'Your board is under your arm. Press its key in the city to ride.' },
  race:   { id: 'car',     label: 'Race car',       glyph: 'race',   mover: 'car',     ride: 'car',     text: 'The race car is parked outside. Press its key in the city to drive.' },
  heist:  { id: 'money',   label: 'Infinite money', glyph: 'heist',  mover: null,      ride: null,      text: 'Nobody ever found the jewel. Your money never runs out now.' },
  aliens: { id: 'flight',  label: 'Flight',         glyph: 'aliens', mover: 'flight',  ride: 'hero',    text: 'You remember how to fly. Press its key in the city to take off.' },
  patrol: { id: 'swing',   label: 'Web swing',      glyph: 'patrol', mover: 'swing',   ride: 'hero',    text: 'The webs still come when you call them. Press its key in the city to swing.' },
  pizza:  { id: 'scooter', label: 'Scooter',        glyph: 'pizza',  mover: 'scooter', ride: 'scooter', text: 'You kept the scooter. Press its key in the city to ride.' },
  taxi:   { id: 'cab',     label: 'Cab',            glyph: 'taxi',   mover: 'car',     ride: 'cab',     text: 'The cab is yours now. Press its key in the city to drive.' },
  shop:   { id: 'deed',    label: 'A share of the pizzeria', glyph: 'shop', mover: null, ride: null,    text: 'The owner made you a partner. You own your first building — and you can buy more in the city.' },
};
export const POWERS = { label: 'Laser vision and ice breath', text: 'Your eyes burn, your breath freezes. And something enormous is coming for the city.' };

// Upgrades bought with cash before a round: each makes an A a little more reachable.
// Prices are 2000 dollars; main.js scales by era.
export const UPGRADES = {
  skate:  [['grip-tape', 'Grip tape', 'Grinds wobble half as much.', 40], ['big-pop', 'Big pop', 'Ollies go a third higher.', 60], ['magnet', 'Memory magnet', 'Pick up memories from further away.', 90]],
  pizza:  [['thermal-bag', 'Thermal bag', 'Pizzas stay hot (and tips stay high) longer.', 40], ['nitrous', 'Nitrous', 'Hold Shift for a burst of speed.', 70], ['hop', 'Spring suspension', 'Space to jump the scooter over traffic.', 90]],
  patrol: [['police-radio', 'Police radio', 'Twelve more seconds for every crime.', 40], ['sneakers', 'Running shoes', 'Crooks can\'t outrun you as easily.', 70]],
  race:   [['sticky-tyres', 'Sticky tyres', 'More grip, sharper turns.', 60], ['big-tank', 'Bigger tank', 'Start with full nitro; drifting fills it twice as fast.', 90]],
  taxi:   [['charm', 'Charm school', 'Fares tip half again as much.', 50], ['turbo', 'Turbo', 'Boost fills twice as fast.', 80], ['quick-stop', 'Quick stop', 'Fares hop in and out without a full stop.', 60]],
  shop:   [['prep-cook', 'Prep cook', 'Sauce and cheese go on by themselves.', 50], ['stone-oven', 'Stone oven', 'A wider golden zone.', 70], ['loyal-customers', 'Loyal customers', 'People wait longer before they give up.', 60]],
  heist:  [['soft-shoes', 'Soft shoes', 'Searchlights and torches see a little less.', 50], ['smoke-bomb', 'Smoke bombs', 'Q: four seconds unseen (two of them).', 80], ['taser', 'Taser', 'E: drop a guard for eight seconds (three charges).', 110]],
  aliens: [['jet-boots', 'Jet boots', 'Faster boost.', 60], ['big-fists', 'Bigger fists', 'Hit saucers from further away.', 80], ['jammer', 'Beam jammer', 'Tractor beams lift half as fast.', 100]],
  kaiju:  [['armor', 'Hero armour', 'Take a third less damage.', 120], ['coolant', 'Coolant', 'Your laser overheats half as fast.', 120]],
};
export const upgradesFor = (game) => (UPGRADES[game] || []).map(([id, label, text, price]) => ({ id, label, text, price }));

// Practice: every attempt makes the next a little easier (up to +28% score by attempt 9).
export const practiceBonus = (attempts) => 1 + 0.035 * Math.min(Math.max(0, attempts), 8);

export function fresh() { return { memories: 0, cash: 0, unlocked: [], best: {}, attempts: {}, kept: [], powers: [], forks: {}, upgrades: [], goal: null, achieved: [] }; }

export function load(raw) {
  try {
    const p = { ...fresh(), ...JSON.parse(raw || '{}') };
    const games = (list) => [...new Set(list || [])].filter((g) => PATH[g]);
    return {
      memories: Math.max(0, Number(p.memories) || 0), cash: Math.max(0, Number(p.cash) || 0),
      unlocked: games(p.unlocked), best: { ...p.best }, attempts: { ...p.attempts },
      kept: [...new Set(p.kept || [])].filter((g) => PERKS[g]), powers: [...new Set(p.powers || [])],
      forks: { ...p.forks }, upgrades: [...new Set(p.upgrades || [])], goal: ['mayor', 'owner', 'hero'].includes(p.goal) ? p.goal : null, achieved: [...new Set(p.achieved || [])],
    };
  } catch { return fresh(); }
}

// ---- the path -------------------------------------------------------------------------

export function isOpen(p, game) { return game === 'roam' ? p.unlocked.length > 0 : p.unlocked.includes(game); }
export function requirementMet(p, game) { return Object.entries(PATH[game]?.requires || {}).every(([g, r]) => atLeast(p.best[g], r)); }
export function requirementText(game, names) { return Object.entries(PATH[game]?.requires || {}).map(([g, r]) => `Get ${r === 'A' ? 'an' : 'a'} ${r} in ${names[g] || g}`).join(' and '); }

export function costOf(p, game) {
  const node = PATH[game];
  if (!node) return Infinity;
  if (node.start) return p.unlocked.length === 0 ? 0 : UNLOCK_COST;
  if (node.fork) { const chosen = p.forks[node.fork]; return !chosen || chosen === game ? FORK_COST : ROAD_NOT_TAKEN; }
  return node.cost ?? UNLOCK_COST;
}

// How a game shows on the board: open, done (open + kept), buy (ready to unlock), locked
// (requirement not met), forked (the other side of a fork you already chose).
export function stateOf(p, game) {
  if (isOpen(p, game)) return p.kept.includes(game) ? 'done' : 'open';
  const node = PATH[game];
  if (node.start) return 'buy';
  if (!requirementMet(p, game)) return 'locked';
  if (node.fork && p.forks[node.fork] && p.forks[node.fork] !== game) return 'forked';
  return 'buy';
}
export function canUnlock(p, game) { const s = stateOf(p, game); return (s === 'buy' || s === 'forked') && p.memories >= costOf(p, game); }

export function unlock(p, game) {
  if (!canUnlock(p, game)) return p;
  const node = PATH[game];
  const forks = node.fork && !p.forks[node.fork] ? { ...p.forks, [node.fork]: game } : p.forks;
  return { ...p, memories: p.memories - costOf(p, game), unlocked: [...p.unlocked, game], forks };
}

// Choosing a side of a fork (the narrator asks once the requirement is met). It doesn't open
// the game by itself — it sets which side is cheap.
export function choose(p, fork, game) { return p.forks[fork] ? p : { ...p, forks: { ...p.forks, [fork]: game } }; }
export function forksReady(p) { return Object.entries(FORKS).filter(([f, def]) => !p.forks[f] && def.options.every((g) => requirementMet(p, g))).map(([f]) => f); }

// ---- rounds -------------------------------------------------------------------------------

// A finished round: memories and cash for the rank, a new best, the perk if it was kept just
// now, and laser + ice for an A against the aliens.
export function finish(p, game, rank) {
  const earned = MEMORIES_FOR[rank] ?? 0, cash = CASH_FOR[rank] ?? 0;
  const best = !p.best[game] || atLeast(rank, p.best[game]) ? rank : p.best[game];
  const keeps = PERKS[game] && atLeast(rank, KEEP_RANK) && !p.kept.includes(game);
  const powers = game === 'aliens' && atLeast(rank, 'A') && !p.powers.includes('laser') ? ['laser', 'ice'] : [];
  const achieved = game === 'kaiju' && atLeast(rank, 'A') && !p.achieved.includes('hero') ? ['hero'] : [];
  const next = {
    ...p, memories: p.memories + earned, best: { ...p.best, [game]: best }, attempts: { ...p.attempts, [game]: (p.attempts[game] || 0) + 1 },
    kept: keeps ? [...p.kept, game] : p.kept, powers: [...p.powers, ...powers], achieved: [...p.achieved, ...achieved],
  };
  return { next, earned, cash, kept: keeps ? PERKS[game] : null, powers: powers.length ? POWERS : null, hero: achieved.length > 0 };
}

export function buyUpgrade(p, game, id, price) {
  const key = `${game}:${id}`;
  if (p.upgrades.includes(key) || (!rich(p) && p.cash < price)) return p;
  return { ...p, cash: rich(p) ? p.cash : Math.round((p.cash - price) * 100) / 100, upgrades: [...p.upgrades, key] };
}
export const ownedUpgrades = (p, game) => new Set(p.upgrades.filter((k) => k.startsWith(`${game}:`)).map((k) => k.slice(game.length + 1)));

export function found(p, amount) { return { ...p, memories: p.memories + amount }; }
export function rich(p) { return p.kept.includes('heist'); }
export function earn(p, amount) { return { ...p, cash: Math.max(0, Math.round((p.cash + amount) * 100) / 100) }; }
export function setGoal(p, goal) { return { ...p, goal }; }
export function achieve(p, goal) { return p.achieved.includes(goal) ? p : { ...p, achieved: [...p.achieved, goal] }; }
