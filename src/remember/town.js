import { lots } from '../world/city/lots.js';
import { LANDMARKS, WORLD } from '../world/city/bible.js';
import { createRng } from '../world/city/rng.js';

// The town: a fixed roster of residents who live in the remembered city whether or not
// you're looking. Each has a name, a job, a home, money, belongings, needs, traits and an
// opinion of you, and decides what to do next from those. The sim is abstract — people are
// at a place or walking between two doors — so it runs cheaply off-screen; life.js draws the
// ones who are outdoors near you. Pure (no three.js): plain {x, z} points, tested in node.

export const TIME_SCALE = 60;                  // game seconds per real second: a day ≈ 24 real minutes
export const DAY = 24 * 3600;
// Town walking speed in game metres per game second. Slower than a real stride so commutes
// take town-minutes rather than town-seconds, which keeps people out on the street long
// enough to be seen (a 500 m walk ≈ 35 real seconds).
export const WALK = 0.25;
export const START_HOUR = { dawn: 6, noon: 12, dusk: 18, midnight: 23.5 };
const H = 3600;

// ---- places -------------------------------------------------------------------------------

// Every building gets one role. Midtown and downtown are offices; a seeded scatter of corner
// buildings are shops; the rest are homes. Doors sit on the sidewalk the building faces.
export const SHOP_KINDS = {
  bakery:    { label: { 1900: 'Bakery', 2000: 'Bakery', 2100: 'Print Bakery' }, sells: 'food', price: 4 },
  deli:      { label: { 1900: 'Grocer', 2000: 'Deli', 2100: 'Vat Deli' }, sells: 'food', price: 6 },
  diner:     { label: { 1900: 'Lunch Room', 2000: 'Diner', 2100: 'Noodle Dock' }, sells: 'meal', price: 9 },
  pizzeria:  { label: { 1900: 'Pizzeria', 2000: 'Pizzeria', 2100: 'Pizza Printer' }, sells: 'meal', price: 7 },
  bar:       { label: { 1900: 'Saloon', 2000: 'Bar', 2100: 'Lounge' }, sells: 'fun', price: 8 },
  newsstand: { label: { 1900: 'Newsstand', 2000: 'Newsstand', 2100: 'Feed Kiosk' }, sells: 'goods', price: 2 },
};
const SHOP_ORDER = Object.keys(SHOP_KINDS);

function doorOf(b) {
  const side = b.facing === 'north' ? -1 : 1;
  return { x: b.x, z: b.z + side * (b.d / 2 + 1.6) };
}

export function placesFor(seed = WORLD.seed) {
  const rng = createRng(seed + 404);
  const places = [];
  const surnames = createRng(seed + 405);
  for (const b of lots(seed)) {
    if (b.landmark || b.reserved || Math.abs(b.x) > WORLD.x[1] - 15) continue;
    let kind = 'home';
    if (b.district === 'midtown' || b.district === 'downtown') kind = 'office';
    else if (b.corner && rng() < 0.32) kind = 'shop';
    places.push({ id: b.id, kind, door: doorOf(b), district: b.district, shop: null, apartments: kind === 'home' ? Math.max(1, Math.round(b.lots * 1.5)) : 0, _r: surnames() });
  }
  places.filter((p) => p.kind === 'shop').forEach((p, i) => { p.shop = SHOP_ORDER[i % SHOP_ORDER.length]; });
  const park = LANDMARKS.find((l) => l.kind === 'void');
  places.push({ id: 'park', kind: 'park', door: { x: park.at[0], z: park.at[1] + park.size[2] / 2 - 2 }, district: 'park' });
  for (const p of places) delete p._r;
  return places;
}

// ---- people -------------------------------------------------------------------------------

