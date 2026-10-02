// What a resident needs that you could help with. Offered from their real situation — short on
// rent, renting from you, sick of bad pizza, late for an appointment, missing something
// precious — and paid back in what they think of you, which spreads (social.js) and votes
// (civic.js). Pure: works on a town; main.js and modes.js offer, track and complete them.
//   state  offered → active → done | failed
import { hidingSpot, LOST } from './loot.js';
import { placeName } from './talk.js';

function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rngFrom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const money = (v) => `$${v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2)}`;
const hhmm = (clock) => { const h = (clock % 86400) / 3600, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };

export const PIZZA_START = 0.75;

// The quest this person would ask about today, if any (about a third of people have one).
// `can` = what the player is able to do: { ride: has a vehicle power, buildings, park, island }.
export function questFor(r, town, can = {}) {
  const existing = (town.quests ||= []).find((q) => q.who === r.id && (q.state === 'offered' || q.state === 'active'));
  if (existing) return existing;
  if (hash(r.id + 'q' + town.day) % 3 !== 0) return null;
  const rng = rngFrom(hash(r.id + 'qq' + town.day));
  const types = [];
  if (r.landlord === 'player') types.push('rent');
  if (r.money < Math.max(r.rent * 4, 40 * town.scale) || (r.landlord && hash(r.id + 'short' + town.day) % 4 === 0)) types.push('money');
  if ((town.civic?.pizza ?? PIZZA_START) < 0.6) types.push('pizza');
  if (can.ride) types.push('ride');
  if (can.buildings) types.push('lost');
  if (!types.length) return null;
  const type = types[Math.floor(rng() * types.length)];
  const id = `${r.id}-${town.day}`;
  const q = { id, who: r.id, type, state: 'offered', day: town.day, data: {} };
  if (type === 'money') {
    q.data.amount = Math.round(Math.max(r.rent, 15 * town.scale) * 0.8 * 100) / 100;
    Object.assign(q, { title: 'Short this week', detail: `${r.first} is ${money(q.data.amount)} short and too proud to ask twice.`, reward: { opinion: 0.35, memories: 40 } });
  } else if (type === 'rent') {
    Object.assign(q, { title: 'Ease the rent', detail: `${r.first} rents from you at ${money(r.rent)} a day and is struggling. A fifth off would change everything.`, reward: { opinion: 0.45, memories: 50 } });
  } else if (type === 'pizza') {
    const shop = town.shops.find((s) => s.shop === 'pizzeria');
    Object.assign(q, { title: 'The pizza\'s gone bad', detail: `${r.first} says the pizza at ${shop ? town.shopName(shop.id) : 'the pizzeria'} has gone downhill. Somebody should work a shift and set it right — get a B or better at the Pizza shop.`, reward: { opinion: 0.3, memories: 60 } });
  } else if (type === 'ride') {
    const far = town.places.filter((p) => (p.kind === 'office' || p.kind === 'shop') && Math.hypot(p.door.x - town.place(r.home).door.x, p.door.z - town.place(r.home).door.z) > 180);
    const to = far[Math.floor(rng() * far.length)] || town.places[0];
    q.data = { to: to.id, due: town.clock + 3 * 3600 };
    Object.assign(q, { title: 'A ride to an appointment', detail: `${r.first} has to be at ${placeName(town, to.id, r)} by ${hhmm(q.data.due)}. You'll need wheels — a car, a cab or a scooter.`, reward: { opinion: 0.4, memories: 50, cash: Math.round(12 * town.scale * 100) / 100 } });
  } else {
    const items = LOST[town.era] || LOST[2000], home = town.place(r.home).door;
    const spot = hidingSpot(rng, can.buildings, { near: home, radius: 170, park: can.park, island: can.island }) || { x: home.x, y: 0.9, z: home.z, where: 'near home' };
    q.data = { item: items[Math.floor(rng() * items.length)], ...spot, found: false };
    Object.assign(q, { title: `Lost: ${q.data.item}`, detail: `${r.first} lost ${q.data.item} somewhere ${spot.where}, not far from home. Find it and bring it back.`, reward: { opinion: 0.45, memories: 70 } });
  }
  town.quests.push(q);
  return q;
}

export const activeQuests = (town) => (town.quests || []).filter((q) => q.state === 'active');
export function accept(town, q) { q.state = 'active'; q.accepted = town.clock; }

// Can it be finished right here, talking to them? money: you pay; rent: you cut it; lost: you
// have the item.
export function completableAtTalk(q) {
  if (q?.state !== 'active') return false;
  return q.type === 'money' || q.type === 'rent' || (q.type === 'lost' && q.data.found);
}

// Finish it: the resident's side of the bargain. Returns the reward for the player.
export function complete(town, q, note = '') {
  const r = town.person(q.who);
  if (q.type === 'money') town.pay(r, q.data.amount, 'Someone covered me when I was short');
  if (q.type === 'rent') { r.rent = Math.round(r.rent * 0.8 * 100) / 100; r.kindness = Math.min(2, (r.kindness || 0) + 1); }
  q.state = 'done'; q.doneDay = town.day;
  r.opinion = Math.min(1, r.opinion + q.reward.opinion); r.met = true; r.seen = town.day;
  town.note(r, note || ({ money: 'Got help with money', rent: 'My landlord cut my rent', pizza: 'The pizza got good again', ride: 'Got a ride when I needed it', lost: `Got my ${q.data.item} back` })[q.type]);
  return q.reward;
}

// The clock runs out on rides; lost things turn up (or don't) after three days.
export function expire(town) {
  const failed = [];
  for (const q of town.quests || []) {
    if (q.state === 'offered' && town.day > q.day) q.state = 'lapsed';
    if (q.state !== 'active') continue;
    if ((q.type === 'ride' && town.clock > q.data.due) || (q.type === 'lost' && town.day > q.day + 3)) {
      q.state = 'failed';
      const r = town.person(q.who); r.opinion = Math.max(-1, r.opinion - 0.1);
      failed.push(q);
    }
  }
  return failed;
}

// The pizzeria slips a little every day; a good shift (B or better) sets it right and closes
// every pizza quest in town.
export function pizzaNightly(town) { town.civic.pizza = Math.max(0.2, (town.civic.pizza ?? PIZZA_START) - 0.06); }
export function pizzaShift(town) {
  town.civic.pizza = 1;
  return (town.quests || []).filter((q) => q.type === 'pizza' && q.state === 'active').map((q) => complete(town, q));
}
