import { PALETTE } from './bible.js';

// A look is a city's recipe, written once: colours, which rooftop and wall pieces it uses,
// how tall its narrow buildings run, and its signs. build.js applies it after a row is
// validated, so stored rows and live reshapes work under every look.
//   palette      material name → colour; merged over the bible's PALETTE
//   roofSwap     roof part → the part this city uses in its place (missing = keep)
//   walls        wall parts this city does without
//   narrowLift   height multiplier for parcels of 1–2 lots (thin towers); wideLift for the rest
//   signs        neon on street walls: blade signs sticking out, strips over the ground floor;
//                `districts` limits them to those districts (missing = everywhere)
//   skyGlow      [colour, fog strength, sky strength (default: fog's)]: city light on the air and low cloud
export const LOOKS = {
  nyc: {
    label: 'New York',
    palette: {},
    roofSwap: {},
    walls: {},
    narrowLift: 1, wideLift: 1,
    signs: { colours: ['neonRed', 'neonAmber', 'neonCyan', 'neonPink'], bladeChance: 0.6, bladeMax: 14, stripChance: 0.45, roofChance: 0.5, districts: ['midtown'] },
    skyGlow: [0xe0904a, 0.18, 0.03],   // sodium-lamp haze: thick in the fog, a trace in the sky
  },
  tokyo: {
    label: 'Tokyo',
    palette: {
      facade0: 0xb9b6ad, facade1: 0x8e949a, facade2: 0xd4d0c4, facade3: 0x6f7a80, facade4: 0x3e464f,
      trim: 0x2a2f36, stone: 0x80868b,
      window: 0x7fa6b5, windowLit: 0xf2f4ff,
      asphalt: 0x1d2229, cab: 0xd8d8d0,
    },
    roofSwap: { waterTower: 'hvacBox', roofTank: 'hvacBox', chimney: 'antenna' },
    walls: { fireEscape: false, cornice: false },
    narrowLift: 1.55, wideLift: 1.12,
    signs: { colours: ['neonPink', 'neonCyan', 'neonAmber', 'neonGreen'], bladeChance: 0.85, stripChance: 0.7, roofChance: 0.45 },
    skyGlow: [0x7a3d78, 0.22],   // neon light on low cloud
  },
};
export const LOOK_IDS = Object.keys(LOOKS);
export const DEFAULT_LOOK = 'nyc';

export const NEON = { neonPink: 0xff3d8b, neonCyan: 0x39e6ff, neonAmber: 0xffb03a, neonGreen: 0x6dff8a, neonRed: 0xff3b30 };

// Street-level materials shared by every city: paint, lamps, trees, vehicles. Kept out of the
// bible's closed palette because fill rows never use them; street.js and the park draw them.
export const STREET = {
  paintWhite: 0xd9d8cf, paintYellow: 0xe8b81c,
  lamp: 0xffb95e, crown: 0xffe2b0, subwayGlobe: 0x46e07a, steamStack: 0xd9621f,
  grass: 0x3f6d3a, leaf: 0x2f6236, trunk: 0x4a3826, path: 0x8a7f6a,
  bus: 0x2b62a6, glass: 0x2e4152, carDark: 0x20242a, carSilver: 0x8b929b, carRed: 0x7d2a27, carBlue: 0x2b3d5c,
};
export const GLOW = ['lamp', 'crown', 'subwayGlobe'];

// A look may be passed whole (Remind Me composes one per memory) instead of by id.
export function lookFor(id) { return typeof id === 'object' && id ? id : LOOKS[id] || LOOKS[DEFAULT_LOOK]; }
export function paletteFor(id) { return { ...PALETTE, ...NEON, ...STREET, ...lookFor(id).palette }; }
