import { SKY } from './bible.js';

// Conditions change the sky and the air, never the buildings — except how many windows are
// lit, which build.js reads as `lit` (a multiplier on each row's warmth).
//   background/fog  colours; fogDensity is multiplied by the weather's
//   hemi            [sky colour, ground colour, intensity]; sun = [colour, intensity, position]
export const TIMES = {
  dusk:     { label: 'Dusk',     background: 0x6a5a7a, fog: 0x8a6f7c, fogDensity: 0.0022, hemi: [0xffd3b0, 0x5d4a52, 2.4], sun: [0xff9a5c, 3.2, [-260, 90, -120]], lit: 0.45 },
  evening:  { label: 'Evening',  background: 0x33496b, fog: 0x3f5577, fogDensity: 0.0025, hemi: [0xc2d8ff, 0x6d5a52, 2.1], sun: [0xffb87a, 2.7, [-200, 160, -170]], lit: 0.8 },
  midnight: { label: 'Midnight', background: SKY.background, fog: SKY.fog, fogDensity: SKY.fogDensity, hemi: SKY.hemi, sun: SKY.sun, lit: 1 },
  late:     { label: '3 AM',     background: 0x0e1726, fog: 0x172335, fogDensity: 0.003, hemi: [0x7f97c4, 0x2c2a33, 1.3], sun: [0x9fb4ff, 1.1, [120, 240, -200]], lit: 0.4 },
  noon:     { label: 'Noon',     background: 0x7fb4e0, fog: 0xb4d0e4, fogDensity: 0.0019, hemi: [0xf4f8ff, 0x7a6a58, 3.1], sun: [0xfff1d6, 3.4, [160, 300, 120]], lit: 0.04 },
  dawn:     { label: 'Dawn',     background: 0xa9b8c8, fog: 0xbcc3c9, fogDensity: 0.0024, hemi: [0xf4e6d6, 0x6c6258, 2.7], sun: [0xffd6a0, 3.4, [240, 70, 160]], lit: 0.12 },
};
export const TIME_IDS = Object.keys(TIMES);
export const DEFAULT_TIME = 'midnight';

//   fog       multiplier on the time's fog density; tint pulls the fog colour toward grey-white
//   particles falling streaks (rain) or flakes (snow) in a box that follows the camera
//   wet       lowers the street's roughness so it catches light
//   sky       a colour the sky and air lean toward (a heat wave's hot blue haze), with heat
//             brightening and warming the sun
export const WEATHERS = {
  clear: { label: 'Clear', fog: 0.75, tint: 0, particles: null, wet: false },
  heat:  { label: 'Heat wave', fog: 0.6, tint: 0, particles: null, wet: false, sky: [0x8ec5f0, 0.35], heat: 0.35 },
  rain:  { label: 'Rain',  fog: 1.7, tint: 0.15, particles: { kind: 'rain', count: 5000, fall: 38, drift: 2, length: 1.4, colour: 0xaecbe0, opacity: 0.45 }, wet: true },
  fog:   { label: 'Fog',   fog: 4.2, tint: 0.45, particles: null, wet: true },
  snow:  { label: 'Snow',  fog: 2, tint: 0.35, particles: { kind: 'snow', count: 4000, fall: 3.2, drift: 1.4, size: 0.35, colour: 0xf4f6fa, opacity: 0.9 }, wet: false },
};
export const WEATHER_IDS = Object.keys(WEATHERS);
export const DEFAULT_WEATHER = 'clear';

export function timeFor(id) { return typeof id === 'object' && id ? id : TIMES[id] || TIMES[DEFAULT_TIME]; }
export function weatherFor(id) { return typeof id === 'object' && id ? id : WEATHERS[id] || WEATHERS[DEFAULT_WEATHER]; }
