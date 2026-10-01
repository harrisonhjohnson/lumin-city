import { LOOKS, paletteFor } from './looks.js';

// Year and season, layered over a city's look. composeLook() returns a whole look object
// (build.js and scene.js take one in place of an id), so any city × era × season works
// without writing out every combination.
//   palette   merged over the city's palette (byCity wins for that city)
//   lift      multiplier on the city's narrow/wide lifts
//   signs     false = no neon; an object replaces the city's signs
//   traffic   street.js traffic style
export const ERAS = {
  1900: {
    label: '1900',
    palette: {
      facade0: 0x7a4636, facade1: 0x5a3a2c, facade2: 0x6b6358, facade3: 0xb3a78e, facade4: 0x8f7650,
      trim: 0x2b2420, stone: 0x777066, window: 0x4f5a5c, windowLit: 0xf0b860,
      asphalt: 0x4a4640, water: 0x3a4a50, lamp: 0xffd98a, paintWhite: 0x4a4640, paintYellow: 0x4a4640,
      carDark: 0x2a1f1a, carRed: 0x3b2418, carSilver: 0x4a3a2a, bus: 0x3b2c20, glass: 0x1c1714,
    },
    byCity: { tokyo: { facade0: 0x4a3426, facade1: 0x6b4a32, facade2: 0xcfc3a8, facade3: 0x3a2c22, facade4: 0x8a6a48, trim: 0x1e1814, stone: 0x6a655c } },
    lift: 0.5, signs: false,
    traffic: { cabs: false, buses: false, colours: ['carDark', 'carRed', 'carSilver'] },
    skyGlow: [0xc9a26b, 0.3, 0.12],
  },
  2000: { label: '2000' },
  2100: {
    label: '2100',
    palette: {
      facade0: 0x2c3440, facade1: 0x3b4b5c, facade2: 0xcfd8e0, facade3: 0x9aa7b4, facade4: 0x1f2530,
      trim: 0x14181e, stone: 0x5a6470, window: 0x5fd4ff, windowLit: 0xbff6ff,
      asphalt: 0x15191f, lamp: 0x7ff0ff, carDark: 0xe8eef2, carSilver: 0x39e6ff, carRed: 0xff3d8b, carBlue: 0x6dff8a, glass: 0x0b1a26,
    },
    lift: 1.7,
    signs: { colours: ['neonCyan', 'neonPink', 'neonGreen'], bladeChance: 0.9, stripChance: 0.8, roofChance: 0.6 },
    traffic: { lift: 14, cabs: false, buses: false, colours: ['carDark', 'carSilver', 'carRed', 'carBlue'] },
    skyGlow: [0x3fd0ff, 0.2, 0.08],
  },
};
export const ERA_IDS = Object.keys(ERAS);

export const SEASONS = {
  spring: { label: 'Spring', palette: { leaf: 0xe9a8c0, grass: 0x5e9a4a }, weathers: [['rain', 'April showers'], ['clear', 'Bright and clear']] },
  summer: { label: 'Summer', palette: { leaf: 0x3f7d3a, grass: 0x4f8a3f }, weathers: [['heat', 'A heat wave'], ['rain', 'A thunderstorm']] },
  autumn: { label: 'Autumn', palette: { leaf: 0xd4702a, grass: 0x7d7a3a }, weathers: [['fog', 'Thick fog'], ['rain', 'Cold rain']] },
  winter: { label: 'Winter', palette: { leaf: 0xe6ecf0, grass: 0xdfe6ea, path: 0xcfd6da }, weathers: [['snow', 'Snowing'], ['clear', 'Crisp and clear']] },
};
export const SEASON_IDS = Object.keys(SEASONS);

// Unanswered layers stay as white clay, like an architect's model: the city is there, but
// not yet remembered. Every colour becomes one of a few warm off-whites.
const CLAY = [0xf3eee4, 0xe9e2d4, 0xded6c6, 0xf7f3ea, 0xe4dccb];
function clay(palette) {
  const out = {};
  Object.keys(palette).forEach((k, i) => { out[k] = CLAY[i % CLAY.length]; });
  return { ...out, asphalt: 0xd9d1c1, stone: 0xe2dbcc, water: 0xcfd6d6, window: 0xe2dbcc, windowLit: 0xe2dbcc, trim: 0xcfc6b4 };
}

export function composeLook({ city = 'nyc', era = null, season = null } = {}) {
  const base = LOOKS[city] || LOOKS.nyc;
  const E = era ? ERAS[era] : null, S = season ? SEASONS[season] : null;
  const palette = { ...base.palette, ...E?.palette, ...E?.byCity?.[city], ...S?.palette };
  const lift = E?.lift ?? 1;
  const look = {
    ...base,
    label: [base.label, E?.label].filter(Boolean).join(', '),
    palette,
    narrowLift: base.narrowLift * lift, wideLift: base.wideLift * lift,
    liftLandmarks: lift !== 1,
    signs: E?.signs === false ? null : E?.signs ? { ...base.signs, ...E.signs, districts: undefined } : base.signs,
    traffic: E?.traffic || {},
    skyGlow: E?.skyGlow || base.skyGlow,
  };
  if (!E) return { ...look, palette: clay(paletteFor(look)), signs: null, skyGlow: null, traffic: { none: true } };
  if (!S) {
    const full = paletteFor(look), c = clay(full);
    return { ...look, palette: { ...palette, leaf: c.leaf, grass: c.grass, trunk: c.trunk, path: c.path } };
  }
  return look;
}
