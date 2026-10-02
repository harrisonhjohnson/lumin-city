// Who knows whom, who matters, and how what people think of you spreads and fades. Pure: works
// on a town from town.js. Links are derived deterministically from the roster (so they need
// no saving); opinions live on the residents and are saved with the town.
//   links   a few connectors know dozens of people (shopkeepers, cops, cabbies, bartenders);
//           most people know a handful
//   clout   how much someone's word carries: how connected they are, and their standing
//   spread  every night, people pass on what they think of you to the people they know
//   fade    interest in you fades unless you keep seeing people
//   access  the most influential are busy: they won't make time for a stranger unless someone
//           they trust speaks well of you

const PRESTIGE = { Banker: 0.35, 'Memory broker': 0.35, Shopkeeper: 0.2, Cop: 0.15, 'Police officer': 0.15, Peacekeeper: 0.15, Cabbie: 0.12, Cabman: 0.12, 'Hover-cab pilot': 0.12, Archivist: 0.1, Artist: 0.05 };
const CONNECTOR_JOBS = /Shopkeeper|Cop|Police|Peacekeeper|Cabbie|Cabman|cab pilot|Newsboy|Barista|messenger|Dog walker/;
function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));

export function buildSocial(town) {
  const people = town.residents, n = people.length, byId = new Map(people.map((r) => [r.id, r]));
  const links = new Map(people.map((r) => [r.id, new Set()]));
  const link = (a, b) => { if (a !== b && byId.has(a) && byId.has(b)) { links.get(a).add(b); links.get(b).add(a); } };
  for (const r of people) for (const f of r.friends) link(r.id, f);
  // Neighbours know each other a little.
  const byHome = new Map();
  for (const r of people) (byHome.get(r.home) || byHome.set(r.home, []).get(r.home)).push(r.id);
  for (const ids of byHome.values()) for (let i = 1; i < ids.length; i++) link(ids[0], ids[i]);
  // Connectors: people whose jobs put them in front of the whole street.
  for (const r of people) {
    const h = hash(r.id + 'net');
    const extra = CONNECTOR_JOBS.test(r.job) && h % 4 === 0 ? 18 + (h % 18) : h % 11 === 0 ? 4 + (h % 4) : 0;
    for (let k = 0; k < extra; k++) link(r.id, people[hash(r.id + k) % n].id);
  }
  const maxDeg = Math.max(...[...links.values()].map((s) => s.size));
  const clout = new Map(people.map((r) => [r.id, clamp(0.7 * Math.sqrt(links.get(r.id).size / maxDeg) + (PRESTIGE[r.job] || 0) + (r.money > r.wage * 15 ? 0.15 : 0), 0, 1)]));
  const sorted = [...clout.values()].sort((a, b) => a - b);
  const social = { links, clout, influential: sorted[Math.floor(sorted.length * (1 - INFLUENTIAL_SHARE))], linksOf: (id) => [...(links.get(id) || [])], cloutOf: (id) => clout.get(id) || 0 };
  town.social = social;
  if (!town._socialHooked) { town.onDay.push(nightly); town._socialHooked = true; }
  return social;
}

// The influential few: the top slice by clout.
export const INFLUENTIAL_SHARE = 0.06;
export const isInfluential = (town, r) => town.social.cloutOf(r.id) >= town.social.influential;

// Every night: opinions of you travel along the links (from a snapshot, so order doesn't
// matter), weighted by how much the speaker's word carries and how chatty they are; then
// interest fades, faster for people you haven't seen lately.
export function nightly(town) {
  const s = town.social;
  if (!s) return;
  // Each person hears from everyone they know and moves toward the average of what they hear,
  // weighted by how much each speaker's word carries — averaged, so a person with fifty friends
  // isn't fifty times as moved.
  const before = new Map(town.residents.map((r) => [r.id, r.opinion]));
  for (const r of town.residents) {
    let heard = 0, weight = 0;
    for (const id of s.links.get(r.id)) {
      const o = before.get(id), w = s.cloutOf(id) * (0.5 + town.person(id).traits.sociable);
      if (Math.abs(o) < 0.05) continue;
      heard += o * w; weight += w;
    }
    if (weight) r.opinion = clamp(r.opinion + 0.12 * (heard / Math.max(weight, 1.5) - r.opinion * 0.3));
  }
  for (const r of town.residents) {
    const unseen = town.day - (r.seen ?? -99);
    r.opinion *= unseen <= 2 ? 0.99 : unseen <= 7 ? 0.96 : 0.92;
    if (Math.abs(r.opinion) < 0.01) r.opinion = 0;
  }
}

// You spent time with them (talked, drove them, helped): resets their fade.
export function seen(town, r) { r.seen = town.day; }

// Will they give you their time? Influential people are busy: you need them to like you a
// little already, or for someone close to them to vouch for you.
export function access(town, r) {
  if (!isInfluential(town, r) || r.opinion >= 0.25 || r.met && r.opinion >= 0.15) return { ok: true };
  const voucher = town.social.linksOf(r.id).map((id) => town.person(id)).filter((p) => p.opinion >= 0.45).sort((a, b) => b.opinion - a.opinion)[0];
  if (voucher) return { ok: true, voucher };
  return { ok: false, line: pickLine(r, ['I\'m due somewhere. Another time.', 'Sorry — I really don\'t have a minute.', 'Talk to my office.', 'Do I know you? I\'m running late.']), hint: 'They\'re busy and influential. Help the people around them first — someone they trust can vouch for you.' };
}

// How much the city's talk runs your way: opinion weighted by clout, −1..1.
export function influence(town) {
  let sum = 0, w = 0;
  for (const r of town.residents) { const c = 0.3 + town.social.cloutOf(r.id); sum += r.opinion * c; w += c; }
  return w ? sum / w : 0;
}

function pickLine(r, list) { return list[hash(r.id) % list.length]; }
