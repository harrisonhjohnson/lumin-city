import { composeLook, ERAS, SEASONS } from '../world/city/eras.js';
import { TIMES, WEATHERS } from '../world/city/conditions.js';

// What the player has "remembered" so far, and what the world should look like because of
// it. Pure: main.js asks the questions, this file turns answers into world settings.

export const CITIES = [{ id: 'nyc', label: 'New York City' }, { id: 'tokyo', label: 'Tokyo' }];
export const YEARS = ['1900', '2000', '2100'].map((id) => ({ id, label: id }));
export const SEASON_CHOICES = Object.entries(SEASONS).map(([id, s]) => ({ id, label: s.label }));
export const TIME_CHOICES = ['dawn', 'noon', 'dusk', 'midnight'].map((id) => ({ id, label: TIMES[id].label }));
export const weatherChoices = (season) => SEASONS[season].weathers.map(([id, label]) => ({ id, label }));

export const LINES = {
  // Said right after the time of day: how long the day runs before the narrator makes you rest.
  dayLength: {
    dawn: 'That gives you the whole day. You can keep going until midnight — then you\'ll have to rest, and we\'ll go over it together.',
    noon: 'Half the day\'s already gone. You\'ve got until midnight, then you rest and we talk it over.',
    dusk: 'Not much of the day left. Midnight comes fast — that\'s when you rest and we go over it.',
    midnight: 'Late, then. You\'ve got the rest of tonight and all of tomorrow before you have to rest — midnight after next.',
  },
  city: {
    nyc: "That's right. The grid, the steam coming up off the street, the water towers on every roof.",
    tokyo: "That's right. The trains, the crossings, the signs stacked all the way up the walls.",
  },
  year: {
    1900: 'Of course. Gaslight and horses. The tallest things in town were church spires.',
    2000: 'Of course. Payphones and pagers. Everyone was waiting for the clocks to break.',
    2100: 'Of course. The towers had gotten so tall by then, and the cars had stopped touching the ground.',
  },
  weather: {
    rain: 'Yes. The streets were shining with it.',
    clear: 'Yes. Not a cloud. You could see all the way across.',
    heat: 'Yes. The tar went soft on the roofs and every hydrant on the block was open.',
    fog: 'Yes. You could barely see the end of the block.',
    snow: 'Yes. Everything went quiet under it.',
  },
  time: {
    dawn: 'The sun was only just coming up.',
    noon: 'Right in the middle of the day.',
    dusk: 'The light was going gold, then going.',
    midnight: 'Late. Most of the windows were still lit.',
  },
};

// World settings for a partial memory. `stage` counts answered layers: 1 city, 2 year,
// 3 season + weather, 4 time of day. Unanswered layers stay as white clay in a white haze.
export const HAZE = { label: 'Memory', background: 0xefe9dc, fog: 0xefe9dc, hemi: [0xffffff, 0xd8cfc0, 3.2], sun: [0xfff6e8, 1.6, [120, 300, 160]], lit: 0 };
const HAZE_DENSITY = [0.012, 0.0075, 0.005, 0.003];
// Once the weather is remembered, the haze takes on its sky (still no sun or hour yet).
const WEATHER_SKY = { clear: 0xa9cfea, heat: 0x9cc8ec, rain: 0x98a6b2, fog: 0xd4d6d2, snow: 0xe4ebf0 };
const mixHex = (a, b, t) => { const c = (x, s) => (x >> s) & 255, m = (s) => Math.round(c(a, s) + (c(b, s) - c(a, s)) * t) << s; return m(16) | m(8) | m(0); };

export function worldSettings(m) {
  const stage = [m.city, m.year, m.weather, m.time].filter(Boolean).length;
  const look = composeLook({ city: m.city, era: m.year, season: m.weather ? m.season : null });
  const sky = m.weather && WEATHER_SKY[m.weather];
  const time = m.time ? m.time : sky
    ? { ...HAZE, background: mixHex(HAZE.background, sky, 0.75), fog: mixHex(HAZE.fog, sky, 0.6), fogDensity: HAZE_DENSITY[3] }
    : { ...HAZE, fogDensity: HAZE_DENSITY[Math.min(stage, 3)] };
  return { stage, look, time, weather: m.weather || 'clear', kit: stage >= 2 };
}

export function describe(m) {
  const city = CITIES.find((c) => c.id === m.city)?.label || 'the city';
  return `${city}, ${m.year}. ${SEASONS[m.season]?.label || ''} ${WEATHERS[m.weather]?.label.toLowerCase() || ''}, ${TIMES[m.time]?.label.toLowerCase() || ''}.`.replace(/\s+/g, ' ');
}

// The things you might have been doing. `mode` names the minigame in modes.js; the
// ride depends on the year where that is funnier.
export const ACTIVITIES = [
  { id: 'skate', glyph: 'skate', colour: '#f2a93b', label: 'Skateboarding', hint: 'I was skateboarding through the city.' },
  { id: 'race', glyph: 'race', colour: '#e0322b', label: 'Street race', hint: 'I was driving in a car race.' },
  { id: 'heist', glyph: 'heist', colour: '#2b2f3a', label: 'The heist', hint: 'I was breaking into a museum to steal a jewel.' },
  { id: 'aliens', glyph: 'aliens', colour: '#3fb37f', label: 'Alien invasion', hint: 'I was defending the city from aliens with my superpowers.' },
  { id: 'patrol', glyph: 'patrol', colour: '#2b62a6', label: 'Street patrol', hint: 'I was patrolling the streets, fighting crime.' },
  { id: 'pizza', glyph: 'pizza', colour: '#d9621f', label: 'Pizza run', hint: 'I was delivering pizzas.' },
  { id: 'taxi', glyph: 'taxi', colour: '#f6b90c', label: 'Cab driver', hint: 'I was driving a cab, and everyone was late.' },
  { id: 'shop', glyph: 'shop', colour: '#c8553d', label: 'Pizza shop', hint: 'I was working the counter at the pizzeria.' },
  { id: 'kaiju', glyph: 'kaiju', colour: '#4a5d3a', label: 'The monster', hint: 'Something enormous came out of the river.' },
  { id: 'roam', glyph: 'roam', colour: '#6b5b95', label: 'Just wander', hint: 'Nothing much. I was just walking around.' },
];
export const ERA_LABEL = Object.fromEntries(Object.entries(ERAS).map(([k, v]) => [k, v.label]));

export function rankFor(score, [s, a, b, c]) {
  return score >= s ? 'S' : score >= a ? 'A' : score >= b ? 'B' : score >= c ? 'C' : 'D';
}
