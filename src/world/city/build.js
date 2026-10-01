import { KIT, BLOCK, BUILDABLE, LANDMARKS, START, WORLD } from './bible.js';
import { streetLife } from './street.js';
import { lots } from './lots.js';
import { defaultLotFill, defaultRoofDressing, defaultFacade } from './zoning.js';
import { AVENUE_XS, STREET_ZS, broadwayX } from './districts.js';
import { createRng } from './rng.js';
import { validate } from './validate.js';
import { reshapeBrief } from './knobs.js';
import { DEFAULT_LOOK, lookFor } from './looks.js';

// Turns briefs + fill rows into flat instance records. No three.js here: the scene file
// only draws what this returns, and the tests count it.
//   boxes[material] = [[x, y, z, w, h, d, ...], ...] cheap primitives (tiers, roads, signs);
//                     facade tiers add [lit, seed, westFrom, eastFrom] for the window shader
//   parts           = [{ part, x, y, z, rot, sx, sz, lot }]   kit instances, scaled where stretched
//   buildings       = [{ minX, maxX, minZ, maxZ, height, lot }]  one AABB per tier, for physics
//   anchors         = [[x, y, z], ...]              web anchor points (tier corners)
const ROT = { north: 0, east: 1, south: 2, west: 3 };
const TRIM_SINK = 0.05, ROOF_LIFT = 0.02;

