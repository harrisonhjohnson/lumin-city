// Things lying around the city for the curious: memory fragments, cash, era keepsakes worth
// collecting, and residents' lost belongings (from their quests). A fresh scatter each day;
// rooftops need flight or webs, the rest just needs looking. Pure: plain {x, y, z} spots.

const COLLECTIBLES = {
  1900: ['a brass trolley token', 'a gaslight-era postcard', 'a penny dreadful', 'a bowler hat', 'a silver pocket watch', 'a ferry ticket', 'a tin soldier', 'a cigar band'],
  2000: ['a subway token', 'a pager', 'a mixtape', 'a disposable camera', 'a phone card', 'a Yankees ticket stub', 'a Tamagotchi', 'a slice-shop menu'],
  2100: ['a memory chip', 'a paper book', 'a drone feather', 'a vintage phone', 'a ration coin', 'a seed vault key', 'a holo-sticker', 'a real orange'],
};
export const LOST = {
  1900: ['grandmother\'s locket', 'a wedding ring', 'a pocket watch', 'a letter from home', 'reading spectacles'],
  2000: ['grandmother\'s ring', 'house keys', 'a lucky lighter', 'a wallet', 'a sketchbook'],
  2100: ['an heirloom ring', 'a pet drone', 'a paper photograph', 'an old key', 'a music box'],
};
export const collectiblesFor = (era) => COLLECTIBLES[era] || COLLECTIBLES[2000];
function rngFrom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// A place nobody walks past by accident: a roof, the park, the piers, a street corner.
export function hidingSpot(rng, buildings, { near = null, radius = 160, park, island } = {}) {
  const roll = rng();
  const ok = (p) => !near || Math.hypot(p.x - near.x, p.z - near.z) < radius;
  for (let tries = 0; tries < 40; tries++) {
    let p;
    if (roll < 0.45) {
      const b = buildings[Math.floor(rng() * buildings.length)];
      if (!b || b.height < 12 || b.lot === 'bridge') continue;
      p = { x: b.minX + (b.maxX - b.minX) * (0.2 + rng() * 0.6), y: b.height + 0.7, z: b.minZ + (b.maxZ - b.minZ) * (0.2 + rng() * 0.6), where: 'on a rooftop' };
    } else if (roll < 0.65 && park) {
      p = { x: park.x + (rng() - 0.5) * (park.w - 10), y: 1.1, z: park.z + (rng() - 0.5) * (park.d - 10), where: 'in the park' };
    } else if (roll < 0.8 && island) {
      p = { x: (rng() < 0.5 ? -1 : 1) * (island.x - 3), y: 0.9, z: island.z[0] + 40 + rng() * (island.z[1] - island.z[0] - 80), where: 'down by the water' };
    } else {
      const ax = [-140, 0, 140][Math.floor(rng() * 3)], sz = 220 - 80 * Math.floor(1 + rng() * 10);
      p = { x: ax + (rng() < 0.5 ? -1 : 1) * 14, y: 0.9, z: sz + (rng() < 0.5 ? -1 : 1) * 8, where: 'on a street corner' };
    }
    if (ok(p)) return p;
  }
  return null;
}

// The day's scatter. Deterministic per town and day, so a reload finds the same things.
export function scatter(town, buildings, { park, island, count = 26 } = {}) {
  const rng = rngFrom(town.day * 7919 + town.residents.length * 31 + (town.era.length << 3));
  const keep = collectiblesFor(town.era), items = [];
  for (let i = 0; i < count; i++) {
    const spot = hidingSpot(rng, buildings, { park, island });
    if (!spot) continue;
    const r = rng();
    const kind = r < 0.35 ? 'memory' : r < 0.6 ? 'cash' : 'keepsake';
    items.push({ id: `d${town.day}-${i}`, kind, ...spot, label: kind === 'keepsake' ? keep[Math.floor(rng() * keep.length)] : kind === 'cash' ? 'some cash' : 'a memory', amount: kind === 'cash' ? Math.round((5 + rng() * 25) * town.scale * 100) / 100 : kind === 'memory' ? 40 + Math.floor(rng() * 60) : 0 });
  }
  return items;
}

// What's lying out right now: today's scatter plus any lost belongings from quests, minus
// what's been picked up.
export function lootToday(town, buildings, opts) {
  const L = (town.loot ||= { day: -1, items: [], found: [] });
  if (L.day !== town.day) { L.day = town.day; L.items = scatter(town, buildings, opts); L.found = L.found.filter((id) => !id.startsWith('d')); }
  const lost = (town.quests || []).filter((q) => q.type === 'lost' && q.state === 'active' && !q.data.found).map((q) => ({ id: `q-${q.id}`, kind: 'lost', quest: q.id, label: q.data.item, x: q.data.x, y: q.data.y, z: q.data.z, where: q.data.where }));
  return [...L.items, ...lost].filter((it) => !L.found.includes(it.id));
}

export function pickUp(town, item) {
  town.loot.found.push(item.id);
  if (item.kind === 'keepsake') (town.collection ||= {})[item.label] = true;
  if (item.kind === 'lost') { const q = town.quests.find((x) => x.id === item.quest); if (q) q.data.found = true; }
}
