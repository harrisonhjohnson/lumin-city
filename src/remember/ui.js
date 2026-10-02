import './ui.css';

const star = (cx, cy, R, r, n = 5) => Array.from({ length: n * 2 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / n;
  const d = i % 2 ? r : R;
  return `${(cx + d * Math.cos(a)).toFixed(1)},${(cy + d * Math.sin(a)).toFixed(1)}`;
}).join(' ');

const star8 = () => star(48, 48, 44, 22, 8);
const svg = (body) => `<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">${body}</svg>`;

const GLYPHS = {
  skate: svg(
    '<path class="t14" d="M6 36C13 36 13 47 27 47H69C83 47 83 36 90 36"/>' +
    '<path class="t8" d="M6 36C13 36 13 47 27 47H69C83 47 83 36 90 36"/>' +
    '<path class="s" d="M29 53V58M67 53V58"/>' +
    '<circle class="r" cx="29" cy="65" r="8.5"/><circle class="r" cx="67" cy="65" r="8.5"/>' +
    '<circle class="p" cx="29" cy="65" r="2.8"/><circle class="p" cx="67" cy="65" r="2.8"/>' +
    '<path class="s" d="M4 12H22M0 22H14M10 2H22"/>',
  ),
  race: svg(
    '<path class="p" d="M8 66V54Q8 48 15 46L30 43L41 27Q43 25 47 25H63Q67 25 69 28L79 43L86 47Q92 49 92 55V66Z"/>' +
    '<path class="g" d="M46 32H62L69 43H40Z"/>' +
    '<path class="s" d="M12 57H88"/>' +
    '<circle class="k" cx="28" cy="68" r="11"/><circle class="p" cx="28" cy="68" r="4"/>' +
    '<circle class="k" cx="72" cy="68" r="11"/><circle class="p" cx="72" cy="68" r="4"/>' +
    '<path class="s" d="M4 44H14M0 54H8"/>',
  ),
  heist: svg(
    '<path class="g" d="M27 22H69L88 42L48 86L8 42Z"/>' +
    '<path class="p" d="M27 22H69L58 42H38Z"/>' +
    '<path class="s" d="M8 42H88M38 42L48 86L58 42M27 22L38 42M69 22L58 42"/>' +
    '<path class="p" d="M82 6l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>' +
    '<path class="p" d="M12 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
  ),
  aliens: svg(
    '<path class="beam" d="M36 48L16 82H80L60 48Z"/>' +
    '<path class="p" d="M30 36C30 10 66 10 66 36Z"/>' +
    '<path class="grn" d="M40 35C40 23 56 23 56 35Z"/>' +
    '<ellipse class="g" cx="48" cy="38" rx="38" ry="13"/>' +
    '<circle class="r" cx="24" cy="40" r="3.4"/><circle class="r" cx="48" cy="43" r="3.4"/><circle class="r" cx="72" cy="40" r="3.4"/>' +
    '<path class="p" d="M10 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>' +
    '<path class="p" d="M84 12l1.6 4 4 1.6-4 1.6L84 23l-1.6-3.8-4-1.6 4-1.6z"/>',
  ),
  patrol: svg(
    '<path class="g" d="M48 8L80 19V46C80 66 66 80 48 89C30 80 16 66 16 46V19Z"/>' +
    '<path class="p" d="M48 17L72 25V46C72 61 62 72 48 80C34 72 24 61 24 46V25Z"/>' +
    `<polygon class="r" points="${star(48, 47, 20, 8.4)}"/>`,
  ),
  pizza: svg(
    '<path class="g" d="M12 26Q48 8 84 26L48 90Z"/>' +
    '<path class="tan" d="M10 24Q48 4 86 24Q91 33 82 34Q48 20 14 34Q5 33 10 24Z"/>' +
    '<circle class="r" cx="41" cy="45" r="6.5"/><circle class="r" cx="59" cy="47" r="5"/><circle class="r" cx="49" cy="66" r="5"/>',
  ),
  taxi: svg(
    '<path class="s" d="M2 52H11M0 62H7"/>' +
    '<path class="s" d="M30 14L25 9M66 14L71 9M48 11V5"/>' +
    '<path class="r" d="M36 30V21Q36 17 40 17H56Q60 17 60 21V30Z"/>' +
    '<path class="pn" d="M41 21.5H55V25.5H41Z"/>' +
    '<path class="p" d="M8 72V58Q8 52 15 50L24 48L32 33Q34 30 38 30H60Q64 30 66 33L74 48L82 50Q90 52 90 58V72Z"/>' +
    '<path class="sky" d="M46 36H39Q37 36 36 38L30 47H46Z"/>' +
    '<path class="sky" d="M51 36H59Q61 36 62 38L68 47H51Z"/>' +
    `<path class="ck k" d="${Array.from({ length: 22 }, (_, i) => ((i % 11) + ((i / 11) | 0)) % 2 ? '' : `M${16 + (i % 11) * 6} ${51 + ((i / 11) | 0) * 6}h6v6h-6z`).join('')}"/>` +
    '<circle class="k" cx="28" cy="72" r="10"/><circle class="p" cx="28" cy="72" r="3.6"/>' +
    '<circle class="k" cx="70" cy="72" r="10"/><circle class="p" cx="70" cy="72" r="3.6"/>',
  ),
  roam: svg(
    '<path class="t14" d="M16 88C14 70 72 82 72 62C72 46 22 58 26 42C28 34 44 38 54 36"/>' +
    '<path class="t8" d="M16 88C14 70 72 82 72 62C72 46 22 58 26 42C28 34 44 38 54 36"/>' +
    '<path class="dash" d="M16 88C14 70 72 82 72 62C72 46 22 58 26 42C28 34 44 38 54 36"/>' +
    '<path class="r" d="M70 40C62 31 57 27 57 21A13 13 0 0 1 83 21C83 27 78 31 70 40Z"/>' +
    '<circle class="p" cx="70" cy="21" r="5"/>' +
    '<path class="g" d="M14 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>' +
    '<path class="p" d="M36 6l1.6 4 4 1.6-4 1.6L36 17l-1.6-3.8-4-1.6 4-1.6z"/>',
  ),
  foot: svg(
    '<circle class="p" cx="54" cy="15" r="10"/>' +
    '<path class="t14" d="M70 50L52 36L34 52M52 36L46 60M30 76L46 60L64 74L62 90M30 76L20 88"/>' +
    '<path class="t8" d="M70 50L52 36L34 52M52 36L46 60M30 76L46 60L64 74L62 90M30 76L20 88"/>',
  ),
  shop: svg(
    '<path class="tan" d="M56 6H70V30H56Z"/>' +
    '<path class="tan" d="M8 86V54Q8 22 44 22Q80 22 80 54V86Z"/>' +
    '<path class="s" d="M10 62H78M10 74H78M24 48V62M40 40V62M56 44V62M70 50V62M17 62V74M33 62V74M49 62V74M65 62V74M25 74V86M41 74V86M57 74V86" stroke-width="2"/>' +
    '<path class="k" d="M24 86V66Q24 50 44 50Q64 50 64 66V86Z"/>' +
    '<path class="g" d="M32 86Q28 74 39 66Q39 74 45 70Q50 76 54 86Z"/>' +
    '<path class="r" d="M39 86Q39 80 44 76Q49 80 49 86Z"/>' +
    '<path class="t14" d="M90 92L70 54"/><path class="t8" d="M90 92L70 54" style="stroke:#c8955a"/>' +
    '<circle class="g" cx="68" cy="40" r="15"/><circle class="r" cx="63" cy="36" r="3.4"/><circle class="r" cx="73" cy="43" r="3.4"/><circle class="r" cx="65" cy="47" r="2.6"/>',
  ),
  kaiju: svg(
    '<path class="s" d="M0 91H96"/>' +
    '<path class="p" d="M62 91V76H72V91Z"/><path class="p" d="M76 91V68H88V91Z"/>' +
    '<path class="grn" d="M6 90Q2 74 20 70L18 58Q14 40 32 34Q38 20 56 22Q66 22 72 28L90 26L82 36L92 44L74 46Q70 56 60 60L64 76L58 90L40 90L38 82L24 90Z"/>' +
    '<path class="g" d="M20 52L12 42L26 44ZM27 42L22 30L36 36ZM40 33L38 20L50 28Z"/>' +
    '<path class="p" d="M76 46L79 40L82 46ZM83 45L86 40L89 45Z"/>' +
    '<circle class="r" cx="68" cy="33" r="3.2"/>' +
    '<path class="s" d="M58 54Q66 54 70 60" stroke-width="2.6"/>',
  ),
  mayor: svg(
    '<path class="r" d="M32 54L18 92L34 82L44 94L54 58Z"/>' +
    '<path class="r" d="M64 54L78 92L62 82L52 94L42 58Z"/>' +
    Array.from({ length: 12 }, (_, i) => `<circle class="g" cx="${(48 + 25 * Math.cos((i * Math.PI) / 6)).toFixed(1)}" cy="${(36 + 25 * Math.sin((i * Math.PI) / 6)).toFixed(1)}" r="8"/>`).join('') +
    '<circle class="g" cx="48" cy="36" r="25"/><circle class="p" cx="48" cy="36" r="16"/>' +
    `<polygon class="r" points="${star(48, 36, 13, 5.6)}"/>`,
  ),
  owner: svg(
    '<path class="p" d="M10 90V30L38 14V90Z"/>' +
    '<path class="g" d="M38 90V40L68 28V90Z"/>' +
    '<path class="sky" d="M17 34H24V42H17ZM26 29H32V38H26ZM17 50H24V58H17ZM26 48H32V56H26ZM17 66H24V74H17ZM26 64H32V72H26Z"/>' +
    '<path class="sky" d="M45 48H52V56H45ZM54 45H61V53H54ZM45 64H52V72H45ZM54 62H61V70H54Z"/>' +
    '<circle class="g" cx="68" cy="66" r="14"/><circle class="k" cx="68" cy="66" r="5"/>' +
    '<path class="t14" d="M76 76L90 92"/><path class="t8" d="M76 76L90 92" style="stroke:#e9b23a"/>' +
    '<path class="g" d="M84 86L89 80L93 86Z"/>',
  ),
  hero: svg(
    '<path class="r" d="M30 46Q4 52 8 92Q22 80 38 84L40 52Z"/>' +
    '<path class="r" d="M66 46Q92 52 88 92Q74 80 58 84L56 52Z"/>' +
    '<path class="blu" d="M28 52Q48 42 68 52L64 92H32Z"/>' +
    '<circle class="g" cx="48" cy="68" r="11"/>' +
    `<polygon class="r" points="${star(48, 68, 8.4, 3.6)}"/>` +
    '<circle class="p" cx="48" cy="26" r="15"/>' +
    '<path class="k" d="M33 24Q48 17 63 24V31Q48 28 33 31Z"/>' +
    '<path class="s" d="M43 38Q48 41 53 38"/>' +
    '<path class="r" d="M33 14Q48 4 63 14L60 18Q48 11 36 18Z"/>',
  ),
  spark: svg(
    `<polygon class="g" points="${star(48, 48, 44, 26, 8)}"/>` +
    '<path class="p" d="M48 26L68 50H55V72H41V50H28Z"/>',
  ),
};

const GLYPH_COLOURS = {
  skate: '#e9b23a', race: '#e0322b', heist: '#5b4b8f', aliens: '#2f9a78', patrol: '#2f66b0', pizza: '#e8762c',
  taxi: '#f6b90c', roam: '#6b5b95', foot: '#c9bfa6',
  shop: '#c2562b', kaiju: '#5c7a3a', mayor: '#8b2f4f', owner: '#2a7f7a', hero: '#3b3f9e', spark: '#e9b23a',
};
const FALLBACK_COLOURS = ['#e0322b', '#e9b23a', '#2f66b0', '#2f9a78', '#5b4b8f', '#e8762c'];
const MEMORY_TILT = [-1.8, 1.2, -0.8, 1.6, -1.3, 0.9];
const BOARD_TILT = [-2.2, 1.5, -1.1, 1.9, -1.6, 2.2, -1.4, 1.1];

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const TOAST_ICONS = {
  info: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l9 9-9 9-9-9z"/></svg>',
  good: CHECK,
  bad: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/><circle class="dot" cx="12" cy="16" r="1.3"/></svg>';
const UNLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 017.6-1.7"/><circle class="dot" cx="12" cy="16" r="1.3"/></svg>';
const RETURN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 6v6H6m0 0l4-4m-4 4l4 4"/></svg>';
const INFINITY = '<svg viewBox="0 0 40 20" aria-hidden="true" focusable="false"><path d="M20 10C14 2 4 2 4 10C4 18 14 18 20 10C26 2 36 2 36 10C36 18 26 18 20 10Z"/></svg>';

// Mood faces for the talk card: a coloured disc, ink features, one tell per mood.
const MOODS = {
  happy: ['#e9b23a', 'Happy', '<path d="M13 20Q16.5 14.5 20 20M28 20Q31.5 14.5 35 20"/><path d="M13 28Q24 41 35 28Z" fill="#f8f4ea"/><circle cx="9.5" cy="26" r="2.6" fill="#e0322b" stroke="none"/><circle cx="38.5" cy="26" r="2.6" fill="#e0322b" stroke="none"/>'],
  fine: ['#f1e3c0', 'Fine', '<circle cx="17" cy="20" r="2.6" fill="#1b1a17" stroke="none"/><circle cx="31" cy="20" r="2.6" fill="#1b1a17" stroke="none"/><path d="M16 31Q24 35 32 31"/>'],
  tired: ['#a79bd0', 'Tired', '<path d="M12 21Q16.5 25 21 21M27 21Q31.5 25 36 21"/><path d="M13 27.5Q16.5 29.5 20 27.5M28 27.5Q31.5 29.5 35 27.5" stroke-width="2"/><path d="M19 34Q24 31 29 34"/><path d="M36 5H42L36 12H42" stroke-width="2.4"/>'],
  hungry: ['#f0a15c', 'Hungry', '<circle cx="17" cy="19" r="2.6" fill="#1b1a17" stroke="none"/><circle cx="31" cy="19" r="2.6" fill="#1b1a17" stroke="none"/><path d="M12 13Q16 11 20 14M36 13Q32 11 28 14" stroke-width="2.4"/><ellipse cx="24" cy="32" rx="5.5" ry="6" fill="#1b1a17"/><path d="M20.5 35Q24 31 27.5 35" fill="#e0322b" stroke="none"/><path d="M31 36Q33.4 40.5 31 42.5Q28.6 40.5 31 36Z" fill="#8fc3ea" stroke-width="2"/>'],
  lonely: ['#8fb2dc', 'Lonely', '<circle cx="17" cy="22" r="2.6" fill="#1b1a17" stroke="none"/><circle cx="31" cy="22" r="2.6" fill="#1b1a17" stroke="none"/><path d="M12 17L21 14M36 17L27 14" stroke-width="2.4"/><path d="M17 35Q24 28 31 35"/><path d="M13 26Q15.6 30.5 13 33Q10.4 30.5 13 26Z" fill="#dff0ff" stroke-width="2"/>'],
  broke: ['#8fd0ae', 'Broke', '<circle cx="17" cy="20" r="2.6" fill="#1b1a17" stroke="none"/><circle cx="31" cy="20" r="2.6" fill="#1b1a17" stroke="none"/><path d="M12 14Q16 11 20 14M36 14Q32 11 28 14" stroke-width="2.4"/><path d="M14 33Q19 28 24 33T34 33"/><path d="M38 9Q42 15 38 18Q34 15 38 9Z" fill="#8fc3ea" stroke-width="2"/>'],
  scared: ['#d3d6e8', 'Scared', '<circle cx="17" cy="20" r="5.4" fill="#f8f4ea" stroke-width="2.4"/><circle cx="31" cy="20" r="5.4" fill="#f8f4ea" stroke-width="2.4"/><circle cx="17" cy="21" r="1.9" fill="#1b1a17" stroke="none"/><circle cx="31" cy="21" r="1.9" fill="#1b1a17" stroke="none"/><path d="M11 10Q16 6 21 10M27 10Q32 6 37 10" stroke-width="2.4"/><ellipse cx="24" cy="34" rx="4" ry="5" fill="#1b1a17"/><path d="M42 12Q45 17 42 20Q39 17 42 12Z" fill="#8fc3ea" stroke-width="2"/>'],
  angry: ['#e0322b', 'Angry', '<path d="M11 13L21 19M37 13L27 19" stroke-width="3.2"/><circle cx="17" cy="23" r="2.6" fill="#1b1a17" stroke="none"/><circle cx="31" cy="23" r="2.6" fill="#1b1a17" stroke="none"/><path d="M16 36Q24 28 32 36"/><path d="M5 9Q2 6 5 3M43 9Q46 6 43 3" stroke-width="2"/>'],
};
const moodFace = (mood) => {
  const [c, , f] = MOODS[mood] || MOODS.fine;
  return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="#1b1a17" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20" fill="${c}"/>${f}</svg>`;
};

const hashSeed = (s) => {
  if (typeof s === 'number' && Number.isFinite(s)) return (Math.floor(Math.abs(s)) >>> 0) || 1;
  let h = 2166136261;
  for (const c of String(s ?? '')) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return (h >>> 0) || 1;
};
const seeded = (seed) => {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const SKIN = ['#f6d9bd', '#efc197', '#d9a06f', '#b97a4e', '#8a5836', '#5e3b24'];
const HAIR = ['#1b1a17', '#3a2416', '#6b4423', '#a5702f', '#d8b04a', '#b6452f', '#9c9a94', '#e9e1cf'];
const SHIRT = ['#e0322b', '#2f66b0', '#2f9a78', '#e8762c', '#5b4b8f', '#e9b23a', '#2b2f3a', '#d86a8a'];

// A blocky minifig bust. Every pick comes off the seed, so one seed is always one face.
function portrait(seed) {
  const r = seeded(seed);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const hue = Math.floor(r() * 360);
  const skin = pick(SKIN);
  const hair = pick(HAIR);
  const shirtAt = Math.floor(r() * SHIRT.length);
  const shirt = SHIRT[shirtAt];
  const style = Math.floor(r() * 7);
  const mouth = Math.floor(r() * 3);
  const kind = Math.floor(r() * 4);
  const brow = Math.floor(r() * 3);
  const specs = r() < 0.25;
  const stache = r() < 0.18;
  const INK = '#1b1a17';
  const PAPER = '#f8f4ea';
  const back = style === 1 ? `<path d="M30 40Q28 12 60 12Q92 12 90 40V86H78V50H42V86H30Z" fill="${hair}"/>`
    : style === 5 ? `<path d="M30 46Q28 12 60 12Q92 12 90 46V68H80V48H40V68H30Z" fill="${hair}"/>` : '';
  const detail = kind === 1 ? `<path d="M18.5 108H101.5V118H18.5Z" fill="${PAPER}" stroke="none"/>`
    : kind === 2 ? `<path d="M48 71L60 90L72 71Z" fill="${PAPER}"/><path d="M60 90V104" stroke-width="2.4"/>`
      : kind === 3 ? `<path d="M42 104H78V140H42Z" fill="${PAPER}"/><path d="M45 104L52 74M75 104L68 74" stroke-width="3.4"/>` : '';
  const brows = brow === 1 ? '<path d="M44 33L56 32M64 32L76 33" stroke-width="2.6"/>'
    : brow === 2 ? '<path d="M44 34Q50 29 56 33M64 33Q70 29 76 34" stroke-width="2.6"/>' : '';
  const mouthSvg = mouth === 0 ? '<path d="M50 51Q60 59 70 51"/>'
    : mouth === 1 ? `<path d="M48 50H72Q70 61 60 61Q50 61 48 50Z" fill="#fff"/>` : '<path d="M52 54Q60 57 68 54"/>';
  const front = [
    `<path d="M34 36Q32 11 60 11Q88 11 86 36Q80 26 72 25Q60 22 48 25Q40 26 34 36Z" fill="${hair}"/>`,
    `<path d="M35 34Q38 18 60 18Q82 18 85 34Q72 26 60 28Q48 26 35 34Z" fill="${hair}"/>`,
    `<path d="M34 36Q32 11 60 11Q88 11 86 36Q80 26 72 25Q60 22 48 25Q40 26 34 36Z" fill="${hair}"/><circle cx="60" cy="7" r="9" fill="${hair}"/>`,
    '',
    `<path d="M35 36Q26 6 60 6Q94 6 85 36Q80 24 60 24Q40 24 35 36Z" fill="${hair}"/>`,
    `<path d="M35 36V24Q60 8 85 24V36Q60 24 35 36Z" fill="${hair}"/>`,
    `<path d="M33 30Q34 9 60 9Q86 9 87 30Z" fill="${SHIRT[(shirtAt + 3) % SHIRT.length]}"/><path d="M54 28H96Q98 35 54 35Z" fill="${SHIRT[(shirtAt + 3) % SHIRT.length]}"/>`,
  ][style];
  const svg = `<svg viewBox="0 0 120 140" aria-hidden="true" focusable="false" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${back}`
    + `<rect x="52" y="54" width="16" height="24" fill="${skin}"/>`
    + `<path d="M16 140V94Q16 78 34 75L50 71H70L86 75Q104 78 104 94V140Z" fill="${shirt}"/>${detail}`
    + `<path d="M52 66H68V74Q60 79 52 74Z" fill="${INK}" fill-opacity=".16" stroke="none"/>`
    + (style === 3 ? `<rect x="52" y="6" width="16" height="13" rx="3" fill="${skin}"/>` : '')
    + `<circle cx="35" cy="42" r="5" fill="${skin}"/><circle cx="85" cy="42" r="5" fill="${skin}"/>`
    + `<rect x="35" y="16" width="50" height="48" rx="13" fill="${skin}"/>`
    + `<circle cx="50" cy="41" r="3" fill="${INK}" stroke="none"/><circle cx="70" cy="41" r="3" fill="${INK}" stroke="none"/>${brows}${mouthSvg}`
    + (stache ? `<path d="M49 49Q60 44 71 49Q66 54 60 51Q54 54 49 49Z" fill="${hair}" stroke-width="2.2"/>` : '')
    + (specs ? '<circle cx="50" cy="41" r="8" fill="#fff" fill-opacity=".35" stroke-width="2.6"/><circle cx="70" cy="41" r="8" fill="#fff" fill-opacity=".35" stroke-width="2.6"/><path d="M58 41H62" stroke-width="2.6"/>' : '')
    + `${front}</svg>`;
  return { svg, hue };
}
const OPINIONS = [[-0.66, "Can't stand you"], [-0.33, 'Dislikes you'], [-0.1, 'Wary of you'], [0.1, 'Knows you'], [0.33, 'Warming up'], [0.66, 'Likes you'], [Infinity, 'Adores you']];
const opinionWord = (o) => (o == null ? "Doesn't know you" : OPINIONS.find(([max]) => o < max)[1]);
const shrinkToFit = (n) => {
  n.style.fontSize = '';
  if (n.scrollWidth > n.clientWidth + 1) n.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(n).fontSize) * (n.clientWidth / n.scrollWidth))}px`;
};
const cash = (n, cents = Math.round(Math.abs(n) * 100) % 100 !== 0) => (
  `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`
);

// Pizza shop rush: ingredient bins, their icons, and the little drawings that build up on the pie.
const KT_STEPS = ['dough', 'sauce', 'cheese', 'pepperoni', 'mushroom', 'olive', 'basil', 'pepper'];
const KT_TOP = KT_STEPS.slice(3);
const KT_LABEL = { dough: 'Dough', sauce: 'Sauce', cheese: 'Cheese', pepperoni: 'Pepperoni', mushroom: 'Mushroom', olive: 'Olive', basil: 'Basil', pepper: 'Pepper' };
const ktSvg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="#1b1a17" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const KT_ICON = {
  dough: ktSvg('<ellipse cx="24" cy="28" rx="18" ry="12" fill="#f2d39b"/><ellipse cx="24" cy="23" rx="18" ry="12" fill="#f8e2b5"/><path d="M13 20Q18 15 24 17" stroke-width="2.4" stroke="#d8b46c"/>'),
  sauce: ktSvg('<path d="M24 5C33 16 39 22 39 30A15 15 0 0 1 9 30C9 22 15 16 24 5Z" fill="#d8472b"/><path d="M17 31Q18 38 25 39" stroke="#f08a6a" stroke-width="2.6"/>'),
  cheese: ktSvg('<path d="M5 33L43 15V33Z" fill="#f7dc78"/><path d="M5 33V40H43V33" fill="#e9b23a"/><circle cx="17" cy="31" r="2.6" fill="#e9b23a" stroke-width="2"/><circle cx="30" cy="26" r="2.2" fill="#e9b23a" stroke-width="2"/><circle cx="36" cy="30" r="1.6" fill="#e9b23a" stroke-width="2"/>'),
  pepperoni: ktSvg('<circle cx="24" cy="24" r="17" fill="#c2332a"/><circle cx="17" cy="19" r="2.4" fill="#8f1f1b" stroke="none"/><circle cx="29" cy="17" r="2.4" fill="#8f1f1b" stroke="none"/><circle cx="26" cy="29" r="2.4" fill="#8f1f1b" stroke="none"/><circle cx="16" cy="30" r="2" fill="#8f1f1b" stroke="none"/>'),
  mushroom: ktSvg('<path d="M9 26Q9 8 24 8Q39 8 39 26Z" fill="#e8d6bd"/><path d="M19 26H29V38Q24 41 19 38Z" fill="#f4e9d6"/><circle cx="17" cy="19" r="2" fill="#c9b08e" stroke="none"/><circle cx="29" cy="16" r="2.4" fill="#c9b08e" stroke="none"/>'),
  olive: ktSvg('<circle cx="24" cy="24" r="16" fill="#2a2a38"/><circle cx="24" cy="24" r="6" fill="#f7dc78"/><path d="M14 16Q17 12 22 11" stroke="#6b6b82" stroke-width="2.4"/>'),
  basil: ktSvg('<path d="M24 5Q42 20 24 43Q6 20 24 5Z" fill="#4faa5e"/><path d="M24 11V39M24 20L32 15M24 28L16 23M24 28L32 23" stroke-width="2.2"/>'),
  pepper: ktSvg('<circle cx="24" cy="24" r="14" fill="none" stroke="#1b1a17" stroke-width="12"/><circle cx="24" cy="24" r="14" fill="none" stroke="#3aa86f" stroke-width="6"/>'),
};
// Spots for scattered toppings; every topping layer takes five of them, offset so layers interleave.
const KT_SPOTS = [[-40, -28], [26, -46], [48, 8], [-4, 6], [-48, 30], [22, 46], [-18, -60], [62, -22], [-64, -4], [-26, 54], [44, 42], [8, -22], [-34, 6], [24, 18]];
const KT_PIECE = {
  pepperoni: '<circle r="13" fill="#c2332a"/><circle cx="-5" cy="-4" r="2.2" fill="#8f1f1b" stroke="none"/><circle cx="5" cy="-6" r="2.2" fill="#8f1f1b" stroke="none"/><circle cx="3" cy="5" r="2.2" fill="#8f1f1b" stroke="none"/>',
  mushroom: '<path d="M-13 3Q-13 -13 0 -13Q13 -13 13 3Z" fill="#e8d6bd"/><path d="M-4 3H4V11Q0 13 -4 11Z" fill="#f4e9d6"/>',
  olive: '<circle r="9" fill="#2a2a38"/><circle r="3.4" fill="#f7dc78" stroke-width="2"/>',
  basil: '<path d="M0 -13Q15 -2 0 13Q-15 -2 0 -13Z" fill="#4faa5e"/><path d="M0 -9V9" stroke-width="2"/>',
  pepper: '<circle r="9" fill="none" stroke="#1b1a17" stroke-width="9"/><circle r="9" fill="none" stroke="#3aa86f" stroke-width="3.4"/>',
};
const ktLayer = (id, k = 0) => {
  if (id === 'dough') return '<g class="rm-kt-ly" data-l="dough"><circle r="92" fill="#f2d39b"/><circle r="80" fill="none" stroke="#e1b66d" stroke-width="3"/></g>';
  if (id === 'sauce') return '<g class="rm-kt-ly" data-l="sauce"><circle r="73" fill="#d8472b"/><path d="M-42 -8Q-12 -44 26 -22T50 20" fill="none" stroke="#f08a6a" stroke-width="5"/><path d="M-30 30Q-8 12 14 26" fill="none" stroke="#f08a6a" stroke-width="4"/></g>';
  if (id === 'cheese') {
    const blobs = [[-34, -22, 21], [0, -42, 20], [36, -24, 21], [44, 14, 20], [14, 40, 21], [-30, 30, 20], [-48, 2, 17], [0, 0, 24]];
    return `<g class="rm-kt-ly" data-l="cheese"><g stroke-width="6">${blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f7dc78"/>`).join('')}</g><g stroke="none">${blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r - 1}" fill="#f7dc78"/>`).join('')}<circle cx="-10" cy="-18" r="4" fill="#e9b23a"/><circle cx="22" cy="6" r="3.4" fill="#e9b23a"/><circle cx="-26" cy="26" r="3" fill="#e9b23a"/></g></g>`;
  }
  const pieces = Array.from({ length: 5 }, (_, j) => {
    const [x, y] = KT_SPOTS[(k * 5 + j * 3 + (k % 2)) % KT_SPOTS.length];
    return `<g transform="translate(${x} ${y}) rotate(${(j * 71 + k * 33) % 360})"><g class="rm-kt-pc" style="animation-delay:${j * 45}ms">${KT_PIECE[id]}</g></g>`;
  }).join('');
  return `<g class="rm-kt-ly" data-l="${id}">${pieces}</g>`;
};
const KT_OVEN = '<svg viewBox="0 0 120 110" aria-hidden="true" focusable="false" fill="none" stroke="#1b1a17" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M44 4H64V30H44Z" fill="#c8955a"/><path d="M8 104V58Q8 20 60 20Q112 20 112 58V104Z" fill="#c2562b"/><path d="M8 80H112M8 92H112M24 62V80M44 52V80M64 50V80M84 52V80M100 62V80M16 80V92M36 80V92M56 80V92M76 80V92M96 80V92" stroke-width="2.2"/><path d="M26 104V74Q26 48 60 48Q94 48 94 74V104Z" fill="#1b1a17"/><g class="rm-kt-fire"><path d="M38 104Q30 88 46 76Q46 88 54 84Q60 92 66 104Z" fill="#e9b23a"/><path d="M52 104Q52 94 60 88Q70 94 70 104Z" fill="#e0322b" stroke-width="2.6"/><path d="M68 104Q66 94 76 88Q84 96 82 104Z" fill="#e9b23a" stroke-width="3"/></g></svg>';

