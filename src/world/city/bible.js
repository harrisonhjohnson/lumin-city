// The world bible for the swing city: every rule the generator, the Blender kit, the
// validators and the night fill lane share. Numbers, not vibes — tests import this file.
// Units are metres (1 unit = 1 m). +x east, -z north (the route flies north).

export const SCALE = { unit: 'metre', metresPerUnit: 1 };

// The playable box mirrors the reset bounds in src/room/web-swing.js. Scenery may extend
// past it (the river, the bridge tower); the player may not.
export const WORLD = { x: [-250, 250], z: [-640, 220], ceiling: 230, seed: 812 };

// A closed palette: every material in the city comes from this list, by name.
export const PALETTE = {
  facade0: 0x9a4d3a, facade1: 0x6f4534, facade2: 0x546675, facade3: 0xbcb09a, facade4: 0xa88c62,
  trim: 0x222d39, stone: 0x6c7378,
  window: 0x698f9c, windowLit: 0xe8c792,
  asphalt: 0x26313c, cab: 0xf6b90c, water: 0x24435a,
};
export const FACADES = ['facade0', 'facade1', 'facade2', 'facade3', 'facade4'];
// Plain names for the facades, for anything that reads a player's words (knobs.js).
export const SWATCH = { facade0: 'red brick', facade1: 'dark brownstone', facade2: 'slate blue-grey', facade3: 'pale limestone', facade4: 'buff yellow brick' };
export const SKY = { background: 0x253c5b, fog: 0x314760, fogDensity: 0.0027, hemi: [0xb6d6ff, 0x735d51, 2], sun: [0xffc98b, 2.6, [-160, 240, -180]] };

// PS1 floor: budgets are per unique mesh and per instance count, never per pixel.
export const BUDGET = {
  trisPerPart: 400,        // any kit part
  tiersPerBuilding: 3,     // setback tiers incl. the base
  partsPerRoof: 6,
  partsPerWall: 4,
  instances: 80000,        // all InstancedMesh slots combined
  drawCalls: 60,           // 40 before the street layer (paint, lamps, trees, traffic); ~55 now
};

// Compressed NYC grid. Real Manhattan is ~280 m avenue pitch × 80 m street pitch; the
// avenue pitch is halved so four block columns fit the playable width. The x=0 avenue is
// the route and stays open end to end.
export const BLOCK = {
  avenuePitch: 140, avenueWidth: 30,
  streetPitch: 80, streetWidth: 18,
  lotWidth: 7.6,           // 25 ft
  parcelLots: [1, 8],      // parcels merge 1–8 lots
  sidewalk: 3,
};
export const BUILDABLE = { x: BLOCK.avenuePitch - BLOCK.avenueWidth, z: BLOCK.streetPitch - BLOCK.streetWidth };

// Height field: a low trough around the start, a Midtown peak up the route, Downtown behind
// the start. Setbacks follow the 1916 idea: a tier ends at a multiple of the street width.
export const MASSING = {
  base: 26, noise: 14,
  attractors: [
    { name: 'midtown', z: -330, x: 40, radius: 190, height: 115 },
    { name: 'downtown', z: 190, x: -60, radius: 150, height: 90 },
  ],
  troughMax: 34,           // buildings this low get brownstone treatment (no setbacks)
  tierAt: [1, 1.5, 2],     // tier tops as multiples of streetWidth... scaled by height rank
  tierInset: [0, 4, 8],    // metres pulled back per tier
  slabMinHeight: 80,       // above this a parcel may be a slab-with-plaza instead of tiers
  maxHeight: 170,
};

// Broadway: the one diagonal. Parcels it crosses are dropped; the wedge it leaves at the
// east avenue becomes the flatiron landmark.
export const BROADWAY = { from: [-60, 220], to: [200, -640], width: 22 };

