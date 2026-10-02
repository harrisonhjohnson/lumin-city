// What people say when you stop to chat: never the same thing twice from the same person.
// Lines are built from what's true in the town — what their friends did yesterday, what's lying
// on a roof near their place, what they love, their job, the mayor, the rent — plus a deep
// well of era-flavoured small talk. Pure: main.js passes the bits of the world it needs.
//   ctx = { player, lootNear(x, z) → { label, where, x, z } | null, address(door) → 'Ave & St' }
import { likesOf } from './fame.js';

function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

const ERA = {
  1900: [
    'The new elevated line shakes my whole flat every four minutes. I\'ve started to sleep in rhythm with it.',
    'A man on Mulberry is selling ice cream from a cart. Ice. In a cream. The future is here.',
    'My cousin wrote from Ohio. Says it\'s all sky out there. I couldn\'t do it — where would you put your elbows?',
    'They lit the street lamps early tonight. Someone said electric ones are coming. I\'ll believe it when I see it.',
    'There\'s a fellow at the docks who swears he saw a whale in the river. Mind you, he also swears he\'s a count.',
    'I paid two cents for a newspaper and half of it was advertisements for tonics. I feel worse already.',
    'The horse outside our building has a name now. Nobody owns it. We just all call it Gerald.',
    'They say the tallest building in the city will be finished by spring. They said that last spring.',
  ],
  2000: [
    'My computer made a noise like a dying goose and now I have to start my essay again. Don\'t ever trust a floppy disk.',
    'The guy at the bodega knows my order. I don\'t even know my order. I just point.',
    'Everyone was so sure the clocks would break at New Year. Mine didn\'t. A little disappointed, honestly.',
    'I left a voicemail for my sister and it was so long the machine cut me off. Twice. I\'m calling back a third time.',
    'Someone on the subway was playing a full drum kit. Made of buckets. Best show I\'ve seen all year.',
    'I bought a phone that takes pictures. They\'re terrible. I take hundreds of them.',
    'There\'s a pigeon on my fire escape that looks exactly like my uncle Ray. Same attitude.',
    'Rent went up again. At this point I\'m just renting the air.',
  ],
  2100: [
    'My fridge ordered groceries without asking me again. Forty lemons. I don\'t know what it knows.',
    'They grew a new street tree overnight on my block. Fruit and everything. Nobody\'s brave enough to eat it.',
    'The hover lanes were jammed for an hour. Somebody\'s drone had a panic about a seagull.',
    'My grandmother still insists on paper books. Honestly, the smell is kind of nice.',
    'I tried to remember a phone number the old way. Got four digits in and my head hurt.',
    'The weather office says it\'ll rain at 3:12 exactly. It always does. I almost miss surprises.',
    'There\'s a man on the corner who sells real oranges. Grown in dirt. People queue for blocks.',
    'My building\'s AI wrote me a poem about the recycling. It was… actually quite moving?',
  ],
};
const TOKYO = [
  'The last train was packed so tight I was asleep standing up. Woke up three stops past mine.',
  'There\'s a vending machine on my corner that sells hot soup in a can. I\'m in love with it.',
  'The shrine near me has a cat that\'s been there longer than the priest. Everyone bows to it a little.',
  'My neighbour\'s been practising the shamisen. Badly. For six years. I\'ve grown to need it.',
];
const NYC = [
  'A guy tried to sell me the bridge today. Not the bridge — a bridge. Smaller. Still said no.',
  'Somebody painted the fire hydrant on my block to look like a little man in a tuxedo. Best thing in the neighbourhood.',
  'I waited forty minutes for the bus and then three came at once, like they planned it.',
  'My super fixed the radiator by hitting it with a shoe. Works better than ever.',
];
const LIKES = {
  pizza: ['Fold it or don\'t talk to me. That\'s my whole philosophy.', 'I could eat pizza every day. I basically do. My doctor has opinions.', 'You know what makes a pie? The burnt bits. Fight me.'],
  skating: ['I can still kickflip. Ask me how my knees are, though. Actually, don\'t.', 'There\'s a rail by the park everyone\'s scared of. I\'m going to land it one day.', 'Skating\'s not a crime, whatever the signs say.'],
  racing: ['If you\'ve never taken the avenue at full tilt at four in the morning, have you lived?', 'I know every pothole on this island by feel.', 'Somebody\'s been street racing on the east side. Not me. Officially.'],
  cabs: ['Best way to know a city is from the back of a cab. Second best is driving one.', 'A good cabbie knows three shortcuts nobody else does. I know four.'],
  safety: ['I just want to walk home without looking over my shoulder. Is that so much?', 'Somebody needs to do something about the crooks around here.', 'I keep a whistle on my keys. Never used it. Still feel better.'],
  sky: ['I swear I saw lights over the river last night. Moving wrong. Nobody believes me.', 'If something ever came out of that water, I\'d want to see someone stand up to it.', 'I read every story about heroes I can find. Still waiting to meet one.'],
  money: ['Everything\'s an investment if you squint.', 'I\'ve got a plan. Can\'t tell you. Ask me in five years.', 'Know who gets rich in this city? Landlords. Always the landlords.'],
  park: ['The park\'s the only place I can hear myself think.', 'I feed the ducks the same time every day. They know me. I think they like me.', 'If they ever pave the park, I\'m leaving town. I mean it.'],
  music: ['There\'s a sax player under the bridge who plays like his heart\'s breaking. Every night.', 'I\'m learning the trumpet. My neighbours are learning patience.'],
  art: ['I painted the view from my window forty times. It\'s different every time. So am I.', 'Somebody chalked a whale across the whole sidewalk on my block. Nobody walked on it all day.'],
};
const JOB = [
  [/Banker|broker/, ['Markets were jumpy today. So was I.', 'You\'d be amazed what people will lend money on.']],
  [/Cop|Police|Peacekeeper/, ['Quiet shift. Too quiet. That\'s how it starts.', 'You\'d be surprised what people try to get away with on a Tuesday.']],
  [/cab|Cab/, ['Had a fare today who tipped me in buttons. Real buttons.', 'Somebody left a birthday cake in my back seat. Still don\'t know whose.']],
  [/Shopkeeper|Barista|chef/, ['Lunch rush nearly killed me. I love it, though.', 'Regulars are the best part. Except Barry. Barry knows what he did.']],
  [/Artist/, ['Sold a painting today! To my mother. Still counts.']],
  [/messenger|Dog walker|Newsboy|wrangler/, ['Did forty blocks before lunch. My legs have opinions.', 'You see everything when you\'re out on the street all day.']],
];

