import { KIT, FACADES, SWATCH, MASSING, BUDGET, WORLD } from './bible.js';
import { footprint } from './zoning.js';
import { validate } from './validate.js';

// The fast path for a reshape request: Jev reads the prompt into typed knobs (one call,
// ~300 ms), code turns the knobs on every parcel deterministically. No generation. Every
// knob maps onto a field the contracts already have; a knob that needs a new part or
// material is a bible change, not a knob. Haiku is asked only when no knob moves.
const ROOF_PARTS = ['waterTower', 'billboardFrame', 'antenna', 'chimney', 'hvacBox', 'roofTank', 'rooftopShack'];
const plain = (s) => s.replace(/([A-Z])/g, ' $1').toLowerCase();
const onOff = (what) => ({ on: `${what} on.`, off: `${what} off.`, keep: `${what} not mentioned.` });

// name → { ask (a Jev Choice), say (plain words for the panel), apply (edit the row in place) }
export const KNOBS = {
  material: {
    ask: { instructions: 'Which wall material does the request ask for? `keep` if it says nothing about colour, material or stone/brick.', criteria: { ...Object.fromEntries(FACADES.map((f) => [f, SWATCH[f]])), keep: 'No material or colour asked for.' } },
    say: (v) => SWATCH[v],
    apply: (r, v) => { r.fill.material = v; },
  },
  height: {
    ask: { instructions: 'Does the request ask for the buildings to be taller, shorter, or does it not mention height?', criteria: { taller: 'Taller, higher, towers, skyscrapers.', shorter: 'Shorter, lower, squat, low-rise.', keep: 'Height not mentioned.' } },
    say: (v) => v,
    apply: (r, v, brief) => {
      const top = r.fill.tiers[r.fill.tiers.length - 1].h;
      const target = v === 'taller' ? brief.heightTarget : Math.max(6, Math.round(top * 0.5));
      r.fill.tiers = r.fill.tiers.map((t) => ({ ...t, h: Math.round(t.h * target / top) }));
      if (v === 'taller' && brief.maxTiers > 1 && (r.fill.tiers.length === 1 || target > MASSING.slabMinHeight)) r.fill.tiers = stepped(target, brief);
      if (v === 'shorter' && r.fill.tiers.length > 1 && target <= MASSING.troughMax) r.fill.tiers = [{ h: target, inset: 0 }];
    },
  },
  massing: {
    ask: { instructions: 'Does the request ask for stepped-back (wedding-cake, setback, tiered) buildings or for plain slabs (straight up, no setbacks)?', criteria: { stepped: 'Setbacks, tiers, wedding-cake, stepped.', slab: 'Straight up, a plain slab, no setbacks.', keep: 'Shape not mentioned.' } },
    say: (v) => (v === 'stepped' ? 'stepped setbacks' : 'plain slabs'),
    apply: (r, v, brief) => { const top = r.fill.tiers[r.fill.tiers.length - 1].h; r.fill.tiers = v === 'stepped' && brief.maxTiers > 1 ? stepped(top, brief) : [{ h: top, inset: 0 }]; },
  },
  roofEdge: {
    ask: { instructions: 'Does the request ask for a cornice (a decorative lip along the roof line) or a plain parapet wall on top?', criteria: { cornice: 'Cornices, decorative roof lines, old-fashioned tops.', parapet: 'Plain parapets, flat modern tops.', keep: 'Roof edge not mentioned.' } },
    say: (v) => `${v}s`,
    apply: (r, v) => { r.fill.parapet = v; for (const w of Object.values(r.facade.walls)) w.cornice = v === 'cornice'; },
  },
  windows: {
    ask: { instructions: 'Does the request ask for more lit windows (brighter, lively, awake) or fewer (darker, dead, asleep)?', criteria: { brighter: 'More windows lit.', dimmer: 'Fewer windows lit.', keep: 'Window light not mentioned.' } },
    say: (v) => (v === 'brighter' ? 'more lit windows' : 'darker windows'),
    apply: (r, v) => { r.fill.warmth = v === 'brighter' ? 0.6 : 0.02; },
  },
  roof: {
    ask: { instructions: 'Does the request ask for bare roofs — everything taken off the roofs?', criteria: { clear: 'Clear the roofs, bare roofs, nothing on top.', keep: 'Not asked (things being added to roofs is not this).' } },
    say: () => 'roofs cleared',
    apply: (r) => { r.roof.parts = []; },
  },
  ...Object.fromEntries(ROOF_PARTS.map((part) => [`roof_${part}`, {
    noul: { instructions: `Does the request ask for ${plain(part)}s on the roofs?`, criteria: { true: `Yes, ${plain(part)}s are asked for.`, false: `No, ${plain(part)}s are not mentioned.` } },
    say: () => `${plain(part)}s on the roofs`,
    apply: (r, v, brief) => want(r, part, brief),
  }])),
  fireEscapes: { ask: { instructions: 'Does the request ask for fire escapes on the street walls, or for them gone?', criteria: onOff('Fire escapes') }, say: (v) => `fire escapes ${v}`, apply: (r, v) => wall(r, 'fireEscape', v === 'on') },
  storefronts: { ask: { instructions: 'Does the request ask for shops / storefronts at street level, or for none?', criteria: onOff('Shops at street level') }, say: (v) => `shops ${v}`, apply: (r, v) => { wall(r, 'storefront', v === 'on'); if (v === 'off') wall(r, 'awning', false); } },
  awnings: { ask: { instructions: 'Does the request ask for awnings over the shopfronts, or for none?', criteria: onOff('Awnings') }, say: (v) => `awnings ${v}`, apply: (r, v) => { wall(r, 'awning', v === 'on'); if (v === 'on') wall(r, 'storefront', true); } },
  scaffolding: { ask: { instructions: 'Does the request ask for scaffolding on the walls, or for it gone?', criteria: onOff('Scaffolding') }, say: (v) => `scaffolding ${v}`, apply: (r, v) => wall(r, 'scaffolding', v === 'on') },
};
export const KNOB_NAMES = Object.keys(KNOBS);
export const KNOB_QUESTIONS = {
  ...Object.fromEntries(KNOB_NAMES.map((n) => [n, KNOBS[n].noul ? { type: 'noul', ...KNOBS[n].noul } : { type: 'choice', ...KNOBS[n].ask }])),
  needsModel: { type: 'noul', instructions: 'Does the request ask for something the knobs above cannot express (a specific style, era, place, mood, or arrangement beyond materials, height, massing, roof edge, window light, roof things and wall fittings)?', criteria: { true: 'Yes — the knobs would miss the point of the request.', false: 'No — the knobs cover what was asked.' } },
};
export const KNOB_MIN = 0.65;   // a Choice below this confidence reads as `keep` (misreads sat at 0.54–0.60, real ones ≥ 0.81)
export const NOUL_ON = 0.7;     // a roof-part Noul at or above this means "wanted"