// The kit of parts. The night lane composes these by name and never invents a primitive.
// `on` says where a part may sit; `tris` is the Blender budget; `size` is the AABB [w,h,d];
// `minRoof`/`maxRoof` bound the roof height a part belongs on (the judge found `maxRoof`).
export const KIT = {
  waterTower:    { on: 'roof', tris: 220, size: [3.6, 6.2, 3.6], minRoof: 20 },
  roofTank:      { on: 'roof', tris: 160, size: [3.0, 2.4, 3.0], minRoof: 12 },
  hvacBox:       { on: 'roof', tris: 60,  size: [2.4, 1.4, 2.0], minRoof: 8 },
  stairBulkhead: { on: 'roof', tris: 40,  size: [4.0, 2.6, 5.0], minRoof: 8 },
  rooftopShack:  { on: 'roof', tris: 120, size: [5.0, 3.0, 4.0], minRoof: 8 },
  billboardFrame:{ on: 'roof', tris: 180, size: [12, 6, 1.2],    minRoof: 30 },
  antenna:       { on: 'roof', tris: 90,  size: [0.8, 9, 0.8],   minRoof: 40 },
  chimney:       { on: 'roof', tris: 30,  size: [1.0, 2.2, 1.0], minRoof: 8, maxRoof: 18 },  // walk-ups only
  cornice:       { on: 'wall', tris: 60,  size: [1, 0.7, 0.3] },   // stretched along the wall
  parapet:       { on: 'wall', tris: 24,  size: [1, 1.1, 0.4] },
  fireEscape:    { on: 'wall', tris: 360, size: [3.2, 3.6, 1.1], repeatY: 3.6 },
  storefront:    { on: 'wall', tris: 140, size: [1, 4.2, 0.5] },   // ground floor band
  awning:        { on: 'wall', tris: 50,  size: [3.0, 0.9, 1.6] },
  scaffolding:   { on: 'wall', tris: 400, size: [6.0, 7.2, 1.8] },
  cab:           { on: 'street', tris: 200, size: [1.7, 1.3, 4.0] },
};
export const KIT_NAMES = Object.keys(KIT);

// Landmarks are the addressable places: the hunt, the clues and the night lane's copy all
// refer to them by id, never by coordinates.
export const LANDMARKS = [
  { id: 'spire',     kind: 'tower',     at: [91, -330],  size: [30, 122, 30], note: 'stepped Midtown tower with a spire' },
  { id: 'flatiron',  kind: 'wedge',     at: [105, -420], size: [22, 60, 48], note: 'wedge where Broadway meets the east avenue' },
  { id: 'bridge',    kind: 'bridgeTower', at: [-262, -200], size: [16, 78, 16], note: 'stone bridge tower at the river' },
  { id: 'billboard', kind: 'billboard', at: [70, -250],  size: [24, 12, 2],  note: 'the big lit billboard facing the avenue' },
  { id: 'park',      kind: 'void',      at: [-70, -140], size: [110, 0, 62], note: 'the one green block beside the avenue' },
];
export const LANDMARK_IDS = LANDMARKS.map((l) => l.id);

// The prize is placed by relation to a landmark, so a clue can say it in words.
export const HUNT = {
  relations: ['nearest', 'northOf', 'southOf', 'eastOf', 'westOf'],
  hidingParts: ['waterTower', 'rooftopShack', 'billboardFrame'],
  clueMaxChars: 140,
};

// Copy rules for anything a model writes onto the city (per feedback: plain words only).
export const COPY = { billboardMaxChars: 24, storefrontMaxChars: 18 };

// Window grid, painted by the facade shader (scene.js). Centres: `edge` metres in from a
// wall's end, then every `dx`, stopping `endGap` short of the far end; rows from `sill`
// above the tier's base, every `dy`, stopping `topGap` below its top.
export const WINDOW = { dx: 4.0, dy: 3.6, w: 1.35, h: 1.8, sill: 3, edge: 2, endGap: 1, topGap: 2 };

// Invariants every validator enforces, by name, so a retry prompt can quote them.
export const RULES = {
  nothingFloats: 'a part rests on its roof or on the ground (y == parent top)',
  insideParent: 'a part sits inside its parent footprint, inset by sidewalk on streets',
  noOverlap: 'parts on one roof do not overlap in plan',
  inKit: 'part names come from KIT',
  inPalette: 'material names come from PALETTE',
  budget: 'roof/wall part counts and tiers stay within BUDGET',
  plainCopy: 'copy fits COPY limits and contains no coined phrases',
};

// Where the swing starts: a clear roof on the west side of the route avenue, 24 m up so
// the first rings (26 m, 32 m) are one jump away. The parcel under this point gets it.
export const START = { x: -25, z: 4, roof: 24, eye: 1.6, spawn: [-25, 25.6, 4] };
