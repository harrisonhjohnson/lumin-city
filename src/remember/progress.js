// What the player has earned across days: memories (the currency), which games are
// remembered (playable), best rank per game, and the powers kept for free roam. Pure
// reducers over a plain object; main.js persists it.

export const UNLOCK_COST = 1000;
export const KEEP_RANK = 'B';
const RANKS = ['D', 'C', 'B', 'A', 'S'];
export const MEMORIES_FOR = { S: 1500, A: 1000, B: 700, C: 400, D: 150 };

// The power each game leaves you with in free roam, if you score KEEP_RANK or better.
//   mover  the rig.js mover it switches you to; ride is what main.js draws
export const PERKS = {
  skate:  { id: 'board',   label: 'Skateboard',     glyph: 'skate',  mover: 'board',   ride: 'board',   text: 'Your board is under your arm. Press its key in the city to ride.' },
  race:   { id: 'car',     label: 'Race car',       glyph: 'race',   mover: 'car',     ride: 'car',     text: 'The race car is parked outside. Press its key in the city to drive.' },
  heist:  { id: 'money',   label: 'Infinite money', glyph: 'heist',  mover: null,      ride: null,      text: 'Nobody ever found the jewel. Walk up to any car in the city and press E to buy it.' },
  aliens: { id: 'flight',  label: 'Flight',         glyph: 'aliens', mover: 'flight',  ride: 'hero',    text: 'You remember how to fly. Press its key in the city to take off.' },
  patrol: { id: 'swing',   label: 'Web swing',      glyph: 'patrol', mover: 'swing',   ride: 'hero',    text: 'The webs still come when you call them. Press its key in the city to swing.' },
  pizza:  { id: 'scooter', label: 'Scooter',        glyph: 'pizza',  mover: 'scooter', ride: 'scooter', text: 'You kept the scooter. Press its key in the city to ride.' },
  taxi:   { id: 'cab',     label: 'Cab',            glyph: 'taxi',   mover: 'car',     ride: 'cab',     text: 'The cab is yours now. Press its key in the city to drive.' },
};

export function fresh() { return { memories: 0, unlocked: [], best: {}, kept: [], cash: 0 }; }

export function load(raw) {
  try {
    const p = { ...fresh(), ...JSON.parse(raw || '{}') };
    return { cash: Math.max(0, Number(p.cash) || 0), memories: Math.max(0, Number(p.memories) || 0), unlocked: [...new Set(p.unlocked)].filter((g) => PERKS[g]), best: { ...p.best }, kept: [...new Set(p.kept)].filter((g) => PERKS[g]) };
  } catch { return fresh(); }
}

// The first game is free; every later one costs UNLOCK_COST.
export function isOpen(p, game) { return game === 'roam' ? p.unlocked.length > 0 : p.unlocked.includes(game); }
export function costOf(p, game) { return p.unlocked.length === 0 ? 0 : UNLOCK_COST; }
export function canUnlock(p, game) { return !isOpen(p, game) && game !== 'roam' && p.memories >= costOf(p, game); }

export function unlock(p, game) {
  if (isOpen(p, game) || !canUnlock(p, game)) return p;
  return { ...p, memories: p.memories - costOf(p, game), unlocked: [...p.unlocked, game] };
}

const atLeast = (rank, floor) => RANKS.indexOf(rank) >= RANKS.indexOf(floor);

// A finished round: memories for the rank, a new best, and the perk if it was kept just now.
export function finish(p, game, rank) {
  const earned = MEMORIES_FOR[rank] ?? 0;
  const best = !p.best[game] || atLeast(rank, p.best[game]) ? rank : p.best[game];
  const keeps = atLeast(rank, KEEP_RANK) && !p.kept.includes(game);
  return { next: { ...p, memories: p.memories + earned, best: { ...p.best, [game]: best }, kept: keeps ? [...p.kept, game] : p.kept }, earned, kept: keeps ? PERKS[game] : null };
}

// Memories found lying around in free roam.
export function found(p, amount) { return { ...p, memories: p.memories + amount }; }

// The player's own money, earned from fares, tips and rewards in the town. The jewel (the
// heist's kept power) makes it bottomless.
export function rich(p) { return p.kept.includes('heist'); }
export function earn(p, amount) { return { ...p, cash: Math.max(0, Math.round((p.cash + amount) * 100) / 100) }; }