const NAMES = {
  nyc: {
    1900: { first: ['Patrick', 'Bridget', 'Giuseppe', 'Rosa', 'Morris', 'Sadie', 'Otto', 'Hattie', 'Seamus', 'Ida', 'Vito', 'Esther', 'Walter', 'Mabel', 'Isidor', 'Nora', 'Clarence', 'Lena', 'Abe', 'Agnes'], last: ['Flanagan', 'Rossi', 'Goldberg', 'Schmidt', 'O\'Malley', 'Esposito', 'Katz', 'Murphy', 'Weber', 'Russo', 'Levy', 'Doyle', 'Bauer', 'Costa', 'Feldman', 'Kelly'] },
    2000: { first: ['Danny', 'Keisha', 'Marco', 'Jen', 'Luis', 'Tasha', 'Mike', 'Priya', 'Sal', 'Ana', 'Dmitri', 'Grace', 'Tony', 'Mei', 'Rob', 'Yolanda', 'Kevin', 'Fatima', 'Eddie', 'Sofia'], last: ['Rivera', 'Johnson', 'Chen', 'Russo', 'Patel', 'Williams', 'Kowalski', 'Nguyen', 'Garcia', 'Brooks', 'Rosen', 'Okafor', 'Diaz', 'Kim', 'Murphy', 'Santos'] },
    2100: { first: ['Juno', 'Kai', 'Nova', 'Ezra', 'Sol', 'Ines', 'Rook', 'Lyra', 'Oren', 'Mika', 'Zeph', 'Ada', 'Cass', 'Ivo', 'Wren', 'Remy', 'Tal', 'Echo', 'Bo', 'Sage'], last: ['Okonkwo-Reyes', 'Lindqvist', 'Park', 'Achterberg', 'Moreau', 'Abara', 'Castellanos', 'Haddad', 'Ivanova', 'Nakamura', 'Quist', 'Varga', 'Delacroix', 'Mensah', 'Arden', 'Solberg'] },
  },
  tokyo: {
    1900: { first: ['Tokichi', 'Kiku', 'Genzo', 'Haru', 'Sakichi', 'Tome', 'Isamu', 'Fumi', 'Rinzo', 'Sada', 'Kumakichi', 'Yae', 'Matsugoro', 'Chiyo', 'Heikichi', 'Ume'], last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki'] },
    2000: { first: ['Takeshi', 'Yuki', 'Kenji', 'Aiko', 'Hiroshi', 'Mai', 'Daisuke', 'Emi', 'Satoshi', 'Naomi', 'Ryo', 'Kana', 'Shinji', 'Rie', 'Taro', 'Saki'], last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki'] },
    2100: { first: ['Sora', 'Rin', 'Haru', 'Mio', 'Ren', 'Yua', 'Aoi', 'Itsuki', 'Hina', 'Riku', 'Tsumugi', 'Minato', 'Kai', 'Nagi', 'Rei', 'Yuzu'], last: ['Sato', 'Hoshino', 'Kurosawa', 'Amano', 'Mizuki', 'Tachibana', 'Fujiwara', 'Sakura', 'Kanzaki', 'Shiina', 'Tsukishima', 'Aizawa'] },
  },
};

// Jobs: where they work (office or the shop they keep), hours, daily wage. `shop: true` means
// they keep a shop and earn from its sales instead of a wage.
const JOBS = {
  1900: [['Clerk', 'office', 9, 18, 40], ['Banker', 'office', 10, 16, 120], ['Dock worker', 'office', 6, 16, 30], ['Seamstress', 'office', 7, 18, 25], ['Newsboy', 'street', 5, 12, 10], ['Police officer', 'street', 8, 20, 45], ['Cabman', 'street', 7, 19, 35], ['Organ grinder', 'street', 11, 18, 15], ['Shopkeeper', 'shop', 7, 19, 0]],
  2000: [['Office worker', 'office', 9, 17, 160], ['Banker', 'office', 8, 19, 420], ['Barista', 'shop', 6, 14, 90], ['Bike messenger', 'street', 9, 18, 110], ['Cop', 'street', 8, 18, 200], ['Cabbie', 'street', 6, 18, 150], ['Artist', 'street', 11, 16, 40], ['Dog walker', 'street', 9, 15, 80], ['Shopkeeper', 'shop', 7, 20, 0]],
  2100: [['Memory broker', 'office', 10, 16, 600], ['Drone wrangler', 'street', 8, 17, 260], ['Hover-cab pilot', 'street', 7, 19, 300], ['Vat chef', 'shop', 6, 14, 200], ['Archivist', 'office', 9, 17, 240], ['Peacekeeper', 'street', 8, 18, 320], ['Street artist', 'street', 12, 18, 90], ['Garden tech', 'street', 7, 15, 180], ['Shopkeeper', 'shop', 7, 20, 0]],
};
// Prices scale with the era: 1900 dollars buy more.
export const PRICE_SCALE = { 1900: 0.25, 2000: 1, 2100: 3 };

const NEEDS = ['hunger', 'energy', 'fun', 'social'];
// Per game hour: hunger and loneliness grow, energy and fun drain.
const DRIFT = { hunger: 1 / 6, energy: -1 / 17, fun: -1 / 9, social: -1 / 11 };

export function createTown({ city = 'nyc', era = '2000', seed = WORLD.seed, saved = null, hour = 12 } = {}) {
  const places = placesFor(seed);
  const byId = new Map(places.map((p) => [p.id, p]));
  const homes = places.filter((p) => p.kind === 'home'), offices = places.filter((p) => p.kind === 'office'), shops = places.filter((p) => p.kind === 'shop');
  const scale = PRICE_SCALE[era] ?? 1;
  const priceOf = (shop) => Math.round(SHOP_KINDS[shop.shop].price * scale * 100) / 100;
  const rng = createRng(seed + era.length * 31 + (city === 'tokyo' ? 7 : 0));
  const names = NAMES[city]?.[era] || NAMES.nyc[2000];
  const jobs = JOBS[era] || JOBS[2000];

  let residents;
  if (saved?.residents?.length) residents = saved.residents;
  else {
    residents = [];
    const freeShops = [...shops];
    const COUNT = 240;
    for (let i = 0; i < COUNT; i++) {
      const home = homes[Math.floor(rng() * homes.length)];
      // The first few residents keep the shops, so every shop has a keeper; the rest draw a job.
      const others = jobs.filter((j) => j[0] !== 'Shopkeeper');
      const job = i < shops.length ? jobs.find((j) => j[0] === 'Shopkeeper') : others[Math.floor(rng() * others.length)];
      const shop = i < shops.length ? freeShops.shift() : null;
      const work = shop || (job[1] === 'office' ? offices[Math.floor(rng() * offices.length)] : job[1] === 'shop' ? shops[Math.floor(rng() * shops.length)] : null);
      const first = names.first[Math.floor(rng() * names.first.length)], last = names.last[Math.floor(rng() * names.last.length)];
      const wage = Math.round(job[4] * (0.8 + rng() * 0.4));
      residents.push({
        id: `r${String(i).padStart(3, '0')}`, first, last, name: `${first} ${last}`,
        job: job[0], jobKind: job[1], shift: [job[2], job[3]], wage,
        home: home.id, work: work?.id || null, shop: shop?.id || null,
        look: { seed: 1 + Math.floor(rng() * 1e6) },
        money: Math.round((wage * (2 + rng() * 6) + 20 * scale) * 100) / 100,
        inventory: { food: Math.floor(rng() * 4), goods: Math.floor(rng() * 3) },
        needs: { hunger: rng() * 0.5, energy: 0.5 + rng() * 0.5, fun: 0.3 + rng() * 0.6, social: 0.3 + rng() * 0.6 },
        traits: { thrift: rng(), sociable: rng(), diligent: rng(), kind: rng(), honest: rng() },
        friends: [], landlord: null, rent: 0,
        opinion: 0, met: false, log: [],
        act: { kind: 'idle', at: home.id, until: 0 },
        stats: { earned: 0, spent: 0 },
      });
    }
    // Friends, and a landlord for most: richer residents own other people's flats.
    const rich = [...residents].sort((a, b) => b.money - a.money).slice(0, 20);
    for (const r of residents) {
      while (r.friends.length < 3) { const f = residents[Math.floor(rng() * residents.length)]; if (f !== r && !r.friends.includes(f.id)) r.friends.push(f.id); }
      if (!rich.includes(r) && rng() < 0.8) { r.landlord = rich[Math.floor(rng() * rich.length)].id; r.rent = Math.round(r.wage * (0.25 + rng() * 0.15) * 100) / 100; }
    }
  }
  const people = new Map(residents.map((r) => [r.id, r]));
  const shopStock = saved?.shops || Object.fromEntries(shops.map((s) => [s.id, { till: 0, stock: 90 }]));

  const town = {
    city, era, places, residents, shops, scale,
    // Coming back to a saved day starts it again at the remembered hour (the next one), so the
    // light and the clock agree; people keep their money, friends, opinions and history.
    clock: saved ? Math.ceil((saved.clock - hour * H) / DAY) * DAY + hour * H : hour * H,
    day: saved ? Math.ceil((saved.clock - hour * H) / DAY) : 0,
    get hour() { return (town.clock % DAY) / H; },
    place: (id) => byId.get(id),
    person: (id) => people.get(id),
    priceOf,
    shopName(placeId) { const p = byId.get(placeId); if (!p?.shop) return null; const keeper = residents.find((r) => r.shop === placeId); return `${keeper ? keeper.last + '\'s ' : ''}${SHOP_KINDS[p.shop].label[era] || SHOP_KINDS[p.shop].label[2000]}`; },
    tick, decide, where, outdoors, note, pay, transfer, hail, dropOff, save, stockOf: (id) => shopStock[id],
  };

  // Where someone is right now: at a place, or partway along a walk.
  function where(r) {
    const a = r.act;
    if (a.kind === 'walk') {
      const from = byId.get(a.from).door, to = byId.get(a.to).door;
      const t = Math.min(1, Math.max(0, (town.clock - a.start) / Math.max(1, a.until - a.start)));
      return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, t, from, to, outdoors: true };
    }
    if (a.kind === 'ride') return { ...a.pos, outdoors: false, riding: true };
    const p = byId.get(a.at);
    return { x: p.door.x, z: p.door.z, outdoors: p.kind === 'park' || a.kind === 'street', from: p.door, to: p.door, t: 1 };
  }

  // People life.js should draw near a point: walking, at the park, or working the street.
  function outdoors(pos, radius) {
    const out = [];
    for (const r of residents) {
      const w = where(r);
      if (!w.outdoors) continue;
      if (Math.hypot(w.x - pos.x, w.z - pos.z) <= radius) out.push({ resident: r, x: w.x, z: w.z, from: w.from, to: w.to, progress: w.t, kind: r.act.kind });
    }
    return out;
  }

  function note(r, text) {
    r.log.unshift({ day: town.day, hour: Math.floor(town.hour), text });
    if (r.log.length > 12) r.log.length = 12;
  }
  function transfer(from, to, amount, why) {
    amount = Math.min(amount, from ? from.money : amount);
    if (amount <= 0) return 0;
    if (from) { from.money = round2(from.money - amount); from.stats.spent += amount; }
    if (to) { to.money = round2(to.money + amount); to.stats.earned += amount; }
    if (why && from) note(from, why);
    return amount;
  }
  // The player paying someone, or someone paying the player (returns what changed hands).
  function pay(r, amount, why) { r.money = round2(r.money + amount); if (why) note(r, why); return amount; }

  // ---- decisions ------------------------------------------------------------------------

  // Score each thing a person could do next; the best (with a little noise) wins.
  function decide(r) {
    const h = town.hour, n = r.needs, t = r.traits, onShift = inShift(r.shift, h);
    const options = [];
    const add = (score, kind, at, hours, extra = {}) => options.push({ score: score + rng() * 0.08, kind, at, hours, ...extra });
    const night = h >= 23 || h < 6;
    add((1 - n.energy) * 1.4 + (night ? 0.9 : 0), 'sleep', r.home, Math.max(1, (1 - n.energy) * 9));
    if (onShift && n.energy > 0.15) add(0.7 + t.diligent * 0.5 + (r.money < r.wage * 2 ? 0.4 : 0), 'work', r.jobKind === 'street' ? nearestPlaceOf(r, 'shop') : r.work, Math.max(1, shiftLeft(r.shift, h)), { street: r.jobKind === 'street' });
    if (n.hunger > 0.35) {
      if (r.inventory.food > 0 && (t.thrift > 0.5 || r.money < 5 * scale)) add(n.hunger * 1.3, 'eat-home', r.home, 0.6);
      const meal = cheapestShop('meal', r) || cheapestShop('food', r);
      if (meal && r.money >= priceOf(meal)) add(n.hunger * 1.25 + (1 - t.thrift) * 0.2, 'eat-out', meal.id, 0.7);
    }
    if (r.inventory.food < 2 && !night) { const deli = cheapestShop('food', r); if (deli && r.money >= priceOf(deli) * 3) add(0.35 + (2 - r.inventory.food) * 0.15, 'shop', deli.id, 0.4); }
    if (!night) add((1 - n.fun) * 0.9 + (h > 17 ? 0.15 : 0), 'park', 'park', 1 + rng() * 1.5);
    const bar = cheapestShop('fun', r);
    if (bar && h > 17 && r.money >= priceOf(bar) * 2) add((1 - n.fun) * 0.8 + (1 - n.social) * 0.4 + (1 - t.thrift) * 0.2, 'bar', bar.id, 1.5);
    if (!night && r.friends.length) { const f = people.get(r.friends[Math.floor(rng() * r.friends.length)]); add((1 - n.social) * (0.6 + t.sociable * 0.6), 'visit', f.home, 1.2, { friend: f.id }); }
    add(0.2, 'home', r.home, 0.5 + rng());
    options.sort((a, b) => b.score - a.score);
    return options[0];
  }

  function start(r, plan) {
    const here = currentPlace(r);
    if (here !== plan.at) {
      const from = byId.get(here).door, to = byId.get(plan.at).door;
      const dist = Math.abs(to.x - from.x) + Math.abs(to.z - from.z);   // the grid: walk the blocks, not the diagonal
      r.act = { kind: 'walk', from: here, to: plan.at, start: town.clock, until: town.clock + dist / WALK, then: plan };
    } else arrive(r, plan);
  }

  function arrive(r, plan) {
    const p = byId.get(plan.at);
    r.act = { kind: plan.street ? 'street' : plan.kind, at: plan.at, until: town.clock + plan.hours * H, friend: plan.friend };
    if ((plan.kind === 'eat-out' || plan.kind === 'bar' || plan.kind === 'shop') && p.shop) {
      const keeper = residents.find((k) => k.shop === p.id), qty = plan.kind === 'shop' ? 3 : 1, cost = priceOf(p) * qty, stock = shopStock[p.id];
      if (stock && stock.stock >= qty && r.money >= cost) {
        transfer(r, keeper || null, cost, `${plan.kind === 'shop' ? 'Bought groceries' : plan.kind === 'bar' ? 'Had a drink' : 'Ate'} at ${town.shopName(p.id)}`);
        stock.stock -= qty; stock.till += cost;
        if (plan.kind === 'shop') r.inventory.food += qty;
        else if (plan.kind === 'bar') { r.needs.fun = Math.min(1, r.needs.fun + 0.5); r.needs.social = Math.min(1, r.needs.social + 0.3); }
        else r.needs.hunger = Math.max(0, r.needs.hunger - 0.8);
      } else note(r, `${town.shopName(p.id)} ${stock?.stock < qty ? 'was sold out' : 'was too dear'}`);
    }
    if (plan.kind === 'eat-home' && r.inventory.food > 0) { r.inventory.food--; r.needs.hunger = Math.max(0, r.needs.hunger - 0.7); }
    if (plan.kind === 'visit') { const f = people.get(plan.friend); if (f && currentPlace(f) === plan.at) { r.needs.social = Math.min(1, r.needs.social + 0.6); f.needs.social = Math.min(1, f.needs.social + 0.4); note(r, `Visited ${f.first}`); } else note(r, `Went to see ${f?.first}, nobody home`); }
  }

  function finish(r) {
    const a = r.act;
    if (a.kind === 'work' || a.kind === 'street') {
      const done = Math.min(1, (town.clock - (a.until - (shiftLength(r.shift)) * H)) / (shiftLength(r.shift) * H));
      if (r.wage) { pay(r, round2(r.wage * Math.max(0.2, done)), null); r.stats.earned += r.wage; }
      note(r, `Worked as ${article(r.job)} ${r.job.toLowerCase()}`);
    }
  }

  // Advance the town by `dt` game seconds. Needs drift, activities end, people re-decide.
  function tick(dt) {
    const before = town.hour;
    town.clock += dt;
    const hours = dt / H;
    for (const r of residents) {
      for (const k of NEEDS) r.needs[k] = clamp01(r.needs[k] + DRIFT[k] * hours * (k === 'energy' && r.act.kind === 'sleep' ? -2.6 : 1));
      if (r.act.kind === 'park') r.needs.fun = clamp01(r.needs.fun + hours * 0.5);
      if (r.act.kind === 'ride') continue;
      if (town.clock < r.act.until) continue;
      if (r.act.kind === 'walk') { arrive(r, r.act.then); continue; }
      finish(r);
      start(r, decide(r));
    }
    if (town.hour < before) newDay();
  }

  // Midnight: rent changes hands and shops restock out of their tills.
  function newDay() {
    town.day++;
    for (const r of residents) if (r.landlord && r.rent) transfer(r, people.get(r.landlord), r.rent, null);
    for (const s of shops) { const st = shopStock[s.id], need = 90 - st.stock, cost = need * priceOf(s) * 0.45; const keeper = residents.find((k) => k.shop === s.id); if (keeper) transfer(keeper, null, Math.min(cost, keeper.money * 0.5), null); st.stock = 90; st.till = 0; }
  }

  // ---- the player ---------------------------------------------------------------------------

  // A cab fare: they stop where they are and get in; dropOff lets them out at a place.
  function hail(r, pos) { r.act = { kind: 'ride', pos: { x: pos.x, z: pos.z }, until: Infinity, was: r.act }; }
  function dropOff(r, placeId) {
    const plan = r.act.was?.then || r.act.was || { kind: 'home', at: placeId, hours: 0.5 };
    r.act = { kind: 'idle', at: placeId, until: 0 };
    arrive(r, { ...plan, at: placeId, hours: plan.hours || 0.5 });
  }

  function currentPlace(r) {
    const a = r.act;
    if (a.kind === 'walk') return town.clock >= a.until ? a.to : a.from;
    if (a.kind === 'ride') return r.home;
    return a.at;
  }
  function cheapestShop(sells, r) {
    const home = byId.get(r.home).door;
    let best = null, bs = Infinity;
    for (const s of shops) {
      if (SHOP_KINDS[s.shop].sells !== sells) continue;
      const d = Math.abs(s.door.x - home.x) + Math.abs(s.door.z - home.z), score = d / 100 + priceOf(s) * (r.traits.thrift * 0.3);
      if (score < bs) { bs = score; best = s; }
    }
    return best;
  }
  function nearestPlaceOf(r, kind) {
    const home = byId.get(r.home).door;
    let best = null, bd = Infinity;
    for (const p of places) if (p.kind === kind) { const d = Math.abs(p.door.x - home.x) + Math.abs(p.door.z - home.z) + (p.id.length % 7) * 40; if (d < bd) { bd = d; best = p; } }
    return best?.id || 'park';
  }

  function save() { return { v: 1, clock: town.clock, day: town.day, residents, shops: shopStock }; }

  // A fresh town runs its morning before you arrive, so people are already out and about.
  if (!saved) {
    town.clock -= 4 * H;
    for (const r of residents) r.act = { kind: 'idle', at: r.home, until: town.clock + rng() * 2 * H };
    for (let s = 0; s < 4 * H; s += 60) tick(60);
  }
  return town;
}

function inShift([a, b], h) { return h >= a && h < b; }
function shiftLeft([, b], h) { return Math.max(0.5, b - h); }
function shiftLength([a, b]) { return b - a; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function round2(v) { return Math.round(v * 100) / 100; }
function article(word) { return /^[aeiou]/i.test(word) ? 'an' : 'a'; }
