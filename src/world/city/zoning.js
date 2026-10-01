import { KIT, MASSING, BLOCK, FACADES, LANDMARKS } from './bible.js';
import { createRng } from './rng.js';

// Default fill rows for a lot brief, used wherever the night lane has not written a valid
// row yet. Everything here is a legal LotFill / RoofDressing / Facade, so the city is
// complete with zero model calls and the fill lane can only ever make it better.

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

export function defaultLotFill(brief) {
  const rng = createRng(hash(brief.id));
  const landmark = LANDMARKS.find((l) => l.id === brief.landmark);
  if (landmark) return landmarkFill(brief, landmark);
  const h = brief.heightTarget;
  const tiers = [];
  if (brief.maxTiers === 1 || h <= MASSING.troughMax) tiers.push({ h, inset: 0 });
  else {
    const n = Math.min(brief.maxTiers, 2 + Number(h > MASSING.slabMinHeight && rng() > 0.5));
    // Setback tops fall at multiples of the street width, like the 1916 resolution.
    const first = Math.min(h - 6, BLOCK.streetWidth * (1 + Math.floor(rng.range(1, 3))));
    tiers.push({ h: first, inset: 0 });
    if (n === 3) tiers.push({ h: Math.round((first + h) / 2), inset: MASSING.tierInset[1] });
    tiers.push({ h, inset: MASSING.tierInset[n - 1] });
  }
  return {
    lot: brief.id,
    tiers,
    material: rng.pick(FACADES),
    warmth: +(0.18 + rng() * 0.2).toFixed(2),
    parapet: h <= MASSING.troughMax ? 'cornice' : rng() > 0.5 ? 'parapet' : 'cornice',
  };
}

function landmarkFill(brief, l) {
  const [w, h] = [l.size[0], l.size[1]];
  // Art Deco wedding cake: a wide base, two deep setbacks, then the spire.
  if (l.kind === 'tower') return { lot: brief.id, tiers: [{ h: Math.round(h * 0.57), inset: 0 }, { h: Math.round(h * 0.85), inset: 5 }, { h: h + 6, inset: 9 }], material: 'facade2', warmth: 0.4, parapet: 'parapet', spire: 31 };
  if (l.kind === 'wedge') return { lot: brief.id, tiers: [{ h, inset: 0 }], material: 'facade3', warmth: 0.3, parapet: 'cornice', wedge: true };
  if (l.kind === 'billboard') return { lot: brief.id, tiers: [{ h: 42, inset: 0 }], material: 'facade0', warmth: 0.3, parapet: 'parapet', billboard: true };
  return { lot: brief.id, tiers: [{ h: Math.max(8, w), inset: 0 }], material: 'facade1', warmth: 0.2, parapet: 'cornice' };
}

// Roof parts by rule, then rejection-sampled so nothing overlaps in plan.
export function defaultRoofDressing(brief, fill) {
  const rng = createRng(hash(brief.id + '/roof'));
  const top = fill.tiers[fill.tiers.length - 1];
  const w = brief.w - 2 * top.inset, d = brief.d - 2 * top.inset;
  const parts = [];
  if (brief.reserved || fill.spire || fill.wedge) return { lot: brief.id, parts };
  const wanted = [];
  if (top.h >= KIT.waterTower.minRoof && rng() > 0.25) wanted.push('waterTower');
  if (top.h >= KIT.waterTower.minRoof && rng() > 0.7) wanted.push('waterTower');
  if (top.h >= KIT.stairBulkhead.minRoof) wanted.push('stairBulkhead');
  if (rng() > 0.4) wanted.push('hvacBox');
  if (top.h >= KIT.antenna.minRoof && rng() > 0.6) wanted.push('antenna');
  if (top.h <= KIT.chimney.maxRoof && rng() > 0.5) wanted.push('chimney');
  if (top.h >= KIT.roofTank.minRoof && rng() > 0.7) wanted.push('roofTank');
  if (rng() > 0.85) wanted.push('rooftopShack');
  for (const part of wanted.slice(0, 6)) {
    const rot = rng.pick([0, 1, 2, 3]);
    const [pw, pd] = footprint(part, rot);
    if (pw + 1 > w || pd + 1 > d) continue;
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = +rng.range(-(w - pw) / 2 + 0.5, (w - pw) / 2 - 0.5).toFixed(1), z = +rng.range(-(d - pd) / 2 + 0.5, (d - pd) / 2 - 0.5).toFixed(1);
      const clear = parts.every((p) => { const [qw, qd] = footprint(p.part, p.rot); return Math.abs(p.x - x) >= (qw + pw) / 2 + 0.3 || Math.abs(p.z - z) >= (qd + pd) / 2 + 0.3; });
      if (clear) { parts.push({ part, x, z, rot }); break; }
    }
  }
  return { lot: brief.id, parts };
}

// Plan-view footprint of a part after its quarter-turn rotation.
export function footprint(part, rot) { const [w, , d] = KIT[part].size; return rot % 2 ? [d, w] : [w, d]; }

export function defaultFacade(brief, fill) {
  const rng = createRng(hash(brief.id + '/facade'));
  const low = fill.tiers[0].h <= MASSING.troughMax;
  const street = brief.facing;
  const walls = {};
  const storefront = rng() > 0.3;
  walls[street] = { fireEscape: low && rng() > 0.35, storefront, awning: storefront && low && rng() > 0.6, scaffolding: rng() > 0.93, cornice: fill.parapet === 'cornice' };
  if (brief.avenueSide) walls[brief.avenueSide] = { fireEscape: false, storefront: true, awning: rng() > 0.5, scaffolding: false, cornice: fill.parapet === 'cornice' };
  return { lot: brief.id, walls };
}