//   destroyed  lot ids knocked down (Remind Me's kaiju): a low heap of rubble, no tiers, no parts
export function buildCity({ seed = WORLD.seed, briefs = lots(seed), fillFor = () => null, look = DEFAULT_LOOK, lit: litScale = 1, destroyed = null } = {}) {
  const boxes = {}; const push = (m, ...r) => (boxes[m] ||= []).push(r);
  const parts = [], buildings = [], anchors = [], fills = {}, built = {};
  const byRow = groupRows(briefs);
  const L = lookFor(look);

  for (const brief of briefs) {
    if (destroyed?.has(brief.id)) { rubble(brief, push, buildings); continue; }
    // A stored row is used only if it still validates against today's bible; otherwise
    // the zoning default stands in, per field.
    const row = fillFor(brief) || {};
    const b = row._reshaped ? reshapeBrief(brief, { height: 'taller' }) : brief;   // player reshapes get height headroom
    const checked = row.fill && validate('LotFill', row.fill, b).ok ? row.fill : defaultLotFill(brief);
    const roof = row.roof && validate('RoofDressing', row.roof, b, { fill: checked }).ok ? row.roof : defaultRoofDressing(brief, checked);
    const facade = row.facade && validate('Facade', row.facade, b).ok ? row.facade : defaultFacade(brief, checked);
    fills[brief.id] = { fill: checked, roof, facade };   // as validated, before the look: reshape reads these back
    const fill = styled(checked, brief, L);
    built[brief.id] = fill;
    const signs = L.signs && (!L.signs.districts || L.signs.districts.includes(brief.district)) ? L.signs : null;
    const neighbours = byRow.get(rowKey(brief));
    const left = neighbours.find((b) => Math.abs(b.x + b.w / 2 - (brief.x - brief.w / 2)) < 1.2);
    const right = neighbours.find((b) => Math.abs(b.x - b.w / 2 - (brief.x + brief.w / 2)) < 1.2);
    const leftH = left ? built[left.id]?.tiers[0].h ?? left.heightTarget : 0;
    const rightH = right ? built[right.id]?.tiers[0].h ?? right.heightTarget : 0;

    let prevTop = 0;
    fill.tiers.forEach((tier, i) => {
      const w = brief.w - 2 * tier.inset, d = brief.d - 2 * tier.inset, bottom = prevTop, top = tier.h;
      const x = brief.x, z = brief.z;
      // Windows are painted by the facade shader, not built: the record carries what it needs.
      // [.., chance a window is lit, seed, west wall windows start above, east wall above]
      // Party walls only show windows above the neighbour's roof; upper tiers show all.
      const seed = (hashId(brief.id + i) % 10007) / 10007;
      push(fill.material, x, (bottom + top) / 2, z, w, top - bottom, d, fill.warmth * litScale, seed, i > 0 ? 0 : leftH, i > 0 ? 0 : rightH);
      buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: top, lot: brief.id, tier: i });
      for (const cx of [x - w / 2, x + w / 2]) for (const cz of [z - d / 2, z + d / 2]) anchors.push([cx, top + 1.1, cz]);
      // Parapet or cornice along every edge of every tier top, sunk 5 cm into the roof so
      // no face is coplanar with it (coplanar faces flicker).
      const ty = top - TRIM_SINK;
      parts.push({ part: fill.parapet, x, y: ty, z: z - d / 2, rot: 0, sx: w, sz: 1, lot: brief.id });
      parts.push({ part: fill.parapet, x, y: ty, z: z + d / 2, rot: 2, sx: w, sz: 1, lot: brief.id });
      parts.push({ part: fill.parapet, x: x - w / 2, y: ty, z, rot: 3, sx: d, sz: 1, lot: brief.id });
      parts.push({ part: fill.parapet, x: x + w / 2, y: ty, z, rot: 1, sx: d, sz: 1, lot: brief.id });
      prevTop = top;
    });
    if (fill.spire) {
      parts.push({ part: 'spire', x: brief.x, y: prevTop + ROOF_LIFT, z: brief.z, rot: 0, sx: 1, sz: 1, lot: brief.id, h: fill.spire });
      // Floodlit setbacks: a glowing band under every tier top.
      for (const t of fill.tiers) push('crown', brief.x, t.h - 1.6, brief.z, brief.w - 2 * t.inset + 0.3, 1.2, brief.d - 2 * t.inset + 0.3);
    }

    // Roof parts sit on the top tier, coordinates relative to its centre.
    const topTier = fill.tiers[fill.tiers.length - 1];
    for (const p of roof.parts) parts.push({ part: L.roofSwap[p.part] || p.part, x: brief.x + p.x, y: topTier.h + ROOF_LIFT, z: brief.z + p.z, rot: p.rot, sx: 1, sz: 1, lot: brief.id });
    // A lit sign board standing on the street edge of the roof, readable across the skyline.
    if (signs && !brief.landmark && !brief.reserved) {
      const rng = createRng(hashId(brief.id + '/roofsign'));
      if (rng() < signs.roofChance) {
        const d = brief.d - 2 * topTier.inset, w = Math.min(brief.w - 2 * topTier.inset - 1, 9), h = 2.2 + rng() * 2.4;
        const z = brief.z + (brief.facing === 'north' ? -1 : 1) * (d / 2 - 0.8);
        push(signs.colours[Math.floor(rng() * signs.colours.length)], brief.x, topTier.h + 1.4 + h / 2, z, w, h, 0.3);
      }
    }
    if (fill.billboard) parts.push({ part: 'billboardFrame', x: brief.x, y: topTier.h + ROOF_LIFT, z: brief.z, rot: brief.facing === 'north' ? 0 : 2, sx: 2, sz: 1, lot: brief.id, landmark: 'billboard' });

    // Wall parts on the base tier's exposed faces. `wallPoint(face, out, along)` is a point
    // `out` metres outside the face, `along` metres from its centre.
    const base = fill.tiers[0];
    const wallPoint = (face, out, along = 0) => ({
      north: { x: brief.x + along, z: brief.z - brief.d / 2 - out },
      south: { x: brief.x + along, z: brief.z + brief.d / 2 + out },
      east: { x: brief.x + brief.w / 2 + out, z: brief.z + along },
      west: { x: brief.x - brief.w / 2 - out, z: brief.z + along },
    })[face];
    for (const [face, wall] of Object.entries(facade.walls)) {
      const length = face === 'north' || face === 'south' ? brief.w : brief.d;
      const rot = ROT[face];
      if (wall.awning) parts.push({ part: 'awning', ...wallPoint(face, KIT.awning.size[2] / 2, -length / 4), y: 3.2, rot, sx: 1, sz: 1, lot: brief.id });
      if (wall.fireEscape && L.walls.fireEscape !== false) for (let y = 4; y + KIT.fireEscape.repeatY <= base.h; y += KIT.fireEscape.repeatY) parts.push({ part: 'fireEscape', ...wallPoint(face, KIT.fireEscape.size[2] / 2, length / 5), y, rot, sx: 1, sz: 1, lot: brief.id });
      if (wall.scaffolding) parts.push({ part: 'scaffolding', ...wallPoint(face, KIT.scaffolding.size[2] / 2, length / 6), y: 0, rot, sx: 1, sz: 1, lot: brief.id });
      if (signs) neonSigns(face, length, base.h, createRng(hashId(brief.id + face + '/neon')), signs, wallPoint, push);
    }
  }

  // Sidewalk slabs per block; the street layer (paint, lamps, traffic, park) sits on them.
  for (let c = 0; c < AVENUE_XS.length - 1; c++) for (let r = 0; r < STREET_ZS.length - 1; r++) {
    const cx = (AVENUE_XS[c] + AVENUE_XS[c + 1]) / 2, cz = (STREET_ZS[r] + STREET_ZS[r + 1]) / 2;
    push('stone', cx, 0.09, cz, BUILDABLE.x + 2 * BLOCK.sidewalk, 0.18, BUILDABLE.z + 2 * BLOCK.sidewalk);
  }
  const { steam, vehicles } = streetLife(push, parts, seed, L.traffic);

  // The bridge tower stands past the playable box, by the river.
  const bridge = LANDMARKS.find((l) => l.kind === 'bridgeTower');
  if (bridge) {
    const [w, h, d] = bridge.size;
    push('stone', bridge.at[0], h / 2, bridge.at[1], w, h, d);
    push('stone', bridge.at[0], h + 4, bridge.at[1], w * 0.6, 8, d * 0.6);
    buildings.push({ minX: bridge.at[0] - w / 2, maxX: bridge.at[0] + w / 2, minZ: bridge.at[1] - d / 2, maxZ: bridge.at[1] + d / 2, height: h, lot: 'bridge', tier: 0 });
  }

  return { boxes, parts, buildings, anchors, fills, briefs, look, steam, vehicles, start: START.spawn, broadway: { from: [broadwayX(WORLD.z[1]), WORLD.z[1]], to: [broadwayX(WORLD.z[0]), WORLD.z[0]] } };
}

