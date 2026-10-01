import { KIT, BUDGET, RULES, MASSING } from './bible.js';
import { schemaErrors } from './contracts/index.js';

// Deterministic checks, cheapest first. Every error names the rule it broke so a retry
// prompt can quote it. Returns { ok, errors }.
export function validate(name, row, brief, ctx = {}) {
  const errors = schemaErrors(name, row);
  if (errors.length) return { ok: false, errors };
  if (brief && row.lot !== brief.id) errors.push(`lot mismatch: row says ${row.lot}, brief is ${brief.id}`);
  if (name === 'LotFill') lotFill(row, brief, errors);
  if (name === 'RoofDressing') roofDressing(row, brief, errors, ctx.fill);
  if (name === 'Facade') facade(row, brief, errors);
  if (name === 'Billboard' || name === 'Clue') copy(name, row, errors);
  return { ok: errors.length === 0, errors };
}

function lotFill(row, brief, errors) {
  const tiers = row.tiers;
  if (!tiers.length) errors.push('LotFill.tiers is empty');
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].h <= tiers[i - 1].h) errors.push(`${RULES.budget}: tier ${i} top ${tiers[i].h} is not above tier ${i - 1} top ${tiers[i - 1].h}`);
    if (tiers[i].inset < tiers[i - 1].inset) errors.push(`tier ${i} inset ${tiers[i].inset} steps outward; insets never decrease`);
  }
  if (brief) {
    const top = tiers[tiers.length - 1];
    if (top.h > brief.heightTarget * 1.1) errors.push(`${RULES.budget}: height ${top.h} exceeds the brief's ${brief.heightTarget}`);
    if (tiers.length > brief.maxTiers) errors.push(`${RULES.budget}: ${tiers.length} tiers, brief allows ${brief.maxTiers}`);
    for (const t of tiers) if (2 * t.inset >= Math.min(brief.w, brief.d) - 4) errors.push(`${RULES.insideParent}: inset ${t.inset} leaves no footprint on a ${brief.w}×${brief.d} parcel`);
    if (top.h > MASSING.troughMax && tiers.length === 1 && brief.maxTiers > 1 && top.h > MASSING.slabMinHeight) errors.push('a building this tall needs at least one setback');
  }
}

// With the parcel's LotFill in `fill`, parts are checked against the top tier's footprint
// and height; without it, against the brief's base footprint.
function roofDressing(row, brief, errors, fill) {
  const parts = row.parts;
  if (parts.length > BUDGET.partsPerRoof) errors.push(`${RULES.budget}: ${parts.length} roof parts, max ${BUDGET.partsPerRoof}`);
  const top = fill ? fill.tiers[fill.tiers.length - 1] : { h: brief ? brief.heightTarget : 999, inset: 0 };
  const w = (brief ? brief.w : 120) - 2 * top.inset, d = (brief ? brief.d : 40) - 2 * top.inset, roofH = top.h;
  const eps = 1e-6;
  for (const p of parts) {
    const k = KIT[p.part];
    if (!k) { errors.push(`${RULES.inKit}: ${p.part}`); continue; }
    const [pw, , pd] = p.rot % 2 ? [k.size[2], 0, k.size[0]] : k.size;
    if (Math.abs(p.x) + pw / 2 > w / 2 + eps || Math.abs(p.z) + pd / 2 > d / 2 + eps) errors.push(`${RULES.insideParent}: ${p.part} at (${p.x}, ${p.z}) hangs past a ${w}×${d} roof`);
    if (k.minRoof && roofH < k.minRoof) errors.push(`${p.part} needs a roof ≥ ${k.minRoof} m; this one is ${roofH}`);
    if (k.maxRoof && roofH > k.maxRoof) errors.push(`${p.part} belongs on roofs ≤ ${k.maxRoof} m (walk-ups); this one is ${roofH}`);
  }
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j], ka = KIT[a.part], kb = KIT[b.part];
    if (!ka || !kb) continue;
    const [aw, , ad] = a.rot % 2 ? [ka.size[2], 0, ka.size[0]] : ka.size, [bw, , bd] = b.rot % 2 ? [kb.size[2], 0, kb.size[0]] : kb.size;
    if (Math.abs(a.x - b.x) < (aw + bw) / 2 && Math.abs(a.z - b.z) < (ad + bd) / 2) errors.push(`${RULES.noOverlap}: ${a.part} and ${b.part} overlap`);
  }
}

function facade(row, brief, errors) {
  if (!brief) return;
  const allowed = [brief.facing, brief.avenueSide].filter(Boolean);
  for (const face of Object.keys(row.walls)) if (!allowed.includes(face)) errors.push(`${RULES.insideParent}: wall ${face} is a party wall on ${brief.id}; allowed: ${allowed.join(', ')}`);
  for (const [face, w] of Object.entries(row.walls)) {
    if (w.fireEscape && brief.heightTarget < 8) errors.push(`fire escape on ${face} needs ≥ 8 m of wall`);
    if (w.awning && !w.storefront) errors.push(`awning on ${face} needs a storefront under it`);
  }
}

const COINED = /\b(vibe|vibes|realm|journey|unlock|elevate|synergy|seamless|curated)\b/i;
function copy(name, row, errors) {
  const text = name === 'Billboard' ? row.copy : row.text;
  if (COINED.test(text)) errors.push(`${RULES.plainCopy}: "${text}" uses a coined or marketing word`);
  if (/[^\x20-\x7E]/.test(text)) errors.push(`${RULES.plainCopy}: ASCII only`);
}
