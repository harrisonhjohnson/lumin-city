// How the city comes to know you without you buying anyone a coffee: people love things, and
// doing those things well — in public — gets their fans talking. Plus the steady ways a name is
// made: the pizzeria you cook at or own, and being a decent landlord. Pure: works on a town.

function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const clamp = (v) => Math.max(-1, Math.min(1, v));

// What people care about, and which activities speak to it.
export const INTERESTS = {
  pizza:   { label: 'pizza', games: ['pizza', 'shop'] },
  skating: { label: 'skateboarding', games: ['skate'] },
  racing:  { label: 'racing', games: ['race'] },
  cabs:    { label: 'getting around', games: ['taxi'] },
  safety:  { label: 'a safe street', games: ['patrol'] },
  sky:     { label: 'the sky — heroes, saucers, all of it', games: ['aliens', 'kaiju'] },
  money:   { label: 'money', games: ['heist'] },
  park:    { label: 'the park', games: [] },
  music:   { label: 'music', games: [] },
  art:     { label: 'art', games: [] },
};
const KEYS = Object.keys(INTERESTS);

// One or two loves each, from who they are: the young-at-heart like skating, cabbies like cabs…
export function likesOf(r) {
  if (r.likes) return r.likes;
  const h = hash(r.id + 'likes'), a = KEYS[h % KEYS.length], b = KEYS[(h >> 8) % KEYS.length];
  const job = /cab/i.test(r.job) ? 'cabs' : /Cop|Police|Peacekeeper/.test(r.job) ? 'safety' : /Artist/.test(r.job) ? 'art' : /Banker|broker/.test(r.job) ? 'money' : null;
  r.likes = [...new Set([job || a, ...(h % 3 ? [b] : [])])];
  return r.likes;
}
export const loves = (r, key) => likesOf(r).includes(key);

// A round finished in public: its fans hear about it, and a great one gets everyone talking a
// little. Returns how many people it reached (for the toast).
const SPLASH = { S: 0.032, A: 0.024, B: 0.016, C: 0.008, D: 0 };
export function fame(town, game, rank) {
  // The same trick twice in a day is less of a story.
  const today = (town.fameToday ||= {});
  if (today.day !== town.day) { for (const k of Object.keys(today)) delete today[k]; today.day = town.day; }
  const lift = (SPLASH[rank] || 0) / (1 + (today[game] = (today[game] || 0) + 1) - 1);
  if (!lift) return 0;
  const keys = KEYS.filter((k) => INTERESTS[k].games.includes(game));
  let reached = 0;
  for (const r of town.residents) {
    const fan = keys.some((k) => loves(r, k));
    const d = fan ? lift : rank === 'S' || rank === 'A' ? lift / 8 : 0;
    if (d) { r.opinion = clamp(r.opinion + d); if (fan) reached++; }
  }
  return reached;
}

// The pizza you cooked: everyone you served thinks better of you, pizza people most.
export function served(town, ids) {
  for (const id of ids) { const r = town.person(id); if (r) { r.opinion = clamp(r.opinion + (loves(r, 'pizza') ? 0.1 : 0.05)); r.met = true; r.seen = town.day; } }
}

// Every night: people who ate at a place you own warm to you; your tenants warm to a decent
// landlord (more if you cut their rent or forgave a month) and cool if you've been evicting.
export function nightly(town) {
  const yesterday = town.day - 1, mine = new Set(Object.entries(town.owners).filter(([, o]) => o === 'player').map(([id]) => id));
  const shopNames = [...mine].map((id) => town.shopName(id)).filter(Boolean);
  const evicting = (town.civic?.evictions || 0) > (town.civic?.evictionsSeen || 0);
  for (const r of town.residents) {
    if (shopNames.length && r.log.some((l) => l.day === yesterday && shopNames.some((n) => l.text.endsWith(`at ${n}`)))) r.opinion = clamp(r.opinion + (loves(r, 'pizza') ? 0.06 : 0.03));
    if (r.landlord === 'player') r.opinion = clamp(r.opinion + 0.02 + (r.kindness || 0) * 0.02 - (evicting ? 0.05 : 0));
  }
  if (town.civic) town.civic.evictionsSeen = town.civic.evictions || 0;
}

// Gifts work, but the third ten-dollar bill this week is worth less than the first.
export function giftWeight(r, town) {
  const recent = (r.gifts || []).filter((d) => town.day - d < 7).length;
  (r.gifts ||= []).push(town.day);
  if (r.gifts.length > 12) r.gifts.splice(0, r.gifts.length - 12);
  return 1 / (1 + recent * 0.8);
}
