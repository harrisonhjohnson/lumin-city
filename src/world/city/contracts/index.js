import { KIT, KIT_NAMES, FACADES, BUDGET, LANDMARK_IDS, COPY, HUNT, MASSING } from '../bible.js';

// One contract per thing a cheap model may emit. Each is a tiny schema: field → check.
// `describe()` renders the schema for a prompt; validators in ../validate.js use `check`.
const str = (max) => (v) => typeof v === 'string' && v.length > 0 && v.length <= max;
const num = (lo, hi) => (v) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const oneOf = (list) => (v) => list.includes(v);
const bool = (v) => typeof v === 'boolean';
const list = (item, max) => (v) => Array.isArray(v) && v.length <= max && v.every(item);
const obj = (shape) => (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.entries(shape).every(([k, f]) => f(v[k])) && Object.keys(v).every((k) => k in shape);

export const CONTRACTS = {
  LotFill: {
    purpose: 'Massing for one parcel: tier tops in metres (rising, last one = full height), footprint inset per tier, facade material, share of lit windows, roof edge style.',
    shape: {
      lot: str(40),
      tiers: list(obj({ h: num(4, MASSING.maxHeight), inset: num(0, 12) }), BUDGET.tiersPerBuilding),
      material: oneOf(FACADES),
      warmth: num(0, 0.6),
      parapet: oneOf(['cornice', 'parapet']),
    },
    doc: `{ lot, tiers: [{h, inset}] (1–${BUDGET.tiersPerBuilding}, h rising, inset non-decreasing, last h ≤ brief.heightTarget), material: ${FACADES.join('|')}, warmth 0–0.6, parapet: cornice|parapet }`,
  },
  RoofDressing: {
    purpose: 'Parts on one roof, positions relative to the roof centre in metres, rot in quarter turns.',
    shape: {
      lot: str(40),
      parts: list(obj({ part: oneOf(KIT_NAMES.filter((n) => KIT[n].on === 'roof')), x: num(-60, 60), z: num(-20, 20), rot: oneOf([0, 1, 2, 3]) }), BUDGET.partsPerRoof),
    },
    doc: `{ lot, parts: [{part: ${KIT_NAMES.filter((n) => KIT[n].on === 'roof').join('|')}, x, z, rot 0–3}] (≤ ${BUDGET.partsPerRoof}, inside the roof, no overlaps, part.minRoof ≤ roof height) }`,
  },
  Facade: {
    purpose: 'What the street-facing walls carry.',
    shape: {
      lot: str(40),
      walls: (v) => v && typeof v === 'object' && Object.keys(v).length <= 2 && Object.entries(v).every(([face, w]) => ['north', 'south', 'east', 'west'].includes(face) && obj({ fireEscape: bool, storefront: bool, awning: bool, scaffolding: bool, cornice: bool })(w)),
    },
    doc: '{ lot, walls: { north|south|east|west: {fireEscape, storefront, awning, scaffolding, cornice} } } (only the brief.facing wall and, for corners, brief.avenueSide)',
  },
  Billboard: {
    purpose: 'Plain words on a rooftop sign.',
    shape: { lot: str(40), copy: str(COPY.billboardMaxChars), color: oneOf(['windowLit', 'cab', 'window']) },
    doc: `{ lot, copy (≤ ${COPY.billboardMaxChars} chars, plain words, no coined phrases), color: windowLit|cab|window }`,
  },
  Clue: {
    purpose: 'One riddle that points at exactly one landmark, in plain spoken English.',
    shape: { landmark: oneOf(LANDMARK_IDS), text: str(HUNT.clueMaxChars), where: oneOf(['site', 'apartment', 'city']) },
    doc: `{ landmark: ${LANDMARK_IDS.join('|')}, text (≤ ${HUNT.clueMaxChars} chars, plain spoken English), where: site|apartment|city }`,
  },
};
export const CONTRACT_NAMES = Object.keys(CONTRACTS);

export function schemaErrors(name, row) {
  const c = CONTRACTS[name];
  if (!c) return [`unknown contract ${name}`];
  if (!row || typeof row !== 'object') return ['row is not an object'];
  const errors = [];
  for (const [k, check] of Object.entries(c.shape)) if (!check(row[k])) errors.push(`${name}.${k} fails: ${c.doc}`);
  for (const k of Object.keys(row)) if (!(k in c.shape)) errors.push(`${name}.${k} is not a field`);
  return errors;
}