export function readKnobs(answers) {
  const k = Object.fromEntries(KNOB_NAMES.map((n) => {
    const a = answers[n]; if (!a) return [n, 'keep'];
    if (KNOBS[n].noul) return [n, a.noul >= NOUL_ON ? 'on' : 'keep'];
    return [n, a.confidence >= KNOB_MIN ? a.choice : 'keep'];
  }));
  k.needsModel = answers.needsModel ? answers.needsModel.noul : 0;
  return k;
}
export const knobsMoved = (k) => KNOB_NAMES.some((n) => k[n] !== 'keep');
export const describeKnobs = (k) => KNOB_NAMES.filter((n) => k[n] !== 'keep').map((n) => KNOBS[n].say(k[n])).join(', ');

// The player's height wish overrides the brief's target, within the world's ceiling: a
// reshape is allowed to be a visible change. HEADROOM is how far above the brief it may go.
export const HEADROOM = 1.75;
export function reshapeBrief(brief, k) {
  if (k.height === 'taller') return { ...brief, heightTarget: Math.min(MASSING.maxHeight, WORLD.ceiling - 12, Math.round(brief.heightTarget * HEADROOM)), maxTiers: Math.max(brief.maxTiers, brief.w >= 14 ? 2 : 1) };
  return brief;
}