const gossipFrom = (f, text) => {
  if (/^Ate at (.*)/.test(text)) return `${f.first}'s been eating at ${text.slice(7)} every day. Says it\'s the only place that gets the sauce right.`;
  if (/^Got robbed/.test(text)) return `Did you hear? ${f.first} got robbed. In broad daylight. They\'re still shaken up.`;
  if (/^Visited (.*)/.test(text)) return `${f.first} went to see ${text.slice(8)} yesterday. If you ask me, there\'s something going on there.`;
  if (/^Got evicted/.test(text)) return `${f.first} got thrown out of their flat. Who does that? Some landlords have no heart.`;
  if (/^Had a drink at (.*)/.test(text)) return `${f.first} was at ${text.slice(15)} until closing again. Singing, I\'m told.`;
  if (/^Bought groceries/.test(text)) return `${f.first} bought enough groceries for an army. Lives alone.`;
  if (/^Got a new landlord/.test(text)) return `${f.first}'s building changed hands. Everybody\'s waiting to see what the new landlord\'s like.`;
  if (/^Worked as/.test(text)) return null;
  return `${f.first} told me — "${text.toLowerCase()}". That\'s all they\'d say.`;
};

// One fresh line for this person, or null if they've run out today.
export function chatLine(r, town, ctx) {
  const heard = (r.heard ||= []);
  const options = [];
  const add = (weight, text) => { if (text && !heard.includes(hash(text))) options.push([weight, text]); };
  // Gossip about the people they know: true things from yesterday.
  for (const fid of r.friends.slice(0, 4)) {
    const f = town.person(fid), last = f?.log.find((l) => town.day - l.day <= 1);
    if (last) add(3, gossipFrom(f, last.text));
    if (f && f.opinion > 0.4) add(4, `${f.first} says you\'re alright, you know. That counts for something around here.`);
    if (f && f.opinion < -0.4) add(3, `${f.first} doesn\'t have a good word for you. Just so you know.`);
  }
  // A tip about something actually lying out there.
  const home = town.place(r.home)?.door, tip = home && ctx.lootNear?.(home.x, home.z);
  if (tip) add(5, `Strangest thing — I saw something glinting ${tip.where}, around ${ctx.address(tip)}. Didn\'t go up to look.`);
  // Their loves, their work, their city, their era.
  for (const k of likesOf(r)) for (const t of LIKES[k] || []) add(2, t);
  for (const [re, lines] of JOB) if (re.test(r.job)) for (const t of lines) add(2, t);
  for (const t of ERA[town.era] || ERA[2000]) add(1, t);
  for (const t of town.city === 'tokyo' ? TOKYO : NYC) add(1, t);
  // The city's business.
  const c = town.civic;
  if (c) {
    const mayor = c.mayor === 'player' ? 'you' : town.person(c.mayor)?.name;
    add(1, c.mayor === 'player' ? 'Mayor! In my street! Don\'t let it go to your head.' : `${mayor} again, probably, come the election. Unless somebody gives them a fight.`);
    if (c.flags?.parkGone) add(2, 'I still can\'t believe they sold the park. Where are the ducks supposed to go?');
    if (r.landlord && r.rent > r.wage * 0.35) add(2, `Rent eats half of what I make. ${r.landlord === 'player' ? 'No offence.' : 'Don\'t get me started on my landlord.'}`);
  }
  if (town.hour >= 21 || town.hour < 5) add(1, 'Shouldn\'t you be home? Nothing good happens after ten. Except the noodles.');
  if (town.hour < 8) add(1, 'Too early for talking. Ask me again after coffee.');
  if (!options.length) return null;
  // Weighted pick, stable per person and moment; then it's spent.
  const total = options.reduce((n, [w]) => n + w, 0);
  let x = (hash(r.id + town.clock) % 10000) / 10000 * total;
  const [, line] = options.find(([w]) => (x -= w) < 0) || options[0];
  heard.push(hash(line));
  if (heard.length > 60) heard.splice(0, heard.length - 60);
  return line;
}