// World setup tiles: one little drawing and one accent colour per answer you can give.
const sIc = (b) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="#1b1a17" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
const SETUP_ICON = {
  nyc: sIc('<path d="M4 42V25H13V42ZM13 42V10L21 6V42ZM21 42V18H31V42ZM31 42V29H44V42Z" fill="#c9bfa6"/><path d="M17 6V2M3 42H45M36 29V24M40 29V24"/><path d="M24 24H28M24 30H28" stroke-width="2"/>'),
  tokyo: sIc('<path d="M3 9Q24 17 45 9V16Q24 24 3 16Z" fill="#e0322b"/><path d="M13 20V43M35 20V43M9 28H39"/>'),
  1900: sIc('<path d="M24 3L35 12H13Z" fill="#2a2a38"/><path d="M16 12H32V28H16Z" fill="#f7dc78"/><path d="M24 28V43M16 43H32M20 16V24" stroke-width="2.4"/>'),
  2000: sIc('<rect x="10" y="6" width="28" height="36" rx="4" fill="#a9d6e5"/><rect x="14" y="10" width="20" height="11" fill="#f8f4ea" stroke-width="2"/><circle cx="17" cy="29" r="2.4" fill="#1b1a17" stroke="none"/><circle cx="24" cy="29" r="2.4" fill="#1b1a17" stroke="none"/><circle cx="31" cy="29" r="2.4" fill="#1b1a17" stroke="none"/><circle cx="17" cy="36" r="2.4" fill="#1b1a17" stroke="none"/><circle cx="24" cy="36" r="2.4" fill="#1b1a17" stroke="none"/>'),
  2100: sIc('<ellipse cx="24" cy="30" rx="20" ry="8" fill="#8fb2dc"/><path d="M13 28Q13 12 24 12Q35 12 35 28Z" fill="#cfe0ea"/><circle cx="12" cy="32" r="2.2" fill="#e9b23a" stroke-width="2"/><circle cx="24" cy="35" r="2.2" fill="#e9b23a" stroke-width="2"/><circle cx="36" cy="32" r="2.2" fill="#e9b23a" stroke-width="2"/><path d="M16 42L12 46M32 42L36 46M24 42V46" stroke-width="2.4"/>'),
  spring: sIc('<path d="M24 28V44M24 38Q32 36 34 30" stroke-width="2.6"/><circle cx="24" cy="10" r="7" fill="#f2a1b8"/><circle cx="35" cy="18" r="7" fill="#f2a1b8"/><circle cx="31" cy="30" r="7" fill="#f2a1b8"/><circle cx="17" cy="30" r="7" fill="#f2a1b8"/><circle cx="13" cy="18" r="7" fill="#f2a1b8"/><circle cx="24" cy="21" r="6" fill="#e9b23a"/>'),
  summer: sIc('<circle cx="24" cy="24" r="10" fill="#f7dc78"/><path d="M24 4V9M24 39V44M4 24H9M39 24H44M10 10L13.5 13.5M34.5 34.5L38 38M38 10L34.5 13.5M13.5 34.5L10 38"/>'),
  autumn: sIc('<path d="M24 5Q41 13 39 30Q35 41 24 43Q13 41 9 30Q7 13 24 5Z" fill="#e8762c"/><path d="M24 12V45M24 24L33 18M24 32L15 26" stroke-width="2.4"/>'),
  winter: sIc('<path d="M24 4V44M6.7 14L41.3 34M6.7 34L41.3 14"/><path d="M18 6L24 12L30 6M18 42L24 36L30 42M5 22L12 20L11 13M43 26L36 28L37 35M5 26L12 28L11 35M43 22L36 20L37 13" stroke-width="2.4"/>'),
  clear: sIc('<circle cx="24" cy="24" r="9" fill="#f7dc78"/><path d="M24 6V11M24 37V42M6 24H11M37 24H42M11 11L14.5 14.5M33.5 33.5L37 37M37 11L33.5 14.5M14.5 33.5L11 37" stroke-width="2.6"/>'),
  rain: sIc('<path d="M12 28Q6 28 6 21Q6 15 13 15Q15 7 24 7Q33 7 34 15Q42 15 42 22Q42 28 35 28Z" fill="#cfe0ea"/><path d="M14 33L11 41M24 33L21 41M34 33L31 41" stroke="#2f66b0" stroke-width="3.2"/>'),
  fog: sIc('<path d="M12 24Q6 24 6 17Q6 11 13 11Q15 4 24 4Q33 4 34 11Q42 11 42 18Q42 24 35 24Z" fill="#d8d8d2"/><path d="M8 31H40M13 37H35M8 43H30" stroke-width="3.2"/>'),
  snow: sIc('<path d="M12 26Q6 26 6 19Q6 13 13 13Q15 5 24 5Q33 5 34 13Q42 13 42 20Q42 26 35 26Z" fill="#eef4f8"/><circle cx="13" cy="34" r="2.6" fill="#1b1a17" stroke="none"/><circle cx="24" cy="38" r="2.6" fill="#1b1a17" stroke="none"/><circle cx="35" cy="34" r="2.6" fill="#1b1a17" stroke="none"/><circle cx="19" cy="44" r="2" fill="#1b1a17" stroke="none"/><circle cx="31" cy="44" r="2" fill="#1b1a17" stroke="none"/>'),
  dawn: sIc('<path d="M6 34H42M10 28Q24 8 38 28Z" fill="#f2a93b"/><path d="M24 4V10M8 14L12 18M40 14L36 18M4 24H9M39 24H44" stroke-width="2.6"/><path d="M12 40H36" stroke-width="2.6"/>'),
  noon: sIc('<circle cx="24" cy="24" r="12" fill="#f7dc78"/><path d="M24 3V8M24 40V45M3 24H8M40 24H45M9 9L12.5 12.5M35.5 35.5L39 39M39 9L35.5 12.5M12.5 35.5L9 39" stroke-width="2.8"/>'),
  dusk: sIc('<path d="M5 36H43M10 30Q24 12 38 30Z" fill="#e8762c"/><path d="M8 42H40M16 46H32" stroke-width="2.6"/><path d="M24 8V13M10 16L13 19M38 16L35 19" stroke-width="2.4"/>'),
  midnight: sIc('<path d="M32 6Q16 8 16 26Q16 40 32 42Q20 44 12 34Q4 22 14 12Q22 4 32 6Z" fill="#f7dc78"/><path d="M36 10L38 15L43 17L38 19L36 24L34 19L29 17L34 15Z" fill="#f8f4ea" stroke-width="2"/><circle cx="40" cy="34" r="2" fill="#f8f4ea" stroke-width="2"/>'),
};
const SETUP_COLOUR = {
  nyc: '#c9bfa6', tokyo: '#e2796f', 1900: '#d8b46c', 2000: '#8fc3d6', 2100: '#8fa2dc',
  spring: '#f2b8c8', summer: '#f7dc78', autumn: '#eba061', winter: '#cfe0ea',
  clear: '#f7dc78', rain: '#9fbfdc', fog: '#d8d8d2', snow: '#e8eff4',
  dawn: '#f6c28a', noon: '#f7dc78', dusk: '#e9916a', midnight: '#8c8bc4',
};
const setupIcon = (id) => SETUP_ICON[id] || sIc('<path d="M24 5L43 24L24 43L5 24Z" fill="#e9b23a"/><path d="M24 15V33M15 24H33" stroke-width="2.6"/>');
const SETUP_NAMES = ['Kid', 'Sam', 'Mo', 'Jo', 'Rue', 'Nico', 'Pip', 'Wren', 'Ace', 'Lou', 'Remy', 'Tess'];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const h = (tag, cls, ...kids) => {
  const n = el(tag, cls);
  for (const k of kids) if (k != null) n.append(k);
  return n;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const KEYS = '1234567890-=';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const restart = (n, c) => { n.classList.remove(c); void n.offsetWidth; n.classList.add(c); };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const clock = (s) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const isTextEntry = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const isAdvance = (e) => e.key === 'Enter' || e.key === ' ';
const gap = (c, i) => ('.!?…'.includes(c) ? 300 : ',;:—–'.includes(c) ? 160 : 24 + ((i * 37) % 11));

const parseHex = (hex) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const s = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const fgFor = (hex) => {
  const rgb = parseHex(hex);
  if (!rgb) return '#1b1a17';
  const [r, g, b] = rgb.map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#1b1a17' : '#f8f4ea';
};
// A locked card keeps a faint tint of its own colour over a warm grey.
const muted = (hex) => {
  const rgb = parseHex(hex);
  if (!rgb) return '#9b958a';
  const grey = [155, 149, 138];
  return `#${rgb.map((v, i) => Math.round(v * 0.22 + grey[i] * 0.78).toString(16).padStart(2, '0')).join('')}`;
};
// Anton has no ∞, so it is drawn as an inline glyph wherever a chip or prompt may carry one.
const rich = (node, s) => {
  node.replaceChildren();
  String(s).split('∞').forEach((part, i) => {
    if (i) {
      const n = el('i', 'rm-inf');
      n.innerHTML = INFINITY;
      node.append(n);
    }
    if (part) node.append(part);
  });
};

let uid = 0;

export function createUI(root) {
  const id = `rm${++uid}`;
  // A dedicated root must let the canvas beneath receive pointer input; on <body> that would cascade to the canvas itself.
  const ownRoot = root !== document.body && root !== document.documentElement;
  const rootPE = root.style.pointerEvents;
  if (ownRoot) root.style.pointerEvents = 'none';
  const layer = el('div', 'rm-ui');
  layer.innerHTML = `
    <svg class="rm-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="${id}-ink" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -5 3.9" result="holes"/>
        <feComposite in="SourceGraphic" in2="holes" operator="in" result="speck"/>
        <feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="9" result="warp"/>
        <feDisplacementMap in="speck" in2="warp" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </svg>
    <div class="rm-stack is-hidden">
      <div class="rm-dialogue" role="dialog" aria-label="Narrator">
        <span class="rm-tag"><i></i><b>Memory</b></span>
        <p class="rm-text" aria-live="polite"><span class="rm-sr"></span><span class="rm-type" aria-hidden="true"><span class="rm-on"></span><span class="rm-off"></span></span></p>
        <span class="rm-adv" aria-hidden="true"><i></i><span>Enter</span></span>
      </div>
    </div>
    <div class="rm-note"></div>
    <div class="rm-hud" role="group" aria-label="Game status">
      <div class="rm-hud-tl">
        <div class="rm-hud-title" hidden><i></i><span></span></div>
        <div class="rm-hud-sub">
          <div class="rm-hud-obj" hidden><span></span></div>
          <div class="rm-meter" role="meter" aria-valuemin="0" aria-valuemax="100" hidden><span class="rm-meter-k"></span><span class="rm-meter-bar"><i></i></span></div>
          <div class="rm-hud-quest" hidden><i></i><span></span></div>
        </div>
      </div>
      <div class="rm-hud-tc">
        <div class="rm-timer is-off" role="timer" aria-label="Time left"><span>0:00</span></div>
        <div class="rm-clock" hidden><i></i><span></span></div>
      </div>
      <div class="rm-hud-tr">
        <div class="rm-score" role="group" aria-label="Score"><small>Score</small><b>0</b></div>
        <div class="rm-money" role="group" aria-label="Money" hidden><small>Cash</small><b></b></div>
      </div>
      <div class="rm-hud-bc">
        <div class="rm-prompt" role="status" hidden></div>
        <div class="rm-abil" role="list" aria-label="Abilities" hidden></div>
      </div>
    </div>
    <div class="rm-mem" role="group" aria-label="Memories">
      <div class="rm-mem-chip"><i></i><div><small>Memories</small><b>0</b></div></div>
      <span class="rm-sr" role="status"></span>
    </div>
    <div class="rm-wal" role="group" aria-label="Wallet">
      <div class="rm-wal-chip"><i>$</i><div><small>Wallet</small><b>$0</b></div></div>
      <span class="rm-sr" role="status"></span>
    </div>
    <div class="rm-goals" role="group" aria-label="Life goals"><ul></ul></div>
    <i class="rm-goals-probe" aria-hidden="true"></i>
    <div class="rm-toasts" role="status" aria-live="polite"></div>
    <div class="rm-callout" aria-live="polite"></div>
    <div class="rm-fade"></div>`;
  root.append(layer);

  const $ = (s) => layer.querySelector(s);
  const stack = $('.rm-stack');
  const panel = $('.rm-dialogue');
  const tag = $('.rm-tag');
  const tagName = $('.rm-tag b');
  const srText = $('.rm-sr');
  const onEl = $('.rm-on');
  const offEl = $('.rm-off');
  const noteEl = $('.rm-note');
  const hudEl = $('.rm-hud');
  const titleEl = $('.rm-hud-title');
  const objEl = $('.rm-hud-obj');
  const timerEl = $('.rm-timer');
  const scoreEl = $('.rm-score');
  const scoreNum = $('.rm-score b');
  const moneyEl = $('.rm-money');
  const moneyNum = $('.rm-money b');
  const trEl = $('.rm-hud-tr');
  const meterEl = $('.rm-meter');
  const meterKey = $('.rm-meter-k');
  const meterFill = $('.rm-meter-bar i');
  const promptEl = $('.rm-prompt');
  const abilEl = $('.rm-abil');
  const memEl = $('.rm-mem');
  const memChip = $('.rm-mem-chip');
  const memNum = $('.rm-mem-chip b');
  const memSr = $('.rm-mem .rm-sr');
  const walEl = $('.rm-wal');
  const walChip = $('.rm-wal-chip');
  const walNum = $('.rm-wal-chip b');
  const walSr = $('.rm-wal .rm-sr');
  const goalsEl = $('.rm-goals');
  const goalsList = $('.rm-goals ul');
  const goalsProbe = $('.rm-goals-probe');
  const questEl = $('.rm-hud-quest');
  const subEl = $('.rm-hud-sub');
  const tlEl = $('.rm-hud-tl');
  const clockEl = $('.rm-clock');
  const clockTxt = $('.rm-clock span');
  const toastsEl = $('.rm-toasts');
  const calloutEl = $('.rm-callout');
  const fadeEl = $('.rm-fade');

  // After destroy() prompts never settle, so a game loop still awaiting the UI just goes quiet.
  let dead = false;
  let cur = null;
  let memTotal = null;
  let tk = null;
  let sh = null;
  const timers = new Set();
  const cancels = new Set();
  const observers = new Set();

  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    return t;
  };
  const unlater = (t) => { clearTimeout(t); timers.delete(t); };
  const tween = (from, to, ms, fn) => {
    const t0 = performance.now();
    let raf = 0;
    const stop = () => { cancelAnimationFrame(raf); cancels.delete(stop); };
    const tick = (now) => {
      const k = clamp((now - t0) / ms, 0, 1);
      fn(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick); else stop();
    };
    raf = requestAnimationFrame(tick);
    cancels.add(stop);
    return stop;
  };

  // A prompt is { resolve, fallback, stop?, key?, advance? }. Starting a new one settles the old one.
  let lastSettle = -1e9;
  const settle = (p, value) => {
    lastSettle = performance.now();
    if (cur === p) cur = null;
    p.stop?.();
    p.resolve(value);
  };
  const begin = (p) => {
    if (!p.talk && tk) closeTalk();
    if (!p.shopp && sh) closeShop();
    if (cur) settle(cur, cur.fallback);
    cur = p;
  };

  // A held key never reaches a prompt (the kitchen opts in with `repeats`), and a press that has just
  // resolved one prompt cannot also act on the next: it gets a short grace before it takes keys.
  const onKey = (e) => {
    if (dead || !cur || e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target)) return;
    if (!cur.repeats) {
      if (e.repeat) return;
      if (performance.now() - lastSettle < 140) return;
    }
    cur.key?.(e);
  };
  window.addEventListener('keydown', onKey);
  panel.addEventListener('click', () => cur?.advance?.());

  const reveal = () => stack.classList.remove('is-hidden');
  const clearChoices = () => stack.querySelectorAll('.rm-choices').forEach((n) => n.remove());
  const leave = (n) => {
    n.classList.add('is-leaving');
    later(() => n.remove(), 300);
  };

  // Types `chars` into an on/off span pair; `host` carries is-typing while it runs.
  function typer(on, off, host, chars) {
    let i = 0;
    let timer = 0;
    let over = false;
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    const put = (n) => {
      on.textContent = chars.slice(0, n).join('');
      off.textContent = chars.slice(n).join('');
    };
    const end = () => {
      if (over) return;
      over = true;
      unlater(timer);
      put(chars.length);
      host.classList.remove('is-typing');
      resolve();
    };
    const step = () => {
      i += 1;
      put(i);
      if (i >= chars.length) return end();
      timer = later(step, gap(chars[i - 1], i));
    };
    host.classList.add('is-typing');
    put(0);
    if (reduced() || !chars.length) end(); else timer = later(step, 240);
    return { done, finish: end, stop: () => { over = true; unlater(timer); } };
  }

  function typewrite(raw, speaker = 'MEMORY') {
    const chars = Array.from(String(raw ?? ''));
    const text = chars.join('');
    reveal();
    tagName.textContent = speaker;
    tag.hidden = !speaker;
    srText.textContent = text;
    panel.classList.remove('is-ready');
    return typer(onEl, offEl, panel, chars);
  }

  function say(text, opts = {}) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: undefined };
      begin(p);
      clearChoices();
      const t = typewrite(text, opts.speaker);
      let ready = false;
      p.stop = t.stop;
      p.advance = () => { if (ready) settle(p); else t.finish(); };
      p.key = (e) => {
        if (!isAdvance(e)) return;
        e.preventDefault();
        if (!e.repeat) p.advance();
      };
      t.done.then(() => {
        if (cur !== p) return;
        if (opts.hold === false) return settle(p);
        ready = true;
        panel.classList.add('is-ready');
      });
    });
  }

  const affords = (o) => o.state === 'locked' ? false : (o.afford ?? (memTotal != null && Number(o.cost) <= memTotal));
  const stateOf = (o) => o.state || (o.locked ? 'buy' : 'open');
  const isGated = (o) => ['buy', 'locked', 'forked'].includes(stateOf(o));

  function buildCard(style, o, i, path = false) {
    const b = el('button', 'rm-card');
    const tilt = style === 'board' ? BOARD_TILT : MEMORY_TILT;
    const st = style === 'board' ? stateOf(o) : 'open';
    const locked = style === 'board' && isGated(o);
    b.type = 'button';
    b.style.setProperty('--i', i);
    b.style.setProperty('--tilt', path ? `${i % 2 ? 0.7 : -0.7}deg` : `${tilt[i % tilt.length]}deg`);
    b.setAttribute('aria-keyshortcuts', KEYS[i] ?? String(i + 1));
    if (style === 'board') {
      const c0 = o.colour || GLYPH_COLOURS[o.glyph] || FALLBACK_COLOURS[i % 6];
      const c = locked ? muted(c0) : c0;
      b.style.setProperty('--c', c);
      b.style.setProperty('--fg', fgFor(c));
      if (o.state) b.classList.add(`is-st-${st}`);
    }
    const key = h('span', 'rm-key', KEYS[i] ?? String(i + 1));
    key.setAttribute('aria-hidden', 'true');
    b.append(key);
    if (style === 'board' && (GLYPHS[o.glyph] || locked)) {
      const g = el('span', 'rm-glyph');
      g.innerHTML = GLYPHS[o.glyph] || '';
      b.append(g);
    }
    if (locked) {
      const lock = el('i', 'rm-lock');
      lock.innerHTML = affords(o) ? UNLOCK : LOCK;
      b.append(lock);
    }
    b.append(h('span', 'rm-card-label', String(o.label)));
    if (o.hint && st !== 'locked') b.append(h('span', 'rm-card-hint', String(o.hint)));
    if (style === 'board' && o.badge) b.append(h('span', 'rm-badge', String(o.badge)));
    if (style === 'board' && (o.rank || st === 'done')) {
      const rs = el('span', 'rm-rankstamp');
      if (o.rank) rs.textContent = String(o.rank).toUpperCase().slice(0, 2); else rs.innerHTML = CHECK;
      rs.setAttribute('aria-hidden', 'true');
      b.classList.add('has-rank');
      b.append(rs, el('span', 'rm-sr', o.rank ? `Best rank ${String(o.rank).toUpperCase()}.` : 'Done.'));
    }
    if (locked) {
      const can = !!affords(o);
      b.classList.add('is-locked', can ? 'is-afford' : 'is-short');
      b.setAttribute('aria-disabled', String(!can));
      if (st === 'locked') {
        const req = String(o.requirement || 'Not unlocked yet');
        const vis = el('span', null, req);
        vis.setAttribute('aria-hidden', 'true');
        b.append(h('span', 'rm-cost is-req', el('i'), vis, el('span', 'rm-sr', `Locked. Needs: ${req}.`)));
      } else {
        const cost = fmt(Number(o.cost) || 0);
        const vis = el('span', null, can ? `Unlock · ${cost}` : `${cost} memories`);
        vis.setAttribute('aria-hidden', 'true');
        const pre = st === 'forked' ? 'Road not taken. ' : '';
        b.append(h('span', 'rm-cost', el('i'), vis, el('span', 'rm-sr', can ? `${pre}Locked. Unlock for ${cost} memories.` : `${pre}Locked. Costs ${cost} memories.`)));
      }
    }
    return b;
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  // Offset of an element inside a scroller, ignoring any transform (cards tilt, lift and deal in).
  const placeIn = (n, root) => {
    let x = 0;
    let y = 0;
    const w = n.offsetWidth;
    const hh = n.offsetHeight;
    for (let e = n; e && e !== root; e = e.offsetParent) {
      x += e.offsetLeft;
      y += e.offsetTop;
    }
    return { x, y, w, h: hh };
  };

  function ask(question, options, opts = { style: 'memory' }) {
    const style = opts.style === 'board' ? 'board' : 'memory';
    const path = style === 'board' && options.some((o) => Number.isFinite(Number(o.tier)) && o.tier !== null && o.tier !== undefined);
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: null };
      begin(p);
      clearChoices();
      const t = typewrite(question, opts.speaker);
      let ready = false;
      let picked = false;
      let idx = 0;
      let box = null;
      let cards = [];
      let need = null;
      let needTimer = 0;
      let scroller = null;
      let lineSvg = null;
      let ro = null;

      const setActive = (i, focus) => {
        idx = i;
        cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
        if (path && lineSvg) lineSvg.querySelectorAll('path[data-from]').forEach((n) => n.classList.toggle('is-hot', +n.dataset.from === i || +n.dataset.to === i));
        if (focus) {
          if (path) cards[i].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
          cards[i].focus({ preventScroll: true });
        }
      };
      // A locked card you cannot afford shakes and says how far off you are; it never resolves.
      const refuse = (i) => {
        setActive(i, true);
        restart(cards[i], 'is-nope');
        const o = options[i];
        const short = Math.ceil(Number(o.cost) - memTotal);
        need.replaceChildren(el('span', null, stateOf(o) === 'locked'
          ? `Needs: ${o.requirement || 'something first'}`
          : memTotal != null && short > 0
            ? `Need ${fmt(short)} more ${short === 1 ? 'memory' : 'memories'}`
            : 'Not enough memories yet'));
        restart(need, 'is-on');
        unlater(needTimer);
        needTimer = later(() => need.classList.remove('is-on'), 2600);
      };
      const choose = (i) => {
        if (picked || !ready) return;
        if (isGated(options[i]) && !affords(options[i])) return refuse(i);
        picked = true;
        setActive(i);
        box.classList.add('is-done');
        cards[i].classList.add('is-picked');
        const stamp = el('span', 'rm-stamp');
        stamp.innerHTML = CHECK;
        cards[i].append(stamp);
        cards.forEach((c) => { c.disabled = true; });
        later(() => { leave(box); settle(p, options[i].id); }, 350);
      };
      const move = (k) => {
        const n = cards.length;
        if (path) {
          // Spatial: the nearest card in the direction pressed, whichever way the path runs.
          const at = cards.map((c) => placeIn(c, scroller));
          const me = at[idx];
          let best = -1;
          let bestD = Infinity;
          at.forEach((q, i) => {
            if (i === idx) return;
            const dx = q.x + q.w / 2 - (me.x + me.w / 2);
            const dy = q.y + q.h / 2 - (me.y + me.h / 2);
            const horiz = k === 'ArrowRight' || k === 'ArrowLeft';
            const along = horiz ? (k === 'ArrowRight' ? dx : -dx) : (k === 'ArrowDown' ? dy : -dy);
            if (along < 6) return;
            const d = along + Math.abs(horiz ? dy : dx) * 2.2;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          });
          if (best >= 0) setActive(best, true);
          return;
        }
        const cols = getComputedStyle(box).gridTemplateColumns.split(' ').length;
        let i = idx;
        if (k === 'ArrowRight') i = (i + 1) % n;
        else if (k === 'ArrowLeft') i = (i + n - 1) % n;
        else if (cols >= n) i = (i + (k === 'ArrowDown' ? 1 : n - 1)) % n;
        else {
          const j = i + (k === 'ArrowDown' ? cols : -cols);
          if (j >= 0 && j < n) i = j;
        }
        setActive(i, true);
      };

      // The path: tiers are columns left to right (rows top to bottom on phones); a tier with
      // more than three cards runs on into a second column; thin lines join a card to what it unlocks.
      const buildPath = () => {
        const tierOf = (o) => Math.max(0, Math.floor(Number(o.tier) || 0));
        const keys = [...new Set(options.map(tierOf))].sort((a, b) => a - b);
        const units = new Map(keys.map((k) => [k, []]));
        const used = new Set();
        options.forEach((o, i) => {
          if (used.has(i)) return;
          const mates = o.fork ? options.map((x, k) => k).filter((k) => options[k].fork === o.fork && tierOf(options[k]) === tierOf(o) && !used.has(k)) : [];
          if (mates.length > 1) {
            mates.forEach((k) => used.add(k));
            units.get(tierOf(o)).push({ fork: String(o.fork), idx: mates, size: 2 });
          } else {
            used.add(i);
            units.get(tierOf(o)).push({ idx: [i], size: 1 });
          }
        });
        const colsFor = (mp) => keys.map((k) => {
          let c = 1;
          let fill = 0;
          units.get(k).forEach((u) => {
            if (fill + u.size > mp) {
              c += 1;
              fill = 0;
            }
            fill += u.size;
          });
          return c;
        });
        let mp = 3;
        if (colsFor(3).reduce((a, b) => a + b, 0) > 6) mp = 4;
        const cols = colsFor(mp);
        const tall = Math.max(...keys.map((k) => Math.min(mp, units.get(k).reduce((a, u) => a + u.size, 0))));
        const hasFork = options.some((o) => o.fork);
        box.classList.add('rm-path');
        box.style.setProperty('--mp', mp);
        box.style.setProperty('--r', (Math.max(1, tall) + (hasFork ? 0.45 : 0)).toFixed(2));
        scroller = el('div', 'rm-pscroll');
        lineSvg = document.createElementNS(SVGNS, 'svg');
        lineSvg.setAttribute('class', 'rm-plines');
        lineSvg.setAttribute('aria-hidden', 'true');
        const tiersEl = el('div', 'rm-ptiers');
        keys.forEach((k, ti) => {
          const col = el('div', 'rm-tier');
          col.style.flex = `${cols[ti]} 1 0`;
          col.dataset.tier = k;
          col.style.gridTemplateRows = `repeat(${Math.min(mp, units.get(k).reduce((a, u) => a + u.size, 0))}, auto)`;
          units.get(k).forEach((u) => {
            if (u.fork) {
              const f = el('div', 'rm-fork');
              f.append(h('span', 'rm-fork-label', u.fork));
              u.idx.forEach((ci, n) => {
                if (n) f.append(h('span', 'rm-or', 'OR'));
                f.append(cards[ci]);
              });
              col.append(f);
            } else col.append(cards[u.idx[0]]);
          });
          tiersEl.append(col);
        });
        scroller.append(lineSvg, tiersEl);
        box.append(scroller);
      };
      const redraw = () => {
        if (!scroller) return;
        const vertical = window.matchMedia('(max-width: 700px)').matches;
        const w = scroller.scrollWidth;
        const hh = scroller.scrollHeight;
        lineSvg.setAttribute('width', w);
        lineSvg.setAttribute('height', hh);
        lineSvg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
        const first = cards[0];
        const cw = first.offsetWidth;
        const ch = first.offsetHeight;
        box.dataset.d = ch >= 150 && cw >= 230 ? 'l' : ch >= 118 ? 'm' : 's';
        const out = [];
        options.forEach((o, i) => (o.leadsTo || []).forEach((to) => {
          const j = options.findIndex((x) => x.id === to);
          if (j < 0 || j === i) return;
          const a = placeIn(cards[i], scroller);
          const b = placeIn(cards[j], scroller);
          const live = stateOf(o) === 'done';
          let ax;
          let ay;
          let bx;
          let by;
          let d;
          if (vertical) {
            ax = a.x + a.w / 2;
            ay = a.y + a.h;
            bx = b.x + b.w / 2;
            by = b.y;
            const m = Math.max(14, (by - ay) / 2);
            d = `M${ax} ${ay}C${ax} ${ay + m} ${bx} ${by - m} ${bx} ${by}`;
          } else {
            ax = a.x + a.w;
            ay = a.y + a.h / 2;
            bx = b.x;
            by = b.y + b.h / 2;
            const m = Math.max(14, (bx - ax) / 2);
            d = `M${ax} ${ay}C${ax + m} ${ay} ${bx - m} ${by} ${bx} ${by}`;
          }
          out.push(`<path class="${live ? 'is-live' : ''}" data-from="${i}" data-to="${j}" d="${d}"/><circle class="${live ? 'is-live' : ''}" cx="${ax}" cy="${ay}" r="4.5"/><path class="rm-pend ${live ? 'is-live' : ''}" d="M${bx} ${by}${vertical ? `l-6 -9h12z` : `l-9 -6v12z`}"/>`);
        }));
        lineSvg.innerHTML = out.join('');
        if (idx >= 0) lineSvg.querySelectorAll('path[data-from]').forEach((n) => n.classList.toggle('is-hot', +n.dataset.from === idx || +n.dataset.to === idx));
      };

      p.stop = () => {
        t.stop();
        ro?.disconnect();
        if (ro) observers.delete(ro);
        if (!picked) box?.remove();
      };
      p.advance = () => { if (!ready) t.finish(); };
      p.key = (e) => {
        if (!ready) {
          if (isAdvance(e)) { e.preventDefault(); if (!e.repeat) t.finish(); }
          return;
        }
        const slot = e.key.length === 1 ? KEYS.indexOf(e.key) : -1;
        if (slot >= 0) {
          if (slot < options.length) { e.preventDefault(); choose(slot); }
        } else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          move(e.key);
        } else if (e.key === 'Enter' && !cards.includes(document.activeElement)) {
          e.preventDefault();
          if (!e.repeat) choose(idx);
        }
      };

      t.done.then(() => {
        if (cur !== p) return;
        const wide = style === 'board' && !path && options.length > 6;
        box = el('div', `rm-choices rm-${style}${wide ? ' rm-wide' : ''}${opts.confirm ? ' rm-confirm' : ''}${wide && options.length % 4 === 3 ? ' rm-odd3' : ''}${wide && options.length % 2 ? ' rm-odd' : ''}`);
        box.setAttribute('role', 'group');
        box.setAttribute('aria-label', String(question));
        box.style.setProperty('--n', options.length);
        cards = options.map((o, i) => buildCard(style, o, i, path));
        if (style === 'board' && options.some(isGated)) {
          need = el('div', 'rm-need');
          need.setAttribute('role', 'status');
          box.append(need);
        }
        cards.forEach((c, i) => {
          c.addEventListener('click', () => choose(i));
          c.addEventListener('focus', () => setActive(i));
          c.addEventListener('pointerenter', (e) => {
            if (e.pointerType !== 'mouse' || picked) return;
            if (cards.includes(document.activeElement) && document.activeElement !== c) document.activeElement.blur();
            setActive(i);
          });
        });
        if (path) buildPath(); else box.prepend(...cards);
        stack.insertBefore(box, panel);
        if (path) {
          redraw();
          if (typeof ResizeObserver === 'function') {
            ro = new ResizeObserver(redraw);
            ro.observe(scroller);
            observers.add(ro);
          }
        }
        ready = true;
        if (window.matchMedia('(hover: hover)').matches) setActive(path ? Math.max(0, options.findIndex((o) => stateOf(o) === 'open')) : 0, true);
      });
    });
  }

  function askText(question, opts = {}) {
    const { placeholder = '', maxLength = 24, fallback = '' } = opts;
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback };
      begin(p);
      clearChoices();
      const t = typewrite(question, opts.speaker);
      let ready = false;
      let box = null;
      let sent = false;
      p.stop = () => { t.stop(); if (!sent) box?.remove(); };
      p.advance = () => { if (!ready) t.finish(); };
      p.key = (e) => {
        if (!ready && isAdvance(e)) { e.preventDefault(); if (!e.repeat) t.finish(); }
      };
      t.done.then(() => {
        if (cur !== p) return;
        ready = true;
        const input = el('input', 'rm-input');
        input.type = 'text';
        input.id = `${id}-in`;
        input.maxLength = maxLength;
        input.placeholder = placeholder;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.enterKeyHint = 'done';
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.repeat) e.preventDefault(); });
        const label = el('label', 'rm-sr', String(question));
        label.htmlFor = input.id;
        const go = h('button', 'rm-go', h('span', null, 'Enter'));
        go.type = 'submit';
        go.setAttribute('aria-label', 'Submit');
        go.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 6v6H6m0 0l4-4m-4 4l4 4"/></svg>');
        box = h('form', 'rm-choices rm-field', label, input, go);
        box.noValidate = true;
        const shownAt = performance.now();
        box.addEventListener('submit', (e) => {
          e.preventDefault();
          // The Enter that dismissed the line before this field must not also submit it.
          if (sent || performance.now() - shownAt < 350) return;
          sent = true;
          const v = input.value.trim() || fallback;
          box.classList.add('is-done');
          input.readOnly = true;
          input.blur();
          later(() => { leave(box); settle(p, v); }, 260);
        });
        stack.insertBefore(box, panel);
        later(() => { if (cur === p) input.focus({ preventScroll: true }); }, 60);
      });
    });
  }

  // The memories chip sits in the same corner as the HUD chips, so it drops below whatever the HUD
  // has stacked there. On phones the objective row also gives up the width the stack takes.
  const syncCorner = () => {
    const hudOn = hudEl.classList.contains('is-on');
    const trH = trEl.offsetHeight;
    const memOn = memEl.classList.contains('is-on');
    const walOn = walEl.classList.contains('is-on');
    const y0 = hudOn && trH ? trH + 10 : 0;
    const y1 = y0 + (memOn ? memChip.offsetHeight + 10 : 0);
    layer.style.setProperty('--rm-mem-y', `${y0}px`);
    layer.style.setProperty('--rm-wal-y', `${y1}px`);
    const lowest = trEl.offsetTop + (walOn ? y1 + walChip.offsetHeight : memOn ? y0 + memChip.offsetHeight : trH);
    const wide = Math.max(moneyEl.hidden ? 0 : moneyEl.offsetWidth, memOn ? memChip.offsetWidth : 0, walOn ? walChip.offsetWidth : 0);
    layer.style.setProperty('--rm-rc-w', hudOn && lowest > 62 && wide ? `${wide + 12}px` : '0px');
    if (goalsEl.classList.contains('is-on')) {
      const base = goalsProbe.offsetTop;
      let bottom = 0;
      if (hudOn) for (const n of [tlEl, subEl]) { const r = n.getBoundingClientRect(); if (r.height > 0) bottom = Math.max(bottom, r.bottom); }
      layer.style.setProperty('--rm-goals-y', `${bottom ? Math.max(0, Math.round(bottom + 10 - base)) : 0}px`);
    }
  };
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(syncCorner);
    [trEl, memChip, walChip, moneyEl, tlEl, subEl, goalsEl].forEach((n) => ro.observe(n));
    observers.add(ro);
  }

  const hud = (() => {
    let on = false;
    let shown = 0;
    let target = 0;
    let stopScore = null;
    let lastSecs = null;
    let lastMoney = null;
    let lastMeter = null;
    let lastPrompt = null;
    let lastClock = null;
    let promptTimer = 0;
    let abilSig = '';
    let slots = [];

    const setTime = (v) => {
      if (v == null) {
        timerEl.classList.add('is-off');
        hudEl.classList.remove('has-timer');
        lastSecs = null;
        return;
      }
      hudEl.classList.add('has-timer');
      const t = Number(v) || 0;
      const secs = Math.max(0, Math.ceil(t));
      const urgent = t < 10;
      timerEl.classList.remove('is-off');
      timerEl.classList.toggle('is-urgent', urgent);
      if (secs === lastSecs) return;
      lastSecs = secs;
      timerEl.firstChild.textContent = clock(secs);
      if (urgent) restart(timerEl, 'is-tick');
    };
    const setScore = (v) => {
      const n = Number(v) || 0;
      if (n === target) return;
      target = n;
      stopScore?.();
      const from = shown;
      if (!on || reduced() || n < shown) {
        shown = n;
        scoreNum.textContent = fmt(n);
        return;
      }
      stopScore = tween(from, n, clamp(160 + Math.abs(n - from) * 2, 220, 650), (x) => {
        shown = x;
        scoreNum.textContent = fmt(x);
      });
      if (n > from) restart(scoreNum, 'is-bump');
    };

    const out = (t) => {
      t.classList.remove('is-in');
      t.classList.add('is-out');
      later(() => t.remove(), 340);
    };

    const setMoney = (v) => {
      if (v == null || v === '') {
        moneyEl.hidden = true;
        lastMoney = null;
        return;
      }
      const s = typeof v === 'number' ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : String(v);
      if (s === lastMoney) return;
      const fresh = lastMoney == null;
      lastMoney = s;
      rich(moneyNum, s);
      moneyEl.setAttribute('aria-label', `Money: ${s.replace(/∞/g, 'unlimited')}`);
      moneyEl.hidden = false;
      restart(moneyEl, fresh ? 'is-in' : 'is-bump');
    };

    // `balance` turns the fill into a needle on a track whose ends are the danger zones (a grind, a wobble).
    const setMeter = (label, v, o = {}) => {
      if (v == null) {
        meterEl.hidden = true;
        lastMeter = null;
        return;
      }
      const k = String(label ?? '');
      const f = clamp(Number(v) || 0, 0, 1);
      const bal = !!o?.balance;
      const fresh = meterEl.hidden;
      if (fresh) meterEl.hidden = false;
      if (meterKey.textContent !== k) meterKey.textContent = k;
      meterKey.hidden = !k;
      meterEl.setAttribute('aria-label', k);
      const sig = `${f}|${bal}`;
      if (sig === lastMeter) return;
      lastMeter = sig;
      meterEl.classList.toggle('is-balance', bal);
      // A meter that has just appeared snaps to its value instead of sliding there from full.
      if (fresh) meterFill.style.transition = 'none';
      if (bal) {
        meterFill.style.transform = '';
        meterFill.style.left = `${f * 100}%`;
      } else {
        meterFill.style.left = '';
        meterFill.style.transform = `scaleX(${f})`;
      }
      if (fresh) {
        void meterFill.offsetWidth;
        meterFill.style.transition = '';
      }
      meterEl.classList.toggle('is-low', bal ? Math.abs(f - 0.5) > 0.3 : f < 0.25);
      meterEl.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    };

    const setPrompt = (text) => {
      const s = text == null ? '' : String(text).trim();
      if (s === lastPrompt) return;
      lastPrompt = s;
      unlater(promptTimer);
      if (!s) {
        promptEl.classList.add('is-out');
        promptTimer = later(() => { promptEl.hidden = true; promptEl.classList.remove('is-out'); }, 220);
        return;
      }
      // "E · TAKE THE CAB" renders the lead as a key cap.
      const m = /^(\S{1,8})\s*[·•]\s*(.+)$/.exec(s);
      const body = el('span');
      rich(body, m ? m[2] : s);
      promptEl.replaceChildren(...(m ? [el('kbd', null, m[1]), body] : [body]));
      promptEl.classList.remove('is-out');
      if (promptEl.hidden) {
        promptEl.hidden = false;
        restart(promptEl, 'is-in');
      }
    };

    const setAbilities = (list) => {
      if (!Array.isArray(list) || !list.length) {
        abilEl.hidden = true;
        abilEl.replaceChildren();
        abilSig = '';
        slots = [];
        return;
      }
      const items = list.slice(0, 9).map((a) => ({
        key: String(a.key ?? ''), id: String(a.id ?? ''), label: String(a.label ?? ''),
        glyph: a.glyph || a.id, colour: a.colour, active: !!a.active,
      }));
      // Games call this every frame; only a change in the list itself rebuilds, a change of active slot just flips classes.
      const sig = items.map((a) => `${a.key}|${a.id}|${a.label}|${a.glyph}|${a.colour ?? ''}`).join('~');
      if (sig !== abilSig) {
        abilSig = sig;
        slots = items.map((a) => {
          const c = a.colour || GLYPH_COLOURS[a.glyph] || GLYPH_COLOURS.foot;
          const tile = h('span', 'rm-ab-tile', h('span', 'rm-ab-key', a.key));
          tile.style.setProperty('--c', c);
          if (GLYPHS[a.glyph]) {
            const g = el('span', 'rm-ab-g');
            g.innerHTML = GLYPHS[a.glyph];
            tile.prepend(g);
          }
          const s = h('div', 'rm-ab', tile, h('span', 'rm-ab-label', a.label));
          s.setAttribute('role', 'listitem');
          s.setAttribute('aria-label', `${a.key}, ${a.label}`);
          return s;
        });
        abilEl.replaceChildren(...slots);
      }
      items.forEach((a, i) => {
        const s = slots[i];
        if (s.classList.contains('is-active') === a.active) return;
        s.classList.toggle('is-active', a.active);
        if (a.active) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current');
      });
      if (abilEl.hidden) abilEl.hidden = false;
    };

    return {
      show() { on = true; hudEl.classList.add('is-on'); syncCorner(); },
      hide() { on = false; hudEl.classList.remove('is-on'); syncCorner(); },
      // The tracked quest, one slim line under the objective; null hides it.
      quest(text) {
        if (dead) return;
        const t = text == null ? '' : String(text).trim();
        if (questEl.lastChild.textContent === t) return;
        questEl.lastChild.textContent = t;
        questEl.hidden = !t;
      },
      // A small day/time chip for modes with no timer ("DAY 2 · 6:40 PM"); null hides it.
      clock(text) {
        if (dead) return;
        const t = text == null ? '' : String(text).trim();
        if (t === lastClock) return;
        lastClock = t;
        clockTxt.textContent = t;
        clockEl.hidden = !t;
        hudEl.classList.toggle('has-clock', !!t);
      },
      abilities(list) { if (!dead) setAbilities(list); },
      prompt(text) { if (!dead) setPrompt(text); },
      meter(label, value, opts) { if (!dead) setMeter(label, value, opts); },
      set(patch = {}) {
        if (dead) return;
        if (patch.title !== undefined) {
          const t = patch.title ?? '';
          if (titleEl.lastChild.textContent !== t) titleEl.lastChild.textContent = t;
          titleEl.hidden = !t;
        }
        if (patch.objective !== undefined) {
          const o = patch.objective ?? '';
          if (objEl.lastChild.textContent !== o) objEl.lastChild.textContent = o;
          objEl.hidden = !o;
        }
        if (patch.time !== undefined) setTime(patch.time);
        if (patch.score !== undefined) {
          scoreEl.hidden = patch.score === null;
          if (patch.score !== null) setScore(patch.score);
        }
        if (patch.money !== undefined) setMoney(patch.money);
      },
      toast(text, kind = 'info') {
        if (dead) return;
        const k = kind === 'good' || kind === 'bad' ? kind : 'info';
        const ic = el('i', 'rm-toast-ic');
        ic.innerHTML = TOAST_ICONS[k];
        const t = h('div', `rm-toast rm-toast-${k}`, h('div', 'rm-toast-in', ic, h('span', null, String(text))));
        toastsEl.append(t);
        void t.offsetWidth;
        t.classList.add('is-in');
        const live = [...toastsEl.children].filter((c) => !c.classList.contains('is-out'));
        while (live.length > 3) out(live.shift());
        later(() => out(t), 1600 + clamp((String(text).length - 40) * 45, 0, 2000));
      },
      callout(text) {
        if (dead) return Promise.resolve();
        const s = String(text);
        const c = el('div', 'rm-callout-item');
        c.append(h('span', null, s));
        if (/^go\b/i.test(s)) c.classList.add('is-go');
        calloutEl.replaceChildren(c);
        return new Promise((res) => later(() => { c.remove(); res(); }, 700));
      },
    };
  })();

  function results({ title = '', subtitle = '', score = 0, rank = 'C', lines = [], actions = [] } = {}) {
    const acts = actions.length ? actions : [{ id: 'continue', label: 'Continue' }];
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: acts[0].id };
      begin(p);
      const total = Number(score) || 0;
      const titleId = `${id}-res-title`;
      const rankLetter = String(rank).toUpperCase();

      const scoreB = el('b', null, '0');
      const btns = acts.map((a, i) => {
        const b = h('button', 'rm-btn', h('kbd', null, String(i + 1)), h('span', null, String(a.label)));
        b.type = 'button';
        b.setAttribute('aria-keyshortcuts', String(i + 1));
        return b;
      });
      const card = h('div', 'rm-res-card',
        h('header', 'rm-res-head',
          h('h2', null, String(title)),
          subtitle ? h('p', null, String(subtitle)) : null),
        h('div', 'rm-res-body',
          h('div', `rm-res-rank rm-rank-${rankLetter}`,
            h('small', null, 'Rank'),
            h('div', 'rm-rank-wrap', h('div', 'rm-rays'), h('div', 'rm-rank', h('span', null, rankLetter)))),
          h('div', 'rm-res-main',
            h('div', 'rm-res-score', h('small', null, 'Score'), scoreB),
            h('ul', 'rm-res-lines', ...lines.map((l, i) => {
              const li = h('li', null, h('span', 'rm-k', String(l.label)), h('i'), h('span', 'rm-v', String(l.value)));
              li.style.setProperty('--i', i);
              return li;
            })))),
        h('div', 'rm-res-actions', ...btns));
      card.querySelector('.rm-rank').style.filter = `url(#${id}-ink)`;
      const box = h('div', 'rm-results', card);
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', titleId);
      card.querySelector('h2').id = titleId;
      layer.insertBefore(box, calloutEl);

      let ready = false;
      let readyAt = 0;
      let stopCount = null;
      const seq = [];
      const at = (fn, ms) => seq.push(later(fn, ms));
      const lock = () => performance.now() - readyAt < 350;

      const finish = () => {
        if (ready) return;
        ready = true;
        readyAt = performance.now();
        seq.forEach(unlater);
        stopCount?.();
        scoreB.textContent = fmt(total);
        box.classList.add('is-stamped', 'is-ready');
        btns[0].focus({ preventScroll: true });
      };
      const pick = (i) => {
        if (!ready || lock() || box.classList.contains('is-leaving')) return;
        btns[i].classList.add('is-picked');
        box.classList.add('is-leaving');
        later(() => settle(p, acts[i].id), 240);
      };

      const dur = reduced() ? 0 : clamp(700 + Math.sqrt(Math.max(0, total)) * 6, 900, 1700);
      if (dur) {
        at(() => { stopCount = tween(0, total, dur, (x) => { scoreB.textContent = fmt(x); }); }, 420);
        at(() => { box.classList.add('is-stamped'); restart(card, 'is-thud'); }, 420 + dur + 120);
        at(finish, 420 + dur + 720);
      } else finish();

      btns.forEach((b, i) => b.addEventListener('click', () => pick(i)));
      box.addEventListener('click', () => { if (!ready) finish(); });

      p.stop = () => { seq.forEach(unlater); stopCount?.(); box.remove(); };
      p.advance = () => { if (!ready) finish(); };
      p.key = (e) => {
        if (!ready) {
          if (e.key === 'Tab') e.preventDefault();
          else if (isAdvance(e)) { e.preventDefault(); if (!e.repeat) finish(); }
          return;
        }
        const at0 = btns.indexOf(document.activeElement);
        if (/^[1-9]$/.test(e.key)) {
          if (+e.key <= btns.length) { e.preventDefault(); pick(+e.key - 1); }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
          btns[(Math.max(at0, 0) + d + btns.length) % btns.length].focus();
        } else if (e.key === 'Enter' && at0 < 0) {
          e.preventDefault();
          if (!e.repeat) pick(0);
        } else if (e.key === 'Tab') {
          const last = btns.length - 1;
          if (at0 < 0 || (e.shiftKey && at0 === 0) || (!e.shiftKey && at0 === last)) {
            e.preventDefault();
            btns[e.shiftKey ? last : 0].focus();
          }
        }
      };
    });
  }

  let memShown = 0;
  let memStop = null;
  let memTimer = 0;

  const memPop = (d) => {
    const pop = el('span', `rm-mem-pop${d < 0 ? ' is-neg' : ''}${reduced() ? ' is-still' : ''}`, `${d < 0 ? '−' : '+'}${fmt(Math.abs(d))}`);
    pop.setAttribute('aria-hidden', 'true');
    memEl.append(pop);
    later(() => pop.remove(), 1700);
  };

  // The persistent chip: counts toward `total`, pops "+delta" (or "−delta" when memories are spent).
  function memories(total, delta = 0) {
    if (dead) return;
    unlater(memTimer);
    memStop?.();
    if (total == null) {
      memTotal = null;
      memEl.classList.remove('is-on');
      syncCorner();
      return;
    }
    const n = Math.max(0, Math.round(Number(total) || 0));
    const d = Math.round(Number(delta) || 0);
    const fresh = memTotal == null;
    memTotal = n;
    memSr.textContent = `${fmt(n)} memories${d ? `, ${d > 0 ? 'plus' : 'minus'} ${fmt(Math.abs(d))}` : ''}`;
    memChip.setAttribute('aria-label', `${fmt(n)} memories`);
    memEl.classList.add('is-on');
    if (fresh) memShown = Math.max(0, n - d);
    if (reduced()) memShown = n;
    memNum.textContent = fmt(memShown);
    if (d) later(() => memPop(d), fresh ? 380 : 0);
    if (memShown !== n) {
      const from = memShown;
      const go = () => {
        if (n > from) restart(memNum, 'is-bump');
        memStop = tween(from, n, clamp(500 + Math.abs(n - from), 600, 1400), (x) => {
          memShown = x;
          memNum.textContent = fmt(x);
        });
      };
      memTimer = later(go, fresh ? 520 : d ? 300 : 0);
    }
    syncCorner();
  }

  // Sparks fly from the stamp when a title lands; fixed angles so a replay looks the same.
  const SPARKS = Array.from({ length: 16 }, (_, i) => ({
    a: Math.round((i / 16) * 360 + ((i * 53) % 17) - 8),
    r: 150 + ((i * 71) % 130),
    z: (0.7 + ((i * 29) % 7) / 6).toFixed(2),
    d: (i % 4) * 45,
  }));

  function unlock({ kicker = '', title = '', text = '' } = {}) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: undefined };
      begin(p);
      const titleId = `${id}-un-title`;
      const tEl = h('h2', 'rm-un-title', String(title));
      tEl.id = titleId;
      const stamp = h('div', 'rm-un-stamp', tEl);
      stamp.style.filter = `url(#${id}-ink)`;
      const slot = h('div', 'rm-un-slot', stamp);
      const btn = h('button', 'rm-btn', h('kbd'), h('span', null, 'Continue'));
      btn.type = 'button';
      btn.firstChild.innerHTML = RETURN;
      const card = h('div', 'rm-un-card',
        kicker ? h('header', 'rm-un-head', el('i'), h('span', null, String(kicker))) : null,
        h('div', 'rm-un-body', slot, text ? h('p', 'rm-un-text', String(text)) : null),
        h('div', 'rm-un-actions', btn));
      const rays = el('div', 'rm-un-rays');
      const fx = h('div', 'rm-un-fx', el('div', 'rm-un-ring'), ...SPARKS.map((s) => {
        const n = el('i');
        n.style.cssText = `--a:${s.a}deg;--r:${s.r}px;--z:${s.z};--d:${s.d}ms`;
        return n;
      }));
      const box = h('div', 'rm-unlock', rays, card, fx);
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', titleId);
      layer.insertBefore(box, calloutEl);

      // A long single word (SKATEBOARDING on a phone) shrinks to fit rather than running off the stamp.
      const fit = () => {
        tEl.style.fontSize = '';
        if (tEl.scrollWidth > tEl.clientWidth + 1) {
          tEl.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(tEl).fontSize) * (tEl.clientWidth / tEl.scrollWidth))}px`;
        }
      };
      const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
      if (ro) {
        ro.observe(slot);
        observers.add(ro);
      } else fit();

      let ready = false;
      let stamped = false;
      let readyAt = 0;
      const seq = [];
      const at = (fn, ms) => seq.push(later(fn, ms));
      const lock = () => performance.now() - readyAt < 350;

      const slam = () => {
        if (stamped) return;
        stamped = true;
        const s = stamp.getBoundingClientRect();
        const o = box.getBoundingClientRect();
        fx.style.left = `${s.left + s.width / 2 - o.left}px`;
        fx.style.top = `${s.top + s.height / 2 - o.top}px`;
        box.classList.add('is-stamped');
        restart(card, 'is-thud');
      };
      const finish = () => {
        if (ready) return;
        ready = true;
        readyAt = performance.now();
        seq.forEach(unlater);
        slam();
        box.classList.add('is-ready');
        btn.focus({ preventScroll: true });
      };
      const dismiss = () => {
        if (!ready || lock() || box.classList.contains('is-leaving')) return;
        btn.classList.add('is-picked');
        box.classList.add('is-leaving');
        later(() => settle(p), 240);
      };

      if (reduced()) finish();
      else {
        at(slam, 650);
        at(finish, 1450);
      }

      box.addEventListener('click', () => { if (ready) dismiss(); else finish(); });
      p.stop = () => {
        seq.forEach(unlater);
        if (ro) {
          ro.disconnect();
          observers.delete(ro);
        }
        box.remove();
      };
      p.advance = () => { if (ready) dismiss(); else finish(); };
      p.key = (e) => {
        if (e.key === 'Tab') e.preventDefault();
        else if (isAdvance(e)) {
          e.preventDefault();
          if (!e.repeat) p.advance();
        }
      };
    });
  }

  async function confirm(question, yesLabel = 'Yes', noLabel = 'No') {
    const pick = await ask(question, [{ id: 'yes', label: String(yesLabel) }, { id: 'no', label: String(noLabel) }], { style: 'memory', confirm: true });
    return pick === 'yes';
  }

  let walValue = null;
  let walStop = null;
  let walTimer = 0;

  const walPop = (d) => {
    const pop = el('span', `rm-mem-pop${d < 0 ? ' is-neg' : ''}${reduced() ? ' is-still' : ''}`, `${d < 0 ? '−' : '+'}${cash(Math.abs(d))}`);
    pop.setAttribute('aria-hidden', 'true');
    walEl.append(pop);
    later(() => pop.remove(), 1700);
  };

  // The player's cash, persistent like the memories chip; the +/- pop is worked out from the change.
  function wallet(amount) {
    if (dead) return;
    unlater(walTimer);
    walStop?.();
    if (amount == null) {
      walValue = null;
      walEl.classList.remove('is-on');
      syncCorner();
      return;
    }
    const n = typeof amount === 'number' ? amount : Number(String(amount).replace(/[$,]/g, ''));
    const fresh = !walEl.classList.contains('is-on');
    walEl.classList.add('is-on');
    if (!Number.isFinite(n)) {
      walValue = null;
      rich(walNum, String(amount));
      walSr.textContent = `Wallet: ${String(amount).replace(/∞/g, 'unlimited')}`;
      walChip.setAttribute('aria-label', walSr.textContent);
      syncCorner();
      return;
    }
    const d = walValue == null || fresh ? 0 : Math.round((n - walValue) * 100) / 100;
    const from = walValue == null ? n : walValue;
    walValue = n;
    walSr.textContent = `Wallet: ${cash(n)}${d ? `, ${d > 0 ? 'plus' : 'minus'} ${cash(Math.abs(d))}` : ''}`;
    walChip.setAttribute('aria-label', `Wallet: ${cash(n)}`);
    walNum.textContent = cash(d && !reduced() ? from : n);
    if (d) {
      walPop(d);
      if (!reduced()) {
        const cents = !Number.isInteger(n) || !Number.isInteger(from);
        walTimer = later(() => {
          if (d > 0) restart(walNum, 'is-bump');
          walStop = tween(from, n, clamp(450 + Math.abs(d) * 4, 500, 1100), (x) => {
            walNum.textContent = cash(cents ? Math.round(x * 100) / 100 : Math.round(x), cents);
          });
        }, 260);
      }
    }
    syncCorner();
  }

  function closeTalk() {
    if (dead || !tk) return;
    const t = tk;
    tk = null;
    unlater(t.swapT);
    unlater(t.queueT);
    t.turn?.cancel();
    if (cur?.talk) settle(cur, null);
    t.ro?.disconnect();
    if (t.ro) observers.delete(t.ro);
    t.box.classList.add('is-leaving');
    later(() => t.box.remove(), 320);
  }

  function buildTalk() {
    const box = el('div', 'rm-talk');
    box.innerHTML = `
      <div class="rm-tk-wrap">
        <div class="rm-tk-card" role="dialog" aria-modal="true">
          <button type="button" class="rm-tk-x" aria-label="Walk away"><kbd>Esc</kbd><span>Walk away</span></button>
          <div class="rm-tk-body">
            <div class="rm-tk-side">
              <div class="rm-tk-pic"><div class="rm-tk-photo"></div></div>
              <ul class="rm-tk-facts"></ul>
            </div>
            <div class="rm-tk-main">
              <div class="rm-tk-head">
                <h2 class="rm-tk-name"><span></span></h2>
                <div class="rm-tk-sub"><p class="rm-tk-job"></p><span class="rm-tk-money" hidden></span></div>
              </div>
              <div class="rm-tk-status">
                <div class="rm-tk-mood"><i></i><div><small>Mood</small><b></b></div></div>
                <div class="rm-tk-op"><small>Opinion of you</small><b></b><div class="rm-tk-meter"><u></u><i></i></div></div>
              </div>
              <blockquote class="rm-tk-line" aria-live="polite"><span class="rm-sr"></span><span class="rm-type" aria-hidden="true"><span class="rm-on"></span><span class="rm-off"></span></span></blockquote>
              <div class="rm-tk-opts" role="group"></div>
            </div>
          </div>
        </div>
      </div>`;
    const q = (sel) => box.querySelector(sel);
    const t = {
      box, card: q('.rm-tk-card'), main: q('.rm-tk-main'), photo: q('.rm-tk-photo'), facts: q('.rm-tk-facts'),
      name: q('.rm-tk-name span'), job: q('.rm-tk-job'), money: q('.rm-tk-money'), moodFace: q('.rm-tk-mood i'),
      moodWord: q('.rm-tk-mood b'), meter: q('.rm-tk-meter'), fill: q('.rm-tk-meter i'), opWord: q('.rm-tk-op b'),
      line: q('.rm-tk-line'), sr: q('.rm-tk-line .rm-sr'), on: q('.rm-tk-line .rm-on'), off: q('.rm-tk-line .rm-off'),
      opts: q('.rm-tk-opts'), ro: null,
    };
    q('.rm-tk-x').addEventListener('click', () => closeTalk());
    t.card.addEventListener('click', (e) => { if (!e.target.closest('button')) cur?.advance?.(); });
    layer.insertBefore(box, calloutEl);
    if (typeof ResizeObserver === 'function') {
      t.ro = new ResizeObserver(() => shrinkToFit(t.name));
      t.ro.observe(t.main);
      observers.add(t.ro);
    }
    return t;
  }

  // A Persona-style character card. Resolves with the chosen option id, or null when you walk away.
  // Calling it again while open flips the card to the new content; the old promise is already settled.
  function talk(data = {}) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: null, talk: true };
      begin(p);
      stack.classList.add('is-hidden');
      const options = (Array.isArray(data.options) ? data.options : []).slice(0, 4);
      const fresh = !tk;
      if (fresh) tk = buildTalk();
      const T = tk;
      let t = null;
      let ready = false;
      let picked = false;
      let idx = 0;
      let btns = [];

      const setActive = (i, focus) => {
        idx = i;
        btns.forEach((b, k) => b.classList.toggle('is-active', k === i));
        if (focus) btns[i]?.focus({ preventScroll: true });
      };
      const choose = (i) => {
        if (picked || !ready) return;
        if (options[i].disabled) {
          setActive(i, true);
          restart(btns[i], 'is-nope');
          return;
        }
        picked = true;
        setActive(i);
        T.box.classList.add('is-waiting');
        btns.forEach((b, k) => { b.classList.toggle('is-picked', k === i); b.disabled = true; });
        p.waiting = true;
        p.resolve(options[i].id);
      };
      const move = (k) => {
        const n = btns.length;
        if (!n) return;
        const cols = getComputedStyle(T.opts).gridTemplateColumns.split(' ').length;
        let i = idx;
        if (k === 'ArrowRight') i = (i + 1) % n;
        else if (k === 'ArrowLeft') i = (i + n - 1) % n;
        else {
          const j = i + (k === 'ArrowDown' ? cols : -cols);
          i = j >= 0 && j < n ? j : (i + (k === 'ArrowDown' ? 1 : n - 1)) % n;
        }
        setActive(i, true);
      };

      p.stop = () => { t?.stop(); };
      p.advance = () => {
        if (p.waiting) return;
        if (!ready) t?.finish();
        else if (!options.length && !picked) {
          picked = true;
          p.waiting = true;
          p.resolve(null);
        }
      };
      p.key = (e) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          if (!e.repeat) closeTalk();
          return;
        }
        if (p.waiting) return;
        if (!ready) {
          if (isAdvance(e) || /^[1-4]$/.test(e.key)) { e.preventDefault(); if (!e.repeat) t?.finish(); }
          return;
        }
        if (/^[1-4]$/.test(e.key)) {
          if (+e.key <= options.length) { e.preventDefault(); choose(+e.key - 1); }
        } else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          move(e.key);
        } else if (isAdvance(e) && !btns.includes(document.activeElement)) {
          e.preventDefault();
          if (e.repeat) return;
          if (options.length) choose(idx); else p.advance();
        }
      };

      const render = () => {
        if (cur !== p) return;
        const name = String(data.name ?? '');
        const mood = MOODS[data.mood] ? data.mood : 'fine';
        const pic = portrait(data.portraitSeed ?? name);
        T.card.setAttribute('aria-label', `Talking to ${name}`);
        T.name.textContent = name;
        shrinkToFit(T.name);
        T.job.textContent = [data.job, data.place].filter(Boolean).join(' · ');
        const money = data.money;
        T.money.hidden = money == null || money === '';
        if (!T.money.hidden) T.money.textContent = typeof money === 'number' ? cash(money) : String(money);
        T.photo.innerHTML = pic.svg;
        T.photo.style.setProperty('--h', pic.hue);
        T.facts.replaceChildren(...(Array.isArray(data.facts) ? data.facts : []).slice(0, 3).map((f) => el('li', null, String(f))));
        T.facts.hidden = !T.facts.childElementCount;
        T.moodFace.innerHTML = moodFace(mood);
        T.moodWord.textContent = MOODS[mood][1];
        T.box.dataset.mood = mood;
        const o = data.opinion == null ? null : clamp(Number(data.opinion) || 0, -1, 1);
        T.meter.classList.toggle('is-unknown', o == null);
        T.meter.classList.toggle('is-neg', o != null && o < 0);
        T.fill.style.transition = 'none';
        T.fill.style.width = '0%';
        void T.fill.offsetWidth;
        T.fill.style.transition = '';
        T.fill.style.left = o != null && o >= 0 ? '50%' : '';
        T.fill.style.right = o != null && o < 0 ? '50%' : '';
        T.fill.style.width = `${o == null ? 0 : Math.abs(o) * 50}%`;
        T.opWord.textContent = opinionWord(o);
        T.opWord.classList.toggle('is-neg', o != null && o < -0.1);
        T.meter.setAttribute('role', 'meter');
        T.meter.setAttribute('aria-valuemin', '-100');
        T.meter.setAttribute('aria-valuemax', '100');
        if (o == null) T.meter.removeAttribute('aria-valuenow'); else T.meter.setAttribute('aria-valuenow', String(Math.round(o * 100)));
        T.meter.setAttribute('aria-label', `Opinion of you: ${opinionWord(o)}`);

        btns = options.map((opt, i) => {
          const b = el('button', 'rm-tk-opt');
          b.type = 'button';
          b.setAttribute('aria-keyshortcuts', String(i + 1));
          const key = h('span', 'rm-key', String(i + 1));
          key.setAttribute('aria-hidden', 'true');
          b.append(key, h('span', 'rm-tk-opt-t', h('b', null, String(opt.label)), opt.hint ? h('small', null, String(opt.hint)) : null));
          if (opt.disabled) {
            b.classList.add('is-disabled');
            b.setAttribute('aria-disabled', 'true');
          }
          b.addEventListener('click', () => choose(i));
          b.addEventListener('focus', () => setActive(i));
          b.addEventListener('pointerenter', (e) => {
            if (e.pointerType !== 'mouse' || picked) return;
            if (btns.includes(document.activeElement) && document.activeElement !== b) document.activeElement.blur();
            setActive(i);
          });
          b.style.setProperty('--i', i);
          return b;
        });
        T.opts.replaceChildren(...btns);
        T.opts.dataset.n = String(options.length);
        T.opts.hidden = !options.length;
        T.box.classList.remove('is-ready', 'is-waiting');

        const text = String(data.line ?? '');
        T.sr.textContent = text;
        T.line.hidden = !text;
        t = typer(T.on, T.off, T.line, Array.from(text));
        t.done.then(() => {
          if (cur !== p || ready) return;
          ready = true;
          T.box.classList.add('is-ready');
          const first = options.findIndex((o) => !o.disabled);
          if (btns.length && window.matchMedia('(hover: hover)').matches) setActive(Math.max(first, 0), true);
        });
      };

      // Replacing the card turns it over once: the old face swings edge-on, the new one swings in.
      // Calls that arrive mid-turn only change what the new face will be; they never start another turn.
      T.run = render;
      const TURN = 440;
      const startTurn = () => {
        T.queueT = 0;
        T.turnEnd = performance.now() + TURN;
        T.turn?.cancel();
        T.turn = T.card.animate([
          { transform: 'perspective(1100px) rotateX(0deg)', easing: 'cubic-bezier(.55, 0, .9, .55)', offset: 0 },
          { transform: 'perspective(1100px) rotateX(90deg)', offset: 0.5 },
          { transform: 'perspective(1100px) rotateX(-90deg)', easing: 'cubic-bezier(.1, .45, .4, 1)', offset: 0.5 },
          { transform: 'perspective(1100px) rotateX(0deg)', offset: 1 },
        ], { duration: TURN });
        T.swapT = later(() => { T.swapT = 0; T.run?.(); }, TURN / 2);
      };
      if (fresh || reduced() || typeof T.card.animate !== 'function') {
        unlater(T.swapT);
        unlater(T.queueT);
        T.swapT = 0;
        T.queueT = 0;
        render();
      } else if (T.swapT) {
        // before the swap: nothing to do, `T.run` already points at this call
      } else {
        const left = (T.turnEnd || 0) - performance.now();
        if (left > 0) {
          unlater(T.queueT);
          T.queueT = later(startTurn, left);
        } else startTurn();
      }
    });
  }

  // A one-shot overlay that settles on Enter / Space / click, with the same 350 ms double-press guard as results.
  // `build` gets { box, at, finish } and returns the animation length in ms; everything else is shared.
  function page({ cls, label, labelledBy, build, fallback, close }) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback };
      begin(p);
      const box = el('div', cls);
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      if (labelledBy) box.setAttribute('aria-labelledby', labelledBy);
      if (label) box.setAttribute('aria-label', label);
      let ready = false;
      let readyAt = 0;
      const seq = [];
      const extra = { stops: [], onFinish: null };
      const at = (fn, ms) => seq.push(later(fn, ms));
      const lock = () => performance.now() - readyAt < 350;
      const finish = () => {
        if (ready) return;
        ready = true;
        readyAt = performance.now();
        seq.forEach(unlater);
        extra.onFinish?.();
        box.classList.add('is-ready');
        box.querySelector('.rm-btn')?.focus({ preventScroll: true });
      };
      const dismiss = () => {
        if (!ready || lock() || box.classList.contains('is-leaving')) return;
        box.querySelector('.rm-btn')?.classList.add('is-picked');
        box.classList.add('is-leaving');
        later(() => settle(p, p.value), 240);
      };
      layer.insertBefore(box, calloutEl);
      const ms = build({ box, at, finish, extra, p, dismiss, isReady: () => ready });
      if (reduced() || !ms) finish(); else at(finish, ms);
      box.addEventListener('click', () => { if (ready) dismiss(); else finish(); });
      p.stop = () => {
        seq.forEach(unlater);
        extra.stops.forEach((f) => f());
        box.remove();
      };
      p.advance = () => { if (ready) dismiss(); else finish(); };
      p.key = (e) => {
        if (e.key === 'Tab') e.preventDefault();
        else if (isAdvance(e) || close?.(e)) {
          e.preventDefault();
          if (!e.repeat) p.advance();
        }
      };
      p.api = { box, dismiss, finish, isReady: () => ready };
    });
  }

  const contBtn = () => {
    const b = h('button', 'rm-btn', h('kbd'), h('span', null, 'Continue'));
    b.type = 'button';
    b.firstChild.innerHTML = RETURN;
    return b;
  };

  // The nightly account book: ruled lines, money in and out, a progress bar or two, a note in the margin.
  function ledger({ kicker = '', title = '', rows = [], note = '' } = {}) {
    const titleId = `${id}-lg-title`;
    return page({
      cls: 'rm-ledger',
      labelledBy: titleId,
      fallback: undefined,
      build({ box }) {
        const list = h('ol', 'rm-lg-rows', ...rows.map((r, i) => {
          const bar = r.progress != null;
          const li = h('li', `rm-lg-row${bar ? ' is-bar' : ''}${r.total ? ' is-total' : ''}`, h('span', 'rm-lg-k', String(r.label ?? '')));
          li.style.setProperty('--i', i);
          if (bar) {
            const f = clamp(Number(r.progress) || 0, 0, 1);
            const fill = el('i');
            fill.style.setProperty('--f', f);
            const track = h('span', 'rm-lg-bar', fill);
            track.setAttribute('role', 'meter');
            track.setAttribute('aria-valuemin', '0');
            track.setAttribute('aria-valuemax', '100');
            track.setAttribute('aria-valuenow', String(Math.round(f * 100)));
            track.setAttribute('aria-label', String(r.label ?? ''));
            li.append(track);
          } else li.append(el('i'));
          const v = r.value ?? (bar ? `${Math.round(clamp(Number(r.progress) || 0, 0, 1) * 100)}%` : '');
          if (v !== '') li.append(h('span', `rm-lg-v${r.tone === 'good' || r.tone === 'bad' ? ` is-${r.tone}` : ''}`, String(v)));
          return li;
        }));
        const sheet = h('div', 'rm-lg-sheet',
          h('div', 'rm-lg-holes', ...Array.from({ length: 6 }, () => el('i'))),
          h('header', 'rm-lg-head', kicker ? h('small', null, String(kicker)) : null, (() => { const t = h('h2', null, String(title)); t.id = titleId; return t; })()),
          list,
          note ? h('p', 'rm-lg-note', String(note)) : null,
          h('div', 'rm-lg-actions', contBtn()));
        box.append(sheet);
        sheet.querySelector('.rm-lg-rows').style.setProperty('--n', rows.length);
        return 700 + rows.length * 170 + (note ? 500 : 200);
      },
    });
  }

  // A hard choice: a situation, two or three ways out, and what each one costs and buys.
  function decision({ kicker = '', title = '', situation = '', options = [] } = {}) {
    const opts = options.slice(0, 4);
    const titleId = `${id}-dc-title`;
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: null };
      begin(p);
      const box = el('div', 'rm-decision');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', titleId);
      const tEl = h('h2', null, String(title));
      tEl.id = titleId;
      const btns = opts.map((o, i) => {
        const b = el('button', 'rm-dc-opt');
        b.type = 'button';
        b.style.setProperty('--i', i);
        b.setAttribute('aria-keyshortcuts', String(i + 1));
        const key = h('span', 'rm-key', String(i + 1));
        key.setAttribute('aria-hidden', 'true');
        b.append(key, h('b', 'rm-dc-l', String(o.label)),
          h('ul', 'rm-fx', ...(o.effects || []).map((f) => {
            const tone = f.tone === 'good' || f.tone === 'bad' ? f.tone : '';
            const c = h('li', `rm-fx-chip${tone ? ` is-${tone}` : ''}`, h('i', null, tone === 'good' ? '+' : tone === 'bad' ? '−' : '•'), h('span', null, String(f.text)));
            c.setAttribute('aria-label', `${tone === 'good' ? 'Good: ' : tone === 'bad' ? 'Bad: ' : ''}${f.text}`);
            return c;
          })));
        return b;
      });
      const card = h('div', 'rm-dc-card',
        h('header', 'rm-dc-head', kicker ? h('small', null, String(kicker)) : null, tEl),
        h('p', 'rm-dc-sit', String(situation)),
        (() => { const g = h('div', 'rm-dc-opts', ...btns); g.setAttribute('role', 'group'); g.dataset.n = String(btns.length); return g; })());
      box.append(card);
      layer.insertBefore(box, calloutEl);
      let ready = false;
      let picked = false;
      let idx = -1;
      const setActive = (i, focus) => {
        idx = i;
        btns.forEach((b, k) => b.classList.toggle('is-active', k === i));
        if (focus) btns[i]?.focus({ preventScroll: true });
      };
      const choose = (i) => {
        if (!ready || picked || !opts[i]) return;
        picked = true;
        setActive(i);
        box.classList.add('is-done');
        btns[i].classList.add('is-picked');
        const stamp = el('span', 'rm-stamp');
        stamp.innerHTML = CHECK;
        btns[i].append(stamp);
        btns.forEach((b) => { b.disabled = true; });
        later(() => { box.classList.add('is-leaving'); later(() => settle(p, opts[i].id), 240); }, 350);
      };
      const at = later(() => { ready = true; box.classList.add('is-ready'); }, reduced() ? 0 : 900);
      if (reduced()) { unlater(at); ready = true; box.classList.add('is-ready'); }
      btns.forEach((b, i) => {
        b.addEventListener('click', () => choose(i));
        b.addEventListener('focus', () => setActive(i));
        b.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse' || picked || !ready) return;
          if (btns.includes(document.activeElement) && document.activeElement !== b) document.activeElement.blur();
          setActive(i);
        });
      });
      p.stop = () => { unlater(at); box.remove(); };
      p.key = (e) => {
        if (e.key === 'Tab') { if (!btns.includes(document.activeElement)) { e.preventDefault(); if (ready) setActive(e.shiftKey ? btns.length - 1 : 0, true); } return; }
        if (!ready) return;
        if (/^[1-9]$/.test(e.key)) {
          if (+e.key <= opts.length) { e.preventDefault(); choose(+e.key - 1); }
        } else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
          setActive(idx < 0 ? (d > 0 ? 0 : btns.length - 1) : (idx + d + btns.length) % btns.length, true);
        } else if (e.key === 'Enter' && idx >= 0 && !btns.includes(document.activeElement)) {
          e.preventDefault();
          if (!e.repeat) choose(idx);
        }
      };
    });
  }

  // Election night: bars race up the chart, the winner is stamped, Enter carries on.
  function election({ title = 'Election night', candidates = [], total, turnout } = {}) {
    const list = candidates.slice(0, 6).map((c) => ({ name: String(c.name ?? ''), votes: Math.max(0, Number(c.votes) || 0), you: !!c.you }));
    const sum = list.reduce((a, c) => a + c.votes, 0);
    const all = Number(total) > 0 ? Number(total) : sum;
    const max = Math.max(1, ...list.map((c) => c.votes));
    const winner = list.reduce((w, c, i) => (c.votes > (list[w]?.votes ?? -1) ? i : w), 0);
    const order = list.map((c, i) => i).sort((a, b) => list[b].votes - list[a].votes);
    const pace = list.map((c, i) => (i === winner ? 1.9 : 0.55 + order.indexOf(i) * 0.2));
    const titleId = `${id}-el-title`;
    const tn = typeof turnout === 'number' ? `${Math.round((turnout <= 1 ? turnout * 100 : turnout) * 10) / 10}%` : turnout != null ? String(turnout) : '';
    const you = list.findIndex((c) => c.you);
    const margin = you >= 0 ? (you === winner ? list[you].votes - Math.max(0, ...list.filter((c, i) => i !== you).map((c) => c.votes)) : list[winner].votes - list[you].votes) : 0;
    return page({
      cls: 'rm-elect',
      labelledBy: titleId,
      fallback: undefined,
      build({ box, extra }) {
        const cols = list.map((c, i) => {
          const face = el('span', 'rm-el-face');
          face.innerHTML = portrait(c.name).svg;
          const num = el('b', 'rm-el-num', '0');
          const bar = h('div', 'rm-el-bar', el('i'));
          const area = h('div', 'rm-el-area', bar, num);
          const col = h('div', `rm-el-col${c.you ? ' is-you' : ''}`, area, face,
            h('span', 'rm-el-name', c.name), h('small', 'rm-el-pct', ''));
          col.style.setProperty('--i', i);
          if (c.you) col.append(h('span', 'rm-el-you', 'You'));
          return { c, col, bar, num, pct: col.querySelector('.rm-el-pct') };
        });
        const stamp = h('span', 'rm-el-stamp', h('span', null, 'Elected'));
        stamp.style.filter = `url(#${id}-ink)`;
        const verdict = you >= 0
          ? h('p', `rm-el-verdict ${you === winner ? 'is-win' : 'is-lose'}`, you === winner ? `You win by ${fmt(margin)} ${margin === 1 ? 'vote' : 'votes'}.` : `You lose by ${fmt(margin)} ${margin === 1 ? 'vote' : 'votes'}.`)
          : h('p', 'rm-el-verdict', `${list[winner]?.name ?? ''} wins.`);
        const tEl = h('h2', null, String(title));
        tEl.id = titleId;
        const card = h('div', 'rm-el-card',
          h('header', 'rm-el-head', h('small', null, 'Election night'), tEl,
            h('p', 'rm-el-stats', h('span', null, h('b', null, fmt(all)), ' votes'), tn ? h('span', null, h('b', null, tn), ' turnout') : null)),
          h('div', 'rm-el-chart', ...cols.map((c) => c.col), stamp),
          verdict,
          h('div', 'rm-el-actions', contBtn()));
        box.append(card);
        const set = (x) => cols.forEach((c, i) => {
          const g = x >= 1 ? 1 : x ** pace[i];
          const v = c.c.votes * g;
          c.bar.firstChild.style.transform = `scaleY(${(c.c.votes / max) * g})`;
          c.num.style.bottom = `calc(${(c.c.votes / max) * g * 100}% + 8px)`;
          c.num.textContent = fmt(v);
          c.pct.textContent = all ? `${((v / all) * 100).toFixed(1)}%` : '';
        });
        set(0);
        let stopTween = null;
        extra.onFinish = () => {
          stopTween?.();
          set(1);
          box.classList.add('is-done');
          cols[winner]?.col.classList.add('is-win');
          const w = cols[winner]?.col;
          if (w) {
            const a = w.getBoundingClientRect();
            const b = stamp.parentElement.getBoundingClientRect();
            stamp.style.left = `${a.left - b.left + a.width / 2}px`;
          }
        };
        if (reduced()) return 0;
        stopTween = tween(0, 1, 3000, set);
        extra.stops.push(stopTween);
        const slam = later(() => { if (!box.classList.contains('is-done')) extra.onFinish(); }, 3000 + 200);
        extra.stops.push(() => unlater(slam));
        return 3300;
      },
    });
  }

  // ---------- shop ----------

  function closeShop() {
    if (dead || !sh) return;
    const s = sh;
    sh = null;
    if (cur?.shopp) settle(cur, null);
    s.box.classList.add('is-leaving');
    later(() => s.box.remove(), 300);
  }

  // The pre-round upgrade counter. A pick resolves its id and the card stays up, waiting for the next
  // call with fresh state; Esc or "Done" resolves null and closes it.
  function shop({ title = 'Before you head out…', cash: money = 0, items = [] } = {}) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: null, shopp: true };
      begin(p);
      stack.classList.add('is-hidden');
      const list = (Array.isArray(items) ? items : []).slice(0, 8);
      const fresh = !sh;
      if (fresh) {
        const box = el('div', 'rm-shop');
        box.innerHTML = `
          <div class="rm-sh-card" role="dialog" aria-modal="true" aria-labelledby="${id}-sh-title">
            <header class="rm-sh-head">
              <div><small>The counter</small><h2 id="${id}-sh-title"></h2></div>
              <div class="rm-sh-cash"><small>Your cash</small><b></b></div>
            </header>
            <div class="rm-sh-items" role="group"></div>
            <footer class="rm-sh-foot"><span class="rm-sh-note" role="status"></span><button type="button" class="rm-btn rm-sh-done"><kbd>Esc</kbd><span>Done</span></button></footer>
          </div>`;
        layer.insertBefore(box, calloutEl);
        const q = (sel) => box.querySelector(sel);
        sh = { box, title: q('.rm-sh-head h2'), cash: q('.rm-sh-cash b'), grid: q('.rm-sh-items'), note: q('.rm-sh-note'), done: q('.rm-sh-done'), shown: null, owned: new Set(), noteT: 0 };
        sh.done.addEventListener('click', () => closeShop());
      }
      const S = sh;
      S.title.textContent = String(title);
      const wallet = typeof money === 'number' ? money : Number(String(money).replace(/[$,]/g, ''));
      const finite = Number.isFinite(wallet);
      const unlimited = typeof money === 'string' && money.includes('∞');
      // The cash tag ticks to its new value after a purchase.
      const paint = (x) => { S.cash.textContent = cash(x); };
      if (!finite) {
        rich(S.cash, String(money));
        S.shown = null;
      } else if (S.shown == null || S.shown === wallet || reduced()) {
        paint(wallet);
        S.shown = wallet;
      } else {
        const from = S.shown;
        S.shown = wallet;
        tween(from, wallet, 600, (x) => paint(Math.round(x * 100) / 100));
        restart(S.cash, 'is-bump');
      }
      let ready = false;
      let picked = false;
      let idx = 0;
      let btns = [];
      const ok = (o) => !o.owned && (o.afford ?? (unlimited || (finite && Number(o.price) <= wallet)));
      const setActive = (i, focus) => {
        idx = i;
        btns.forEach((b, k) => b.classList.toggle('is-active', k === i));
        if (focus) btns[i]?.focus({ preventScroll: true });
      };
      const say = (msg) => {
        S.note.replaceChildren(el('span', null, msg));
        restart(S.note, 'is-on');
        unlater(S.noteT);
        S.noteT = later(() => S.note.classList.remove('is-on'), 2200);
      };
      const choose = (i) => {
        if (picked || !ready) return;
        if (i >= list.length) return closeShop();
        const o = list[i];
        if (!ok(o)) {
          setActive(i, true);
          restart(btns[i], 'is-nope');
          say(o.owned ? `${o.label} is already yours` : `Need ${cash(Math.max(0, Number(o.price) - (finite ? wallet : 0)))} more`);
          return;
        }
        picked = true;
        setActive(i);
        btns[i].classList.add('is-picked');
        S.box.classList.add('is-waiting');
        p.waiting = true;
        p.resolve(o.id);
      };
      const move = (k) => {
        const n = btns.length;
        const cols = getComputedStyle(S.grid).gridTemplateColumns.split(' ').length;
        const last = list.length;
        let i = idx;
        if (k === 'ArrowRight') i = (i + 1) % n;
        else if (k === 'ArrowLeft') i = (i + n - 1) % n;
        else if (k === 'ArrowDown') i = i === last ? 0 : i + cols < last ? i + cols : last;
        else i = i === last ? Math.max(0, last - 1) : i - cols >= 0 ? i - cols : last;
        setActive(i, true);
      };
      p.stop = () => { unlater(S.noteT); };
      p.advance = () => {};
      p.key = (e) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          if (!e.repeat) closeShop();
          return;
        }
        if (p.waiting || !ready) return;
        if (/^[1-9]$/.test(e.key)) {
          if (+e.key <= list.length) { e.preventDefault(); choose(+e.key - 1); }
        } else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          move(e.key);
        } else if (isAdvance(e) && !btns.includes(document.activeElement)) {
          e.preventDefault();
          if (!e.repeat) choose(idx);
        }
      };

      const prevOwned = S.owned;
      S.owned = new Set(list.filter((o) => o.owned).map((o) => String(o.id)));
      S.box.classList.remove('is-waiting');
      btns = list.map((o, i) => {
        const can = ok(o);
        const b = el('button', `rm-sh-item${o.owned ? ' is-owned' : can ? ' is-afford' : ' is-short'}${o.owned && !prevOwned.has(String(o.id)) && !fresh ? ' is-new' : ''}`);
        b.type = 'button';
        b.style.setProperty('--i', i);
        const gl = o.glyph && GLYPHS[o.glyph] ? o.glyph : 'spark';
        b.style.setProperty('--c', GLYPH_COLOURS[gl] || '#e9b23a');
        b.setAttribute('aria-keyshortcuts', String(i + 1));
        if (!can && !o.owned) b.setAttribute('aria-disabled', 'true');
        const key = h('span', 'rm-key', String(i + 1));
        key.setAttribute('aria-hidden', 'true');
        const tile = el('span', 'rm-sh-tile');
        tile.innerHTML = GLYPHS[gl];
        const price = o.owned
          ? h('span', 'rm-sh-stamp', 'Owned')
          : can ? h('span', 'rm-sh-price', cash(Number(o.price) || 0))
            : h('span', 'rm-sh-need', `Need ${cash(Math.max(0, (Number(o.price) || 0) - (finite ? wallet : 0)))}`);
        b.append(key, h('span', 'rm-sh-tile-w', tile), h('span', 'rm-sh-body', h('b', null, String(o.label)), o.text ? h('small', null, String(o.text)) : null), price);
        if (o.owned) b.append(el('span', 'rm-sr', 'Owned.'));
        else if (!can) b.append(el('span', 'rm-sr', `Cannot afford. Costs ${cash(Number(o.price) || 0)}.`));
        else b.append(el('span', 'rm-sr', `Costs ${cash(Number(o.price) || 0)}.`));
        b.addEventListener('click', () => choose(i));
        b.addEventListener('focus', () => setActive(i));
        b.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse' || picked) return;
          if (btns.includes(document.activeElement) && document.activeElement !== b) document.activeElement.blur();
          setActive(i);
        });
        return b;
      });
      const doneBtn = S.done;
      S.grid.replaceChildren(...btns);
      S.grid.dataset.n = String(list.length);
      btns.push(doneBtn);
      doneBtn.onfocus = () => setActive(btns.length - 1);
      doneBtn.onpointerenter = (e) => { if (e.pointerType === 'mouse' && !picked) { document.activeElement?.blur?.(); setActive(btns.length - 1); } };
      const firstOk = list.findIndex((o) => ok(o));
      ready = true;
      setActive(firstOk >= 0 ? firstOk : list.length);
      if (window.matchMedia('(hover: hover)').matches) later(() => { if (cur === p) btns[idx]?.focus({ preventScroll: true }); }, fresh ? 500 : 60);
    });
  }

  // ---------- property deed ----------

  function property({ address = '', kind = '', owner = '', tenants = [], price, income, options = [] } = {}) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: null };
      begin(p);
      const opts = (Array.isArray(options) ? options : []).slice(0, 4);
      const titleId = `${id}-pr-title`;
      const yours = /^(you|yours|player|me)$/i.test(String(owner).trim());
      const forSale = !String(owner ?? '').trim();
      const box = el('div', 'rm-prop');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', titleId);
      const tEl = h('h2', null, String(address));
      tEl.id = titleId;
      const rows = (Array.isArray(tenants) ? tenants : []).slice(0, 8);
      const late = rows.filter((t) => t.paying === false).length;
      const stampText = yours ? 'Yours' : forSale ? 'For sale' : 'Taken';
      const stamp = h('span', `rm-pr-stamp${yours ? ' is-yours' : forSale ? ' is-sale' : ' is-taken'}`, h('span', null, stampText));
      stamp.style.filter = `url(#${id}-ink)`;
      const tagCash = (n) => (typeof n === 'number' ? cash(n) : String(n));
      const btns = opts.map((o, i) => {
        const b = el('button', `rm-pr-opt${o.disabled ? ' is-disabled' : ''}`);
        b.type = 'button';
        b.style.setProperty('--i', i);
        b.setAttribute('aria-keyshortcuts', String(i + 1));
        if (o.disabled) b.setAttribute('aria-disabled', 'true');
        const key = h('span', 'rm-key', String(i + 1));
        key.setAttribute('aria-hidden', 'true');
        b.append(key, h('span', 'rm-pr-opt-t', h('b', null, String(o.label)), o.hint ? h('small', null, String(o.hint)) : null));
        return b;
      });
      const card = h('div', 'rm-pr-card',
        h('div', 'rm-pr-body',
          h('header', 'rm-pr-head',
            h('small', null, 'Title deed'),
            tEl,
            kind ? h('p', 'rm-pr-kind', String(kind)) : null,
            h('p', 'rm-pr-owner', h('span', null, 'Owner'), h('b', null, yours ? 'You' : forSale ? 'Nobody. It’s on the market' : String(owner)))),
          stamp,
          h('div', 'rm-pr-money',
            price != null && price !== '' ? h('div', 'rm-pr-tag', h('small', null, 'Price'), h('b', null, tagCash(price))) : null,
            income != null && income !== '' ? h('div', 'rm-pr-tag is-inc', h('small', null, 'Income'), h('b', null, `${tagCash(income)}`, h('i', null, '/day'))) : null),
          rows.length ? h('div', 'rm-pr-tenants',
            h('h3', null, 'Tenants', late ? h('span', null, `${late} late`) : null),
            h('ul', null, ...rows.map((t) => h('li', null, h('span', 'rm-pr-tn', String(t.name)), el('i'), h('span', 'rm-pr-rent', t.rent != null ? `${tagCash(t.rent)}` : ''), h('span', `rm-pr-pay ${t.paying === false ? 'is-late' : 'is-paid'}`, t.paying === false ? 'Late' : 'Paid'))))) : null),
        (() => { const g = h('div', 'rm-pr-opts', ...btns); g.setAttribute('role', 'group'); g.dataset.n = String(btns.length); return g; })(),
        h('button', 'rm-pr-x', h('kbd', null, 'Esc'), h('span', null, 'Walk away')));
      box.append(card);
      layer.insertBefore(box, calloutEl);
      const xBtn = card.querySelector('.rm-pr-x');
      let ready = false;
      let picked = false;
      let idx = -1;
      const setActive = (i, focus) => {
        idx = i;
        btns.forEach((b, k) => b.classList.toggle('is-active', k === i));
        if (focus) btns[i]?.focus({ preventScroll: true });
      };
      const leaveWith = (v) => {
        if (picked) return;
        picked = true;
        box.classList.add('is-leaving');
        later(() => settle(p, v), 240);
      };
      const choose = (i) => {
        if (!ready || picked || !opts[i]) return;
        if (opts[i].disabled) {
          setActive(i, true);
          restart(btns[i], 'is-nope');
          return;
        }
        setActive(i);
        btns[i].classList.add('is-picked');
        btns.forEach((b) => { b.disabled = true; });
        later(() => leaveWith(opts[i].id), 220);
      };
      const at = later(() => { ready = true; box.classList.add('is-ready'); const f = opts.findIndex((o) => !o.disabled); if (f >= 0 && window.matchMedia('(hover: hover)').matches) setActive(f, true); }, reduced() ? 0 : 650);
      if (reduced()) { unlater(at); ready = true; box.classList.add('is-ready'); }
      btns.forEach((b, i) => {
        b.addEventListener('click', () => choose(i));
        b.addEventListener('focus', () => setActive(i));
        b.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse' || picked || !ready) return;
          if (btns.includes(document.activeElement) && document.activeElement !== b) document.activeElement.blur();
          setActive(i);
        });
      });
      xBtn.addEventListener('click', () => leaveWith(null));
      p.stop = () => { unlater(at); box.remove(); };
      p.key = (e) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          if (!e.repeat) leaveWith(null);
          return;
        }
        if (!ready || picked) return;
        if (/^[1-4]$/.test(e.key)) {
          if (+e.key <= opts.length) { e.preventDefault(); choose(+e.key - 1); }
        } else if (e.key.startsWith('Arrow') && btns.length) {
          e.preventDefault();
          const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
          setActive(idx < 0 ? (d > 0 ? 0 : btns.length - 1) : (idx + d + btns.length) % btns.length, true);
        } else if (e.key === 'Enter' && idx >= 0 && !btns.includes(document.activeElement)) {
          e.preventDefault();
          if (!e.repeat) choose(idx);
        }
      };
    });
  }

  // ---------- pizza shop rush ----------

  const ktTopping = (n) => {
    const k = String(n ?? '').toLowerCase();
    return KT_TOP.find((t) => k.includes(t)) || KT_TOP[hashSeed(k) % KT_TOP.length];
  };
  // Score for one pizza; the same numbers feed the tips so a fast, golden pie pays best.
  const ktScore = (tops, q, fresh, streak) => {
    const base = 40 + 14 * tops;
    if (q === 'raw' || q === 'burnt') return { pts: Math.round(base * 0.3), tip: 0 };
    const bonus = q === 'perfect' ? 55 : 10;
    const speed = Math.round(fresh ** 1.6 * 85);
    const mult = 1 + Math.min(0.6, 0.12 * streak);
    const tip = Math.round(fresh ** 1.2 * (1.5 + 0.8 * tops) * (q === 'perfect' ? 1.25 : 1) * 100) / 100;
    return { pts: Math.round((base + bonus + speed) * mult), tip };
  };

  // A self-contained 2D toy kitchen over the dimmed city. Resolves { score, served, missed, tips, lines } when the clock runs out.
  function kitchen({ title = 'Pizza shop rush', duration = 90, orders = [], upgrades = [] } = {}) {
    const total = Math.max(5, Number(duration) || 90);
    const ups = new Set((Array.isArray(upgrades) ? upgrades : []).map(String));
    const stone = ups.has('stone-oven');
    const prep = ups.has('prep-cook');
    const loyal = ups.has('loyal-customers');
    const BAKE = 2.6;
    const ZONE = stone ? 0.32 : 0.2;
    const queue = (Array.isArray(orders) ? orders : []).map((o, i) => {
      const tops = (Array.isArray(o?.topping) ? o.topping : Array.isArray(o?.toppings) ? o.toppings : []).slice(0, 6).map(ktTopping);
      const name = String(o?.name ?? `Customer ${i + 1}`);
      const steps = ['dough', 'sauce', 'cheese', ...tops];
      return { i, name, tops, steps, pm: 30 + steps.length * 2.5 + (hashSeed(name) % 6) };
    });
    return new Promise((resolve) => {
      if (dead) return;
      const T = { score: 0, served: 0, missed: 0, tips: 0, flubs: 0, perfect: 0, good: 0, raw: 0, burnt: 0, streak: 0, best: 0 };
      const totals = () => ({
        score: Math.max(0, Math.round(T.score)),
        served: T.served,
        missed: T.missed,
        tips: Math.round(T.tips * 100) / 100,
        lines: [
          { label: 'Pizzas served', value: String(T.served) },
          { label: 'Perfect bakes', value: String(T.perfect) },
          { label: 'Raw or burnt', value: String(T.raw + T.burnt) },
          { label: 'Customers lost', value: String(T.missed) },
          { label: 'Flubs', value: String(T.flubs) },
          { label: 'Best streak', value: String(T.best) },
          { label: 'Tips', value: cash(Math.round(T.tips * 100) / 100, true) },
        ],
      });
      const p = { resolve, repeats: true };
      Object.defineProperty(p, 'fallback', { get: totals });
      begin(p);
      stack.classList.add('is-hidden');
      let closed = false;
      const box = el('div', 'rm-kitchen');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', String(title));
      box.dataset.stage = 'count';
      box.innerHTML = `
        <div class="rm-kt-top">
          <div class="rm-kt-title"><span></span><ul class="rm-kt-ups"></ul></div>
          <div class="rm-kt-clock"><div class="rm-timer" role="timer" aria-label="Time left"><span>0:00</span></div></div>
          <div class="rm-kt-sc"><div class="rm-score" role="group" aria-label="Score"><small>Score</small><b>0</b></div></div>
        </div>
        <div class="rm-kt-custs"></div>
        <div class="rm-kt-order"><span class="rm-kt-for">Waiting for customers</span><ol class="rm-kt-steps"></ol></div>
        <div class="rm-kt-mid">
          <div class="rm-kt-stage">
            <div class="rm-kt-peel"><svg class="rm-kt-pizza" viewBox="-104 -104 208 208" aria-hidden="true" focusable="false" stroke="#1b1a17" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><circle class="rm-kt-ghost" r="92" fill="rgba(248,244,234,.35)" stroke-dasharray="3 9"/><g class="rm-kt-layers"></g><circle class="rm-kt-tan" r="90" fill="#7a3a10" stroke="none" opacity="0"/><circle r="92" fill="none"/></svg></div>
            <div class="rm-kt-says" aria-hidden="true"></div>
          </div>
          <div class="rm-kt-oven">
            <div class="rm-kt-oven-art">${KT_OVEN}</div>
            <div class="rm-kt-heat">
              <div class="rm-kt-ht"><i class="rm-kt-gz"></i><i class="rm-kt-pz"></i><span class="rm-kt-m"></span></div>
              <div class="rm-kt-hl"><span>Raw</span><span class="rm-kt-gl">Golden</span><span>Burnt</span></div>
            </div>
            <button type="button" class="rm-kt-pull" tabindex="-1" aria-keyshortcuts="Space"><kbd>Space</kbd><span>Pull it out</span></button>
          </div>
        </div>
        <div class="rm-kt-bins" role="group" aria-label="Ingredients"></div>
        <p class="rm-kt-help"></p>
        <span class="rm-sr" role="status"></span>`;
      layer.insertBefore(box, calloutEl);
      const q = (sel) => box.querySelector(sel);
      const custsEl = q('.rm-kt-custs');
      const forEl = q('.rm-kt-for');
      const stepsEl = q('.rm-kt-steps');
      const layersG = q('.rm-kt-layers');
      const pizzaSvg = q('.rm-kt-pizza');
      const tanEl = q('.rm-kt-tan');
      const stageEl = q('.rm-kt-stage');
      const saysEl = q('.rm-kt-says');
      const ovenEl = q('.rm-kt-oven');
      const heatEl = q('.rm-kt-heat');
      const htEl = q('.rm-kt-ht');
      const markEl = q('.rm-kt-m');
      const pullBtn = q('.rm-kt-pull');
      const binsEl = q('.rm-kt-bins');
      const timerBox = q('.rm-timer');
      const scoreB = q('.rm-score b');
      const srEl = q('.rm-kitchen > .rm-sr');
      q('.rm-kt-title span').textContent = String(title);
      const upLabels = { 'stone-oven': 'Stone oven', 'prep-cook': 'Prep cook', 'loyal-customers': 'Loyal customers' };
      q('.rm-kt-ups').append(...[...ups].filter((u) => upLabels[u]).map((u) => el('li', null, upLabels[u])));
      q('.rm-kt-help').innerHTML = prep
        ? '<b>1</b> Dough · sauce and cheese go on by themselves · <b>4–8</b> toppings in order · <b>Space</b> pulls the pizza when the marker is gold'
        : '<b>1</b> Dough · <b>2</b> Sauce · <b>3</b> Cheese · <b>4–8</b> toppings in order · <b>Space</b> pulls the pizza when the marker is gold';

      const bins = KT_STEPS.map((id, i) => {
        const b = el('button', 'rm-kt-bin');
        b.type = 'button';
        b.tabIndex = -1;
        b.dataset.id = id;
        b.setAttribute('aria-keyshortcuts', String(i + 1));
        b.setAttribute('aria-label', `${i + 1}, ${KT_LABEL[id]}`);
        const ic = el('span', 'rm-kt-bin-ic');
        ic.innerHTML = KT_ICON[id];
        const key = h('span', 'rm-key', String(i + 1));
        key.setAttribute('aria-hidden', 'true');
        b.append(ic, h('span', 'rm-kt-bin-nm', KT_LABEL[id]), key);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(id); });
        b.addEventListener('mousedown', (e) => e.preventDefault());
        return b;
      });
      binsEl.append(...bins);
      pullBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); pull(); });
      pullBtn.addEventListener('mousedown', (e) => e.preventDefault());

      // ---- state ----
      const S = { t: 0, left: total, stage: 'count', i: 0, m: 0, slide: 0, zc: 0.55, pause: 0, qi: 0, nextAt: 0, over: false, shownSecs: -1 };
      const cust = [];
      const say = (text, tone = '') => {
        const n = el('span', `rm-kt-say${tone ? ` is-${tone}` : ''}`, text);
        saysEl.append(n);
        later(() => n.remove(), 1000);
      };
      const announce = (m) => { srEl.textContent = m; };
      const setStage = (st) => { S.stage = st; box.dataset.stage = st; };

      const slotsOf = () => {
        const out = [];
        for (let k = 0; k < 3; k++) {
          const slot = custsEl.children[k] || custsEl.appendChild(el('div', 'rm-kt-slot'));
          out.push(slot);
        }
        return out;
      };
      const mood = (f) => (f > 0.6 ? 'happy' : f > 0.3 ? 'fine' : 'angry');
      const paintSlots = () => {
        const slots = slotsOf();
        slots.forEach((slot, k) => {
          const c = cust[k];
          if (!c) {
            if (!slot.querySelector('.rm-kt-empty')) slot.replaceChildren(h('div', 'rm-kt-empty', h('span', null, 'Empty chair')));
            return;
          }
          if (c.el.parentElement !== slot) slot.replaceChildren(c.el);
          c.el.classList.toggle('is-front', k === 0);
        });
      };
      const buildCust = (c) => {
        const face = el('span', 'rm-kt-face');
        face.innerHTML = portrait(c.name).svg;
        const fill = el('i');
        const bar = h('span', 'rm-kt-pat', fill);
        bar.setAttribute('role', 'meter');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-label', `${c.name}'s patience`);
        const md = el('span', 'rm-kt-md');
        const first = c.name.split(/\s+/)[0];
        const nm = h('b', 'rm-kt-nm', first);
        nm.title = c.name;
        const tip = el('span', 'rm-kt-tip');
        const tops = h('span', 'rm-kt-tops', ...c.tops.slice(0, 4).map((t) => { const i = el('i'); i.innerHTML = KT_ICON[t]; return i; }));
        c.el = h('div', 'rm-kt-cust', face, h('div', 'rm-kt-ci', nm, tops), md, bar, tip);
        c.fill = fill;
        c.bar = bar;
        c.md = md;
        c.tip = tip;
        c.tier = '';
      };
      const paintCust = (c) => {
        const f = clamp(c.pat / c.pm, 0, 1);
        if (Math.abs(f - (c.lastF ?? -1)) > 0.002) {
          c.lastF = f;
          c.fill.style.transform = `scaleX(${f})`;
          c.bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
          const tier = f > 0.6 ? 'ok' : f > 0.3 ? 'mid' : 'low';
          if (tier !== c.tier) {
            c.tier = tier;
            c.el.dataset.tier = tier;
            c.md.innerHTML = moodFace(mood(f));
          }
        }
      };

      const paintSteps = () => {
        const c = cust[0];
        stepsEl.replaceChildren();
        if (!c) {
          forEl.textContent = S.qi >= queue.length ? 'All caught up' : 'Waiting for customers';
          return;
        }
        forEl.replaceChildren(el('i', null, 'Now serving '), h('b', null, c.name));
        c.steps.forEach((id, k) => {
          const li = el('li', 'rm-kt-step');
          li.dataset.id = id;
          const auto = prep && (k === 1 || k === 2);
          const ic = el('span', 'rm-kt-step-ic');
          ic.innerHTML = KT_ICON[id];
          li.append(ic, h('b', null, auto ? 'auto' : String(KT_STEPS.indexOf(id) + 1)));
          li.setAttribute('aria-label', `${KT_LABEL[id]}${auto ? ', automatic' : `, key ${KT_STEPS.indexOf(id) + 1}`}`);
          if (auto) li.classList.add('is-auto');
          stepsEl.append(li);
        });
        markSteps();
      };
      const markSteps = () => {
        [...stepsEl.children].forEach((li, k) => {
          li.classList.toggle('is-done', k < S.i);
          li.classList.toggle('is-now', k === S.i && S.stage === 'build');
        });
        box.dataset.next = S.stage === 'build' && cust[0] ? String(KT_STEPS.indexOf(cust[0].steps[S.i]) + 1) : '';
      };

      const clearPizza = () => {
        layersG.replaceChildren();
        tanEl.setAttribute('opacity', '0');
        stageEl.classList.remove('is-baking', 'is-serve', 'is-burnt');
        ovenEl.classList.remove('is-baking');
        markEl.style.left = '0%';
        htEl.classList.remove('is-live');
        box.dataset.pos = '0';
      };
      const addLayer = (id, k = 0, delay = 0) => {
        const put = () => { if (!closed) layersG.insertAdjacentHTML('beforeend', ktLayer(id, k)); };
        if (delay) later(put, delay); else put();
      };

      const startOrder = () => {
        S.i = 0;
        clearPizza();
        if (cust[0]) setStage('build'); else setStage('wait');
        paintSteps();
      };

      const addCustomer = () => {
        const o = queue[S.qi];
        if (!o) return;
        S.qi += 1;
        const c = { ...o, pat: o.pm, lastF: -1 };
        buildCust(c);
        cust.push(c);
        paintCust(c);
        paintSlots();
        c.el.classList.add('is-in');
        announce(`${c.name} walks in.`);
        if (cust.length === 1) startOrder();
        S.nextAt = S.t + (cust.length >= 2 ? 5 : 2.5);
      };

      const popScore = () => {
        stopScore?.();
        const from = shownScore;
        stopScore = tween(from, T.score, 320, (x) => { shownScore = x; scoreB.textContent = fmt(Math.max(0, x)); });
        restart(scoreB, 'is-bump');
      };
      let shownScore = 0;
      let stopScore = null;

      const drop = (c, how) => {
        const k = cust.indexOf(c);
        if (k < 0) return;
        cust.splice(k, 1);
        c.el.classList.add(how === 'served' ? 'is-served' : 'is-left');
        later(() => { if (c.el.isConnected) c.el.remove(); paintSlots(); }, 420);
        S.nextAt = Math.min(S.nextAt, S.t + 2.2);
      };

      const lose = (c) => {
        const front = cust[0] === c;
        T.missed += 1;
        T.streak = 0;
        T.score -= 75;
        popScore();
        c.el.dataset.tier = 'gone';
        c.tip.textContent = 'Left!';
        c.tip.className = 'rm-kt-tip is-bad';
        announce(`${c.name} gave up and left.`);
        say('Left!', 'bad');
        drop(c, 'left');
        if (front) {
          S.pause = 0.5;
          setStage('serve');
          stageEl.classList.add('is-serve');
        }
      };

      const press = (id) => {
        if (closed || S.over) return;
        const bin = bins[KT_STEPS.indexOf(id)];
        if (S.stage !== 'build' || !cust[0]) return;
        const c = cust[0];
        const need = c.steps[S.i];
        if (prep && (id === 'sauce' || id === 'cheese') && S.i >= 3) return;
        if (id === need) {
          restart(bin, 'is-hit');
          const tk = c.steps.slice(0, S.i).filter((x) => x === id).length;
          addLayer(id, KT_TOP.indexOf(id) + tk);
          S.i += 1;
          if (prep && id === 'dough') {
            addLayer('sauce', 0, 280);
            addLayer('cheese', 0, 560);
            S.i = 3;
          }
          markSteps();
          if (S.i >= c.steps.length) {
            setStage('bake');
            startBake(c);
          }
        } else {
          T.flubs += 1;
          T.streak = 0;
          c.pat = Math.max(0.01, c.pat - c.pm * 0.07);
          restart(bin, 'is-flub');
          restart(stageEl, 'is-shake');
          restart(c.el, 'is-hurt');
          say('Flub!', 'bad');
        }
      };

      const startBake = (c) => {
        const r = seeded(`z${c.i}-${S.qi}`);
        S.zc = 0.46 + r() * 0.26;
        S.m = 0;
        S.slide = 0.35;
        heatEl.style.setProperty('--z0', `${((S.zc - ZONE / 2) * 100).toFixed(2)}%`);
        heatEl.style.setProperty('--zw', `${(ZONE * 100).toFixed(2)}%`);
        heatEl.style.setProperty('--pw', `${(ZONE * 0.4 * 100).toFixed(2)}%`);
        heatEl.style.setProperty('--pz', `${((S.zc - ZONE * 0.2) * 100).toFixed(2)}%`);
        htEl.dataset.z0 = (S.zc - ZONE / 2).toFixed(3);
        htEl.dataset.z1 = (S.zc + ZONE / 2).toFixed(3);
        htEl.dataset.zc = S.zc.toFixed(3);
        htEl.classList.add('is-live');
        stageEl.classList.add('is-baking');
        ovenEl.classList.add('is-baking');
        box.dataset.next = '';
        markSteps();
      };

      const judge = () => {
        const z0 = S.zc - ZONE / 2;
        const z1 = S.zc + ZONE / 2;
        if (S.slide > 0 || S.m < z0) return 'raw';
        if (S.m > z1) return 'burnt';
        return Math.abs(S.m - S.zc) <= ZONE * 0.2 ? 'perfect' : 'good';
      };

      const serve = (qual) => {
        const c = cust[0];
        if (!c) return;
        const fresh = clamp(c.pat / c.pm, 0, 1);
        T[qual] += 1;
        const good = qual === 'perfect' || qual === 'good';
        const r = ktScore(c.tops.length, qual, fresh, T.streak);
        T.score += r.pts;
        T.tips += r.tip;
        T.served += 1;
        if (good) {
          T.streak += 1;
          T.best = Math.max(T.best, T.streak);
        } else T.streak = 0;
        popScore();
        c.tip.textContent = r.tip ? `+${cash(r.tip, true)}` : `+${r.pts}`;
        c.tip.className = `rm-kt-tip ${good ? 'is-good' : 'is-bad'}`;
        say({ perfect: 'Perfect!', good: 'Nice!', raw: 'Raw!', burnt: 'Burnt!' }[qual], good ? 'good' : 'bad');
        saysEl.append(el('span', `rm-kt-say is-pts${good ? '' : ' is-bad'}`, `+${r.pts}`));
        later(() => saysEl.lastChild?.remove(), 1000);
        announce(`${c.name}: ${qual} pizza, ${r.pts} points${r.tip ? `, ${cash(r.tip, true)} tip` : ''}.`);
        stageEl.classList.add('is-serve');
        stageEl.classList.toggle('is-burnt', qual === 'burnt');
        c.el.classList.add(good ? 'is-happy' : 'is-sour');
        drop(c, 'served');
        S.pause = 0.55;
        setStage('serve');
        markSteps();
      };

      const pull = () => {
        if (closed || S.over) return;
        if (S.stage === 'bake') serve(judge());
        else if (S.stage === 'build') restart(ovenEl, 'is-nope');
      };

      // ---- loop ----
      const paintHeat = () => {
        markEl.style.left = `${(clamp(S.m, 0, 1) * 100).toFixed(2)}%`;
        box.dataset.pos = S.m.toFixed(3);
        const z0 = S.zc - ZONE / 2;
        const z1 = S.zc + ZONE / 2;
        if (S.m < z0) tanEl.setAttribute('opacity', '0');
        else if (S.m <= z1) tanEl.setAttribute('opacity', '0.16');
        else tanEl.setAttribute('opacity', String(0.16 + ((S.m - z1) / (1 - z1)) * 0.6));
        stageEl.classList.toggle('is-gold', S.m >= z0 && S.m <= z1);
      };

      const finish = () => {
        if (S.over) return;
        S.over = true;
        setStage('over');
        stopLoop?.();
        hud.callout(S.left <= 0 ? 'TIME!' : 'DONE!');
        later(() => {
          if (closed) return;
          box.classList.add('is-leaving');
          later(() => settle(p, totals()), 260);
        }, 1400);
      };

      const step = (dt) => {
        if (closed || S.over) return;
        S.t += dt;
        S.left = Math.max(0, S.left - dt);
        const secs = Math.ceil(S.left);
        if (secs !== S.shownSecs) {
          S.shownSecs = secs;
          timerBox.firstChild.textContent = clock(secs);
          const urgent = S.left < 10;
          timerBox.classList.toggle('is-urgent', urgent);
          if (urgent) restart(timerBox, 'is-tick');
        }
        if (S.qi < queue.length && cust.length < 3 && S.t >= S.nextAt) addCustomer();
        const drain = loyal ? 0.65 : 1;
        for (const c of [...cust]) {
          c.pat -= dt * drain;
          if (c.pat <= 0) lose(c);
          else paintCust(c);
        }
        if (S.stage === 'bake') {
          if (S.slide > 0) S.slide -= dt;
          else S.m += dt / BAKE;
          if (S.m >= 1) {
            S.m = 1;
            paintHeat();
            serve('burnt');
          } else paintHeat();
        } else if (S.stage === 'serve') {
          S.pause -= dt;
          if (S.pause <= 0) startOrder();
        } else if (S.stage === 'wait' && cust[0]) startOrder();
        if (S.left <= 0 || (S.qi >= queue.length && !cust.length && S.stage !== 'serve')) finish();
      };

      let raf = 0;
      let last = 0;
      let stopLoop = null;
      const startLoop = () => {
        const frame = (now) => {
          raf = requestAnimationFrame(frame);
          const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
          last = now;
          step(dt);
        };
        raf = requestAnimationFrame(frame);
        stopLoop = () => { cancelAnimationFrame(raf); cancels.delete(stopLoop); };
        cancels.add(stopLoop);
      };

      p.stop = () => {
        closed = true;
        stopLoop?.();
        stopScore?.();
        box.remove();
      };
      p.advance = () => {};
      p.key = (e) => {
        if (e.key === 'Tab') { e.preventDefault(); return; }
        if (e.repeat) { if (e.key === ' ' || /^[1-8]$/.test(e.key)) e.preventDefault(); return; }
        if (/^[1-8]$/.test(e.key)) { e.preventDefault(); press(KT_STEPS[+e.key - 1]); }
        else if (e.key === ' ') { e.preventDefault(); pull(); }
      };

      // ---- go ----
      slotsOf();
      paintSlots();
      timerBox.firstChild.textContent = clock(total);
      const go = (n) => {
        if (closed || cur !== p) return Promise.resolve(false);
        return hud.callout(n).then(() => !closed && cur === p);
      };
      go('3').then((ok) => ok && go('2')).then((ok) => ok && go('1')).then((ok) => {
        if (!ok) return;
        hud.callout('GO!');
        setStage('wait');
        S.nextAt = 0;
        startLoop();
      });
    });
  }

  // ---------- title screen ----------

  // LUMIN CITY over the live city: the game keeps rendering behind this, so it paints almost nothing of its own.
  function title({ canContinue = false, continueLabel = '' } = {}) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: 'new' };
      begin(p);
      stack.classList.add('is-hidden');
      const items = [
        { id: 'new', label: 'New game' },
        ...(canContinue ? [{ id: 'continue', label: 'Continue', sub: String(continueLabel || '') }] : []),
        { id: 'tutorial', label: 'Tutorial' },
      ];
      const letters = (word, w) => word.split('').map((c, i) => {
        const n = el('span', 'rm-ti-ch', c);
        n.style.setProperty('--i', i + w * 5);
        n.style.setProperty('--r', `${[-5, 3, -2, 4, -3, 2][(i + w * 2) % 6]}deg`);
        n.style.setProperty('--y', `${[0, -.05, .04, -.03, .05, 0][(i + w) % 6]}em`);
        return n;
      });
      const star = el('i', 'rm-ti-star');
      star.innerHTML = `<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false"><polygon points="${star8()}" fill="#e9b23a" stroke="#1b1a17" stroke-width="4" stroke-linejoin="round"/><circle cx="48" cy="48" r="10" fill="#f8f4ea" stroke="#1b1a17" stroke-width="3.5"/></svg>`;
      const logo = h('h1', 'rm-ti-logo',
        h('span', 'rm-ti-w rm-ti-w1', ...letters('LUMIN', 0)),
        h('span', 'rm-ti-w rm-ti-w2', ...letters('CITY', 1)),
        star);
      logo.setAttribute('aria-label', 'Lumin City');
      logo.querySelectorAll('.rm-ti-ch').forEach((n) => n.setAttribute('aria-hidden', 'true'));
      const btns = items.map((it, i) => {
        const b = el('button', 'rm-ti-item');
        b.type = 'button';
        b.style.setProperty('--i', i);
        b.setAttribute('aria-keyshortcuts', String(i + 1));
        const key = h('span', 'rm-key', String(i + 1));
        key.setAttribute('aria-hidden', 'true');
        b.append(key, h('span', 'rm-ti-it', h('b', null, it.label), it.sub ? h('small', null, it.sub) : null), el('i', 'rm-ti-arrow'));
        return b;
      });
      const box = h('div', 'rm-title',
        h('div', 'rm-ti-scrim'),
        h('div', 'rm-ti-col',
          logo,
          h('p', 'rm-ti-tag', h('span', null, 'a city built from what you remember')),
          h('div', 'rm-ti-menu', ...btns),
          h('p', 'rm-ti-hint', h('span', null, '↑ ↓'), ' to choose · ', h('span', null, 'Enter'), ' to go')));
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Lumin City');
      box.querySelector('.rm-ti-menu').setAttribute('role', 'group');
      layer.insertBefore(box, calloutEl);

      let ready = false;
      let readyAt = 0;
      let picked = false;
      let idx = canContinue ? 1 : 0;
      const seq = [];
      const setActive = (i, focus) => {
        idx = i;
        btns.forEach((b, k) => b.classList.toggle('is-active', k === i));
        if (focus) btns[i].focus({ preventScroll: true });
      };
      const finish = () => {
        if (ready) return;
        ready = true;
        readyAt = performance.now();
        seq.forEach(unlater);
        box.classList.add('is-ready');
        setActive(idx, !!window.matchMedia('(hover: hover)').matches);
      };
      const choose = (i) => {
        if (!ready || picked || performance.now() - readyAt < 250) return;
        picked = true;
        setActive(i);
        box.classList.add('is-picked');
        btns.forEach((b, k) => { b.classList.toggle('is-chosen', k === i); b.disabled = true; });
        later(() => { box.classList.add('is-leaving'); later(() => settle(p, items[i].id), 300); }, 380);
      };
      if (reduced()) finish(); else seq.push(later(finish, 1500));
      btns.forEach((b, i) => {
        b.addEventListener('click', () => choose(i));
        b.addEventListener('focus', () => { if (ready) setActive(i); });
        b.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse' || picked || !ready) return;
          if (btns.includes(document.activeElement) && document.activeElement !== b) document.activeElement.blur();
          setActive(i);
        });
      });
      box.addEventListener('click', (e) => { if (!ready && !e.target.closest('button')) finish(); });
      setActive(idx);
      p.stop = () => { seq.forEach(unlater); box.remove(); };
      p.advance = () => { if (!ready) finish(); };
      p.key = (e) => {
        if (!ready) {
          if (isAdvance(e) || /^[1-9]$/.test(e.key) || e.key.startsWith('Arrow')) { e.preventDefault(); finish(); }
          return;
        }
        if (/^[1-9]$/.test(e.key)) {
          if (+e.key <= items.length) { e.preventDefault(); choose(+e.key - 1); }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          setActive((idx + 1) % btns.length, true);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setActive((idx + btns.length - 1) % btns.length, true);
        } else if (e.key === 'Enter' && !btns.includes(document.activeElement)) {
          e.preventDefault();
          choose(idx);
        }
      };
    });
  }

  // ---------- world creation ----------

  const SETUP_ROWS = [['city', 'City'], ['year', 'Year'], ['season', 'Season'], ['weather', 'Weather'], ['time', 'Time of day']];

  // One page, one row per answer, chunky tiles; the weather row follows the season. onChange(state) fires on
  // every change (and once at the start) so the city behind can show the look as it is chosen.
  function worldSetup({ options = {}, defaults = {}, onChange } = {}) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: null };
      begin(p);
      stack.classList.add('is-hidden');
      const listFor = (k, st) => {
        const o = k === 'weather' ? (options.weather?.[st.season] ?? (Array.isArray(options.weather) ? options.weather : [])) : options[k];
        return Array.isArray(o) ? o.map((x) => (typeof x === 'string' ? { id: x, label: x } : { id: String(x.id), label: String(x.label ?? x.id) })) : [];
      };
      const state = {};
      for (const [k] of SETUP_ROWS) {
        const list = listFor(k, state);
        const want = defaults[k] != null ? String(defaults[k]) : '';
        state[k] = list.some((o) => o.id === want) ? want : (list[0]?.id ?? '');
      }
      state.name = String(defaults.name ?? '').slice(0, 18);
      const titleId = `${id}-su-title`;
      const box = el('div', 'rm-setup');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', titleId);
      box.innerHTML = `
        <form class="rm-su-card" novalidate>
          <header class="rm-su-head"><small>New game</small><h2 id="${titleId}">Remember a day</h2></header>
          <div class="rm-su-rows"></div>
          <div class="rm-su-name">
            <div class="rm-su-lab"><small>06</small><b>Name</b></div>
            <label class="rm-su-field"><span class="rm-sr">Name</span><input class="rm-input" type="text" maxlength="18" autocomplete="off" spellcheck="false" enterkeyhint="go"></label>
          </div>
          <footer class="rm-su-foot">
            <p class="rm-su-sum" aria-live="polite"></p>
            <div class="rm-su-btns">
              <button type="button" class="rm-su-back"><kbd>Esc</kbd><span>Back</span></button>
              <button type="button" class="rm-su-rand"><i></i><span>Randomize</span></button>
              <button type="submit" class="rm-su-go"><span>Start</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>
            </div>
          </footer>
        </form>`;
      layer.insertBefore(box, calloutEl);
      const rowsEl = box.querySelector('.rm-su-rows');
      const input = box.querySelector('.rm-su-field input');
      const sumEl = box.querySelector('.rm-su-sum');
      const backBtn = box.querySelector('.rm-su-back');
      const randBtn = box.querySelector('.rm-su-rand');
      const goBtn = box.querySelector('.rm-su-go');
      randBtn.querySelector('i').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="8.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="8.5" cy="15.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/></svg>';
      input.value = state.name;
      input.placeholder = 'your name';

      const rows = {};
      const labelOf = (k) => listFor(k, state).find((o) => o.id === state[k])?.label ?? '';
      const emit = () => {
        sumEl.textContent = [labelOf('city'), state.year && `${state.year}`, [labelOf('weather'), labelOf('season')].filter(Boolean).join(', ').toLowerCase(), labelOf('time').toLowerCase()].filter(Boolean).join(' · ');
        if (typeof onChange === 'function') {
          try { onChange({ ...state }); } catch (e) { queueMicrotask(() => { throw e; }); }
        }
      };
      const paintRow = (k, animate) => {
        const r = rows[k];
        const list = listFor(k, state);
        r.tiles = list.map((o, i) => {
          const b = el('button', 'rm-su-tile');
          b.type = 'button';
          b.setAttribute('role', 'radio');
          b.dataset.id = o.id;
          b.style.setProperty('--c', SETUP_COLOUR[o.id] || '#e9b23a');
          b.style.setProperty('--i', i);
          const ic = el('span', 'rm-su-ic');
          ic.innerHTML = setupIcon(o.id);
          b.append(ic, h('span', 'rm-su-nm', o.label));
          const on = state[k] === o.id;
          b.setAttribute('aria-checked', String(on));
          b.tabIndex = on ? 0 : -1;
          b.classList.toggle('is-on', on);
          if (animate) b.classList.add('is-pop');
          b.addEventListener('click', () => select(k, o.id, true));
          return b;
        });
        r.group.replaceChildren(...r.tiles);
        r.group.style.setProperty('--n', r.tiles.length);
      };
      const select = (k, v, focus) => {
        if (picked) return;
        const changed = state[k] !== v;
        state[k] = v;
        rows[k].tiles.forEach((b) => {
          const on = b.dataset.id === v;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-checked', String(on));
          b.tabIndex = on ? 0 : -1;
          if (on && focus) b.focus({ preventScroll: true });
        });
        if (k === 'season') {
          const wl = listFor('weather', state);
          if (!wl.some((o) => o.id === state.weather)) state.weather = wl[0]?.id ?? '';
          paintRow('weather', true);
        }
        if (changed || k === 'season') emit();
      };
      SETUP_ROWS.forEach(([k, label], n) => {
        const r = el('div', 'rm-su-row');
        r.style.setProperty('--n', n);
        const group = el('div', 'rm-su-tiles');
        group.setAttribute('role', 'radiogroup');
        group.setAttribute('aria-label', label);
        r.append(h('div', 'rm-su-lab', h('small', null, String(n + 1).padStart(2, '0')), h('b', null, label)), group);
        rows[k] = { row: r, group, tiles: [] };
        rowsEl.append(r);
        paintRow(k, false);
      });

      let picked = false;
      let ready = false;
      const seq = [];
      const stops = () => [...SETUP_ROWS.map(([k]) => () => rows[k].tiles.find((b) => b.tabIndex === 0) ?? rows[k].tiles[0]), () => input, () => goBtn];
      const move = (from, d) => {
        const list = stops().map((f) => f());
        const at = list.findIndex((n) => n === from || n?.contains?.(from));
        const to = list[clamp((at < 0 ? 0 : at) + d, 0, list.length - 1)];
        to?.focus({ preventScroll: false });
        if (to === input) input.select();
      };
      const start = () => {
        if (picked || !ready) return;
        picked = true;
        box.classList.add('is-leaving');
        const out = { ...state, name: input.value.trim() || String(defaults.name ?? '').trim() || 'Kid' };
        later(() => settle(p, out), 260);
      };
      const back = () => {
        if (picked) return;
        picked = true;
        box.classList.add('is-leaving');
        later(() => settle(p, null), 240);
      };
      const randomize = () => {
        if (picked) return;
        const pickOne = (list) => list[Math.floor(Math.random() * list.length)]?.id;
        for (const [k] of SETUP_ROWS) {
          const v = pickOne(listFor(k, state));
          if (v) {
            state[k] = v;
            if (k === 'season') paintRow('weather', true);
            rows[k].tiles.forEach((b) => {
              const on = b.dataset.id === v;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-checked', String(on));
              b.tabIndex = on ? 0 : -1;
            });
          }
        }
        if (!input.value.trim()) input.value = SETUP_NAMES[Math.floor(Math.random() * SETUP_NAMES.length)];
        state.name = input.value;
        restart(randBtn, 'is-spin');
        box.classList.remove('is-shuffled');
        void box.offsetWidth;
        box.classList.add('is-shuffled');
        emit();
      };
      input.addEventListener('input', () => { state.name = input.value; });
      box.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); start(); });
      backBtn.addEventListener('click', back);
      randBtn.addEventListener('click', randomize);
      box.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const t = e.target;
        if (e.key === 'Escape') { e.preventDefault(); back(); return; }
        if (t.matches?.('[role=radio]')) {
          const k = SETUP_ROWS.find(([key]) => rows[key].group === t.parentElement)?.[0];
          const tiles = rows[k]?.tiles ?? [];
          const i = tiles.indexOf(t);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const j = clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, tiles.length - 1);
            if (tiles[j]) select(k, tiles[j].dataset.id, true);
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            select(k, tiles[e.key === 'Home' ? 0 : tiles.length - 1].dataset.id, true);
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            move(t, e.key === 'ArrowDown' ? 1 : -1);
          } else if (e.key === ' ') {
            e.preventDefault();
            select(k, t.dataset.id, true);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            start();
          }
        } else if (t === input) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); move(input, e.key === 'ArrowDown' ? 1 : -1); }
        } else if (t === goBtn && e.key === 'ArrowUp') { e.preventDefault(); move(goBtn, -1); }
        else if ((t === backBtn || t === randBtn || t === goBtn) && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          e.preventDefault();
          const order = [backBtn, randBtn, goBtn];
          order[clamp(order.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1), 0, 2)].focus();
        }
      });
      const readyAt = reduced() ? 0 : 700;
      seq.push(later(() => { ready = true; box.classList.add('is-ready'); const first = rows.city.tiles.find((b) => b.tabIndex === 0); if (window.matchMedia('(hover: hover)').matches) first?.focus({ preventScroll: true }); }, readyAt));
      emit();
      p.stop = () => { seq.forEach(unlater); box.remove(); };
      p.advance = () => {};
      // With focus on the page itself (nothing chosen yet): Enter starts, Esc goes back.
      p.key = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); back(); }
        else if (e.key === 'Enter') { e.preventDefault(); start(); }
      };
    });
  }

  // ---------- life goals strip ----------

  const GOAL_GLYPH = { land: 'owner', mayor: 'mayor', powers: 'hero' };

  // Three small meters that stay up. Rows are updated in place so a meter can slide as it fills.
  function goals(list) {
    if (dead) return;
    if (!Array.isArray(list) || !list.length) {
      goalsEl.classList.remove('is-on');
      syncCorner();
      return;
    }
    const items = list.slice(0, 4);
    const sig = items.map((g) => `${g.id}|${g.label}`).join('~');
    if (goalsList.dataset.sig !== sig) {
      goalsList.dataset.sig = sig;
      goalsList.replaceChildren(...items.map((g) => {
        const gl = GOAL_GLYPH[g.id] || (GLYPHS[g.id] ? g.id : 'spark');
        const ic = el('i', 'rm-gl-ic');
        const art = el('span', 'rm-ab-g');
        art.innerHTML = GLYPHS[gl];
        ic.append(art);
        const bar = h('span', 'rm-gl-bar', el('i'));
        bar.setAttribute('role', 'meter');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        const li = h('li', 'rm-gl', ic, h('div', 'rm-gl-b', h('div', 'rm-gl-t', h('b', null, String(g.label ?? '')), h('span')), bar, h('small')));
        li.dataset.id = String(g.id);
        return li;
      }));
    }
    items.forEach((g, i) => {
      const li = goalsList.children[i];
      const f = clamp(Number(g.value) || 0, 0, 1);
      const pct = Math.round(f * 100);
      li.classList.toggle('is-done', f >= 1);
      li.querySelector('.rm-gl-bar i').style.transform = `scaleX(${f})`;
      const bar = li.querySelector('.rm-gl-bar');
      bar.setAttribute('aria-valuenow', String(pct));
      bar.setAttribute('aria-label', `${g.label}${g.detail ? `: ${g.detail}` : ''}`);
      const val = li.querySelector('.rm-gl-t span');
      if (val.textContent !== `${pct}%`) val.textContent = f >= 1 ? 'Done' : `${pct}%`;
      const det = li.querySelector('small');
      det.textContent = g.detail ? String(g.detail) : '';
      li.title = g.detail ? `${g.label}: ${g.detail}` : String(g.label ?? '');
    });
    goalsEl.classList.add('is-on');
    syncCorner();
  }

  // ---------- journal ----------

  function journal({ quests = [], collectibles = [] } = {}) {
    const titleId = `${id}-jn-title`;
    const qs = (Array.isArray(quests) ? quests : []).map((q) => ({ ...q, state: ['done', 'failed'].includes(q.state) ? q.state : 'active' }));
    const order = { active: 0, done: 1, failed: 2 };
    const sorted = [...qs].sort((a, b) => order[a.state] - order[b.state]);
    const cols = (Array.isArray(collectibles) ? collectibles : []).slice(0, 8);
    return page({
      cls: 'rm-journal',
      labelledBy: titleId,
      fallback: undefined,
      close: (e) => e.key === 'Escape' || e.key === 'j' || e.key === 'J',
      build({ box }) {
        const faces = new Map();
        const qEl = (q, i) => {
          const face = el('span', 'rm-jn-face');
          face.innerHTML = portrait(q.who ?? q.title ?? i).svg;
          const stamp = q.state === 'done' ? 'Done' : q.state === 'failed' ? 'Failed' : '';
          const li = h('li', `rm-jn-q is-${q.state}`,
            face,
            h('div', 'rm-jn-qb',
              q.who ? h('small', null, String(q.who)) : null,
              h('b', null, String(q.title ?? '')),
              q.detail ? h('p', null, String(q.detail)) : null,
              h('div', 'rm-jn-meta',
                q.reward ? h('span', 'rm-jn-reward', h('i', null, 'Reward'), String(q.reward)) : null,
                q.due && q.state === 'active' ? h('span', 'rm-jn-due', h('i', null, 'Due'), String(q.due)) : null)),
            stamp ? h('span', 'rm-jn-stamp', stamp) : null);
          li.style.setProperty('--i', i);
          li.setAttribute('aria-label', `${q.title}, ${q.state}`);
          return li;
        };
        const list = sorted.length ? h('ol', 'rm-jn-list', ...sorted.map(qEl)) : h('p', 'rm-jn-empty', 'Nothing owed, nothing promised. Talk to someone.');
        const found = cols.reduce((a, c) => a + (Number(c.found) || 0), 0);
        const all = cols.reduce((a, c) => a + (Number(c.total) || 0), 0);
        const tally = h('aside', 'rm-jn-tally',
          h('h3', null, 'Collection'),
          all ? h('p', 'rm-jn-big', h('b', null, fmt(found)), h('span', null, ` / ${fmt(all)}`)) : null,
          cols.length ? h('ul', null, ...cols.map((c) => {
            const f = clamp((Number(c.found) || 0) / Math.max(1, Number(c.total) || 0), 0, 1);
            const fill = el('i');
            fill.style.setProperty('--f', f);
            const bar = h('span', 'rm-jn-bar', fill);
            bar.setAttribute('role', 'meter');
            bar.setAttribute('aria-valuemin', '0');
            bar.setAttribute('aria-valuemax', String(Number(c.total) || 0));
            bar.setAttribute('aria-valuenow', String(Number(c.found) || 0));
            bar.setAttribute('aria-label', String(c.label ?? ''));
            return h('li', f >= 1 ? 'is-full' : '', h('span', 'rm-jn-cl', String(c.label ?? '')), bar, h('span', 'rm-jn-cn', `${fmt(Number(c.found) || 0)}/${fmt(Number(c.total) || 0)}`));
          })) : h('p', 'rm-jn-empty', 'Nothing to collect yet.'));
        const btn = h('button', 'rm-btn', h('kbd', null, 'J'), h('span', null, 'Close'));
        btn.type = 'button';
        const active = sorted.filter((q) => q.state === 'active').length;
        const sheet = h('div', 'rm-jn-sheet',
          h('header', 'rm-jn-head',
            h('div', null, h('small', null, 'Journal'), (() => { const t = h('h2', null, 'Favours & finds'); t.id = titleId; return t; })()),
            h('p', 'rm-jn-count', h('b', null, String(active)), active === 1 ? ' open favour' : ' open favours')),
          h('div', 'rm-jn-body', h('section', 'rm-jn-quests', h('h3', null, 'Favours'), list), tally),
          h('div', 'rm-jn-actions', btn));
        box.append(sheet);
        faces.clear();
        return 600 + Math.min(sorted.length, 6) * 90;
      },
    });
  }

  // ---------- a favour on offer ----------

  // A resident asks for something: their face on the left, what they need and what it pays on the right.
  // Resolves the chosen option id; Esc (or being interrupted) is "not now" and resolves null.
  function quest({ who = '', portraitSeed, title = '', detail = '', reward = '', options } = {}) {
    return new Promise((resolve) => {
      if (dead) return;
      const p = { resolve, fallback: null };
      begin(p);
      const opts = (Array.isArray(options) && options.length ? options : [{ id: 'accept', label: 'Accept' }, { id: 'decline', label: 'Not now' }]).slice(0, 3);
      const titleId = `${id}-qs-title`;
      const box = el('div', 'rm-quest');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', titleId);
      const pic = portrait(portraitSeed ?? who);
      const photo = el('div', 'rm-tk-photo');
      photo.innerHTML = pic.svg;
      photo.style.setProperty('--h', pic.hue);
      const rewards = (Array.isArray(reward) ? reward : reward ? [reward] : []).map((r) => h('span', 'rm-qs-chip', String(r)));
      const tEl = h('h2', null, String(title));
      tEl.id = titleId;
      const btns = opts.map((o, i) => {
        const b = el('button', `rm-qs-opt${i === 0 ? ' is-main' : ''}`);
        b.type = 'button';
        b.style.setProperty('--i', i);
        b.setAttribute('aria-keyshortcuts', String(i + 1));
        const key = h('span', 'rm-key', String(i + 1));
        key.setAttribute('aria-hidden', 'true');
        b.append(key, h('span', 'rm-qs-ot', h('b', null, String(o.label)), o.hint ? h('small', null, String(o.hint)) : null));
        return b;
      });
      const card = h('div', 'rm-qs-card',
        (() => { const x = h('button', 'rm-tk-x', h('kbd', null, 'Esc'), h('span', null, 'Not now')); x.type = 'button'; return x; })(),
        h('div', 'rm-qs-body',
          h('div', 'rm-qs-side', h('div', 'rm-tk-pic', photo), who ? h('p', 'rm-qs-who', String(who)) : null),
          h('div', 'rm-qs-main',
            h('small', 'rm-qs-kicker', who ? `${String(who).split(/\s+/)[0]} needs a hand` : 'A favour'),
            tEl,
            detail ? h('p', 'rm-qs-detail', String(detail)) : null,
            rewards.length ? h('div', 'rm-qs-reward', h('i', null, 'Reward'), ...rewards) : null,
            (() => { const g = h('div', 'rm-qs-opts', ...btns); g.setAttribute('role', 'group'); g.dataset.n = String(btns.length); return g; })())));
      box.append(card);
      layer.insertBefore(box, calloutEl);
      let ready = false;
      let picked = false;
      let idx = -1;
      const xBtn = card.querySelector('.rm-tk-x');
      const setActive = (i, focus) => {
        idx = i;
        btns.forEach((b, k) => b.classList.toggle('is-active', k === i));
        if (focus) btns[i]?.focus({ preventScroll: true });
      };
      const out = (v) => {
        if (picked) return;
        picked = true;
        box.classList.add('is-leaving');
        later(() => settle(p, v), 240);
      };
      const choose = (i) => {
        if (!ready || picked || !opts[i]) return;
        setActive(i);
        btns[i].classList.add('is-picked');
        btns.forEach((b) => { b.disabled = true; });
        later(() => out(opts[i].id), 220);
      };
      const at = later(() => { ready = true; box.classList.add('is-ready'); if (window.matchMedia('(hover: hover)').matches) setActive(0, true); }, reduced() ? 0 : 750);
      if (reduced()) { unlater(at); ready = true; box.classList.add('is-ready'); }
      btns.forEach((b, i) => {
        b.addEventListener('click', () => choose(i));
        b.addEventListener('focus', () => setActive(i));
        b.addEventListener('pointerenter', (e) => {
          if (e.pointerType !== 'mouse' || picked || !ready) return;
          if (btns.includes(document.activeElement) && document.activeElement !== b) document.activeElement.blur();
          setActive(i);
        });
      });
      xBtn.addEventListener('click', () => out(null));
      p.stop = () => { unlater(at); box.remove(); };
      p.key = (e) => {
        if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); out(null); return; }
        if (!ready || picked) return;
        if (/^[1-3]$/.test(e.key)) {
          if (+e.key <= opts.length) { e.preventDefault(); choose(+e.key - 1); }
        } else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
          setActive(idx < 0 ? (d > 0 ? 0 : btns.length - 1) : (idx + d + btns.length) % btns.length, true);
        } else if (e.key === 'Enter' && !btns.includes(document.activeElement)) {
          e.preventDefault();
          choose(idx < 0 ? 0 : idx);
        }
      };
    });
  }

  function fade(to, ms = 600) {
    if (dead) return Promise.resolve();
    const target = clamp(Number(to) || 0, 0, 1);
    if (Number(getComputedStyle(fadeEl).opacity) === target) return Promise.resolve();
    fadeEl.style.transitionDuration = `${ms}ms`;
    fadeEl.style.opacity = String(target);
    if (ms <= 0) return Promise.resolve();
    return new Promise((res) => {
      let timer = 0;
      const end = (e) => {
        if (e && (e.target !== fadeEl || e.propertyName !== 'opacity')) return;
        fadeEl.removeEventListener('transitionend', end);
        unlater(timer);
        res();
      };
      fadeEl.addEventListener('transitionend', end);
      timer = later(end, ms + 150);
    });
  }

  function worldNote(text = '') {
    if (dead) return;
    const next = String(text);
    const live = [...noteEl.children].filter((c) => !c.classList.contains('is-out'));
    if (live.length && live[live.length - 1].textContent === next) return;
    if (!live.length && !next) return;
    live.forEach((c) => {
      c.classList.add('is-out');
      later(() => c.remove(), 700);
    });
    if (next) noteEl.append(el('span', 'rm-note-line', next));
  }

  return {
    say,
    ask,
    askText,
    confirm,
    talk,
    closeTalk,
    wallet,
    hideDialogue() { stack.classList.add('is-hidden'); },
    worldNote,
    hud,
    memories,
    results,
    unlock,
    ledger,
    decision,
    election,
    shop,
    closeShop,
    property,
    kitchen,
    title,
    worldSetup,
    goals,
    journal,
    quest,
    fade,
    destroy() {
      if (dead) return;
      dead = true;
      cur = null;
      window.removeEventListener('keydown', onKey);
      timers.forEach(clearTimeout);
      timers.clear();
      cancels.forEach((stop) => stop());
      cancels.clear();
      observers.forEach((ro) => ro.disconnect());
      observers.clear();
      tk = null;
      sh = null;
      layer.remove();
      if (ownRoot) root.style.pointerEvents = rootPE;
    },
  };
}