// Apply the knobs to one parcel, one knob at a time; a knob whose edit breaks a rule is
// undone on its own, so the row stays legal and the other knobs still land.
export function applyKnobs(brief0, current, k) {
  const brief = reshapeBrief(brief0, k);
  const clone = (r) => JSON.parse(JSON.stringify(r));
  let row = clone({ fill: current.fill, roof: current.roof, facade: current.facade });
  for (const n of KNOB_NAMES) {
    if (k[n] === 'keep') continue;
    const next = clone(row); KNOBS[n].apply(next, k[n], brief);
    if (legal(next, brief)) row = next;
  }
  // A height or massing change may have moved the roof out from under its parts.
  row.roof.parts = row.roof.parts.filter((p) => validate('RoofDressing', { lot: brief.id, parts: [p] }, brief, { fill: row.fill }).ok);
  return { ...row, _reshaped: true };   // build.js re-validates with the headroom brief
}
function legal(r, brief) {
  if (!validate('LotFill', r.fill, brief).ok) return false;
  const parts = r.roof.parts.filter((p) => validate('RoofDressing', { lot: brief.id, parts: [p] }, brief, { fill: r.fill }).ok);
  return validate('RoofDressing', { ...r.roof, parts }, brief, { fill: r.fill }).ok && validate('Facade', r.facade, brief).ok;
}

function stepped(top, brief) {
  const n = Math.min(brief.maxTiers, top > MASSING.slabMinHeight ? 3 : 2);
  return n === 3 ? [{ h: Math.round(top * 0.45), inset: 0 }, { h: Math.round(top * 0.75), inset: MASSING.tierInset[1] }, { h: top, inset: MASSING.tierInset[2] }] : [{ h: Math.round(top * 0.6), inset: 0 }, { h: top, inset: MASSING.tierInset[1] }];
}
function wall(r, key, on) { for (const w of Object.values(r.facade.walls)) w[key] = on; }

// Put up to two of a wanted part on the roof; if it will not fit beside what is there, the
// wish wins and the roof is cleared first.
function want(r, part, brief) {
  r.roof.parts = r.roof.parts.filter((p) => validate('RoofDressing', { lot: brief.id, parts: [p] }, brief, { fill: r.fill }).ok);
  if (r.roof.parts.some((p) => p.part === part)) return;
  if (!place(part, [], brief, r.fill)) return;   // cannot fit this roof at all (too low, too high, too small)
  if (!place(part, r.roof.parts, brief, r.fill)) r.roof.parts = [];
  for (let n = 0; n < 2 && r.roof.parts.length < BUDGET.partsPerRoof; n++) {
    const placed = place(part, r.roof.parts, brief, r.fill);
    if (!placed) break;
    r.roof.parts.push(placed);
  }
}

// First free spot on the top tier for a part, scanning a coarse grid from the centre out.
export function place(part, parts, brief, fill) {
  const top = fill.tiers[fill.tiers.length - 1];
  const w = brief.w - 2 * top.inset, d = brief.d - 2 * top.inset;
  const k = KIT[part];
  if ((k.minRoof && top.h < k.minRoof) || (k.maxRoof && top.h > k.maxRoof)) return null;
  for (const rot of [0, 1]) {
    const [pw, pd] = footprint(part, rot);
    if (pw + 1 > w || pd + 1 > d) continue;
    const xs = [], zs = [];
    for (let x = 0; x <= (w - pw) / 2 - 0.5; x += 1.5) xs.push(x, -x);
    for (let z = 0; z <= (d - pd) / 2 - 0.5; z += 1.5) zs.push(z, -z);
    for (const z of zs) for (const x of xs) {
      const candidate = { part, x: +x.toFixed(1), z: +z.toFixed(1), rot };
      if (validate('RoofDressing', { lot: brief.id, parts: [...parts, candidate] }, brief, { fill }).ok) return candidate;
    }
  }
  return null;
}
