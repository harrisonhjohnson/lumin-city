import { chatLine } from './chatter.js';
import { giftWeight } from './fame.js';
// What a resident says when you walk up to them, and what happens when you answer. Pure:
// reads town state, returns words and changes; main.js shows the card and applies them.

const pick = (list, r, salt = 0) => list[(hash(r.id) + salt) % list.length];
function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

export function moodOf(r) {
  const n = r.needs;
  if (r.scared > 0) return 'scared';
  if (r.opinion < -0.4) return 'angry';
  if (n.hunger > 0.75) return 'hungry';
  if (n.energy < 0.2) return 'tired';
  if (r.money < 5) return 'broke';
  if (n.social < 0.2) return 'lonely';
  return n.fun > 0.6 && r.opinion >= 0 ? 'happy' : 'fine';
}

const DOING = {
  walk: (r, town) => `on my way to ${placeName(town, r.act.to, r)}`,
  park: () => 'just getting some air',
  street: (r) => `working — ${r.job.toLowerCase()}, you know`,
  work: (r, town) => `at work at ${placeName(town, r.act.at, r)}`,
  'eat-out': (r, town) => `eating at ${placeName(town, r.act.at, r)}`,
  bar: (r, town) => `having one at ${placeName(town, r.act.at, r)}`,
  visit: (r, town) => `visiting ${town.person(r.act.friend)?.first || 'a friend'}`,
};

export function placeName(town, id, r) {
  if (id === 'park') return 'the park';
  if (id === r?.home) return 'home';
  return town.shopName(id) || (town.place(id)?.kind === 'office' ? 'the office' : 'a friend\'s place');
}

// The opening line and the card's facts.
export function greet(r, town, player) {
  const mood = moodOf(r), stranger = !r.met;
  const doing = (DOING[r.act.kind] || (() => 'not doing much'))(r, town);
  const opener = stranger
    ? pick(['Do I know you?', 'Can I help you?', 'Oh! Sorry, you startled me.', 'You lost?'], r)
    : r.opinion > 0.5 ? pick([`${player}! There you are.`, `Hey, ${player}!`, `${player}, my favourite person.`], r) : r.opinion < -0.3 ? pick([`Oh. It's you.`, `What do you want, ${player}?`], r) : pick([`Oh, hi ${player}.`, `${player}. How's it going?`], r);
  const how = {
    hungry: 'I haven\'t eaten all day.', tired: 'I\'m dead on my feet.', broke: `I'm down to my last ${money(r.money)}.`, lonely: 'Haven\'t talked to anyone in ages.',
    scared: 'Somebody just tried to rob me!', angry: 'You nearly ran me over earlier.', happy: 'Lovely day, isn\'t it?', fine: '',
  }[mood];
  const last = r.log[0]?.text;
  const facts = [`Lives near ${town.place(r.home) ? where(town.place(r.home).door) : 'here'}`, `${r.job}${r.shop ? ` · keeps ${town.shopName(r.shop)}` : ''}`];
  if (last) facts.push(`Lately: ${last.charAt(0).toLowerCase()}${last.slice(1)}`);
  return { mood, line: `${opener} I'm ${doing}. ${how}`.replace(/\s+/g, ' ').trim(), facts };
}

// The choices on the card. `wallet` is the player's cash (Infinity with the jewel).
export function choices(r, wallet, scale) {
  const gift = Math.round(10 * scale * 100) / 100;
  return [
    { id: 'chat', label: 'Chat for a minute', hint: 'They might tell you something' },
    { id: 'give', label: `Give them ${money(gift)}`, disabled: wallet < gift, hint: wallet < gift ? 'You can\'t spare it' : undefined, amount: gift },
    { id: 'favour', label: 'Ask a favour', hint: r.opinion > 0.35 ? 'They like you enough to say yes' : 'They don\'t know you that well' },
  ];
}