export function countInstances(city) {
  return Object.values(city.boxes).reduce((n, list) => n + list.length, 0) + city.parts.length;
}

// The look's version of a validated row: taller where the city runs tall, and its own
// parapet. Landmarks and the start roof keep their height (the route and the hunt use them),
// unless the look says landmarks follow the era (Remind Me's 1900 has no skyscrapers).
function styled(fill, brief, L) {
  const lift = brief.reserved || (brief.landmark && !L.liftLandmarks) ? 1 : brief.lots <= 2 ? L.narrowLift : L.wideLift;
  const parapet = L.walls.cornice === false && fill.parapet === 'cornice' ? 'parapet' : fill.parapet;
  if (lift === 1 && parapet === fill.parapet) return fill;
  return { ...fill, parapet, tiers: fill.tiers.map((t) => ({ ...t, h: Math.min(WORLD.ceiling - 20, Math.round(t.h * lift * 10) / 10) })) };
}

// Neon on a street wall: blade signs standing out from the wall (read from down the street)
// and a strip over the ground floor. Boxes, not kit parts, so each glows in its own colour.
// Everything sits at least 0.2 m off the wall so nothing shares a plane with it.
function neonSigns(face, length, wallH, rng, signs, wallPoint, push) {
  const alongX = face === 'north' || face === 'south';
  const colour = () => signs.colours[Math.floor(rng() * signs.colours.length)];
  if (wallH > 12 && rng() < signs.bladeChance) {
    for (const along of length > 14 ? [-length / 3, length / 3] : [length / 4]) {
      const h = Math.min(wallH - 7, signs.bladeMax ?? Infinity, 8 + rng() * wallH * 0.6), p = wallPoint(face, 1.35, along);
      push(colour(), p.x, 5 + h / 2, p.z, alongX ? 0.4 : 1.9, h, alongX ? 1.9 : 0.4);
    }
  }
  if (rng() < signs.stripChance) {
    const p = wallPoint(face, 0.3), w = length * (0.5 + rng() * 0.35);
    push(colour(), p.x, 3.8, p.z, alongX ? w : 0.15, 0.35, alongX ? 0.15 : w);
  }
}

// A knocked-down building: a few broken slabs at different heights, still something to land on.
function rubble(brief, push, buildings) {
  const rng = createRng(hashId(brief.id + '/rubble'));
  for (let i = 0; i < 6; i++) {
    const w = brief.w * (0.25 + rng() * 0.35), d = brief.d * (0.25 + rng() * 0.35), h = 0.8 + rng() * 3.5;
    const x = brief.x + (rng() - 0.5) * (brief.w - w), z = brief.z + (rng() - 0.5) * (brief.d - d);
    push(rng() < 0.5 ? 'stone' : 'trim', x, h / 2, z, w, h, d);
    buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h, lot: brief.id, tier: 0 });
  }
}

function rowKey(b) { return `${b.block}/${b.side}`; }
function groupRows(briefs) { const m = new Map(); for (const b of briefs) (m.get(rowKey(b)) || m.set(rowKey(b), []).get(rowKey(b))).push(b); return m; }
function hashId(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