// Apply an answer. Returns { line, opinion delta, cash to/from the player, memories found }.
export function answer(r, id, town, player, scale, ctx = {}) {
  r.met = true;
  if (id === 'chat') {
    // Something they haven't told you before; chatting twice in a day still pleases, less.
    const line = chatLine(r, town, { player, ...ctx }) || pick(['That\'s all my news, honestly. Come back tomorrow — something always happens.', 'I\'ve talked your ear off. Go on, the city\'s waiting.'], r, town.day);
    const again = r.chatted === town.day; r.chatted = town.day;
    r.needs.social = Math.min(1, r.needs.social + 0.25);
    town.note(r, `Chatted with ${player}`);
    return { line, opinion: again ? 0.02 : 0.08, cash: 0, memories: 0 };
  }
  if (id === 'give') {
    const gift = Math.round(10 * scale * 100) / 100;
    town.pay(r, gift, `${player} gave me ${money(gift)}`);
    const w = giftWeight(r, town);   // the third bill this week is worth less than the first
    return { line: w < 0.5 ? pick(['Again? People will start to talk.', 'You don\'t have to keep doing this, you know.', 'I\'m starting to wonder what you want.'], r, town.day) : r.money < 30 * scale ? 'You have no idea what this means. Thank you.' : pick(['That\'s kind of you. Odd, but kind.', 'Well! Thank you.', 'I\'ll pay it forward.'], r), opinion: (r.money < 30 * scale ? 0.3 : 0.15) * w, cash: -gift, memories: 0 };
  }
  if (id === 'favour') {
    if (r.opinion > 0.35) {
      const lend = Math.min(Math.round(r.money * 0.15 * 100) / 100, 40 * scale);
      if (lend >= 1 && r.traits.kind > 0.3) { town.pay(r, -lend, `Lent ${player} ${money(lend)}`); return { line: `Here — ${money(lend)}. Pay me back sometime.`, opinion: -0.05, cash: lend, memories: 0 }; }
      return { line: 'I can\'t spare anything, but here — I found this. It reminded me of you.', opinion: 0, cash: 0, memories: 60 };
    }
    return { line: r.traits.kind > 0.6 ? 'Maybe once I know you better.' : 'A favour? I don\'t even know you.', opinion: -0.03, cash: 0, memories: 0 };
  }
  return { line: '', opinion: 0, cash: 0, memories: 0 };
}

export function money(v) { return `$${v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2)}`; }
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
export function where(door) { return `${ord(Math.round(door.x / 140) + 3)} Ave & ${ord(Math.max(1, Math.round((220 - door.z) / 80)))} St`; }

// ---- ready for a model to voice them --------------------------------------------------------

// Everything a language model needs to play this resident, small enough to send each turn:
// who they are, how they feel, what they've been doing, and what's passed between you.
export function dossier(r, town, player) {
  const band = (v) => (v < 0.25 ? 'low' : v < 0.6 ? 'middling' : 'high');
  const name = (id) => (id === 'player' ? player : town.person(id)?.name || null);
  return {
    world: { city: town.city, year: town.era, hour: Math.floor(town.hour), day: town.day + 1 },
    who: { name: r.name, job: r.job, shop: r.shop ? town.shopName(r.shop) : null, home: town.place(r.home) ? where(town.place(r.home).door) : null },
    mood: moodOf(r),
    needs: Object.fromEntries(Object.entries(r.needs).map(([k, v]) => [k, band(v)])),
    traits: Object.fromEntries(Object.entries(r.traits).map(([k, v]) => [k, band(v)])),
    money: Math.round(r.money), rent: r.rent || 0, landlord: name(r.landlord),
    friends: r.friends.map(name).filter(Boolean),
    doing: (DOING[r.act.kind] || (() => 'not doing much'))(r, town),
    recently: r.log.slice(0, 5).map((l) => l.text),
    you: { met: r.met, opinion: Math.round(r.opinion * 100) / 100, said: (r.said || []).slice(-8) },
  };
}

// Keep a short history of what was said between the player and a resident (both sides), so
// the next conversation can pick up where the last one left off.
export function remember(r, who, text, town) {
  (r.said ||= []).push({ who, text: String(text).slice(0, 280), day: town.day, hour: Math.floor(town.hour) });
  if (r.said.length > 20) r.said.splice(0, r.said.length - 20);
}
