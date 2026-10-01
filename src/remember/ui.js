import './ui.css';

const star = (cx, cy, R, r, n = 5) => Array.from({ length: n * 2 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / n;
  const d = i % 2 ? r : R;
  return `${(cx + d * Math.cos(a)).toFixed(1)},${(cy + d * Math.sin(a)).toFixed(1)}`;
}).join(' ');

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
};

const GLYPH_COLOURS = {
  skate: '#e9b23a', race: '#e0322b', heist: '#5b4b8f', aliens: '#2f9a78', patrol: '#2f66b0', pizza: '#e8762c',
  taxi: '#f6b90c', roam: '#6b5b95', foot: '#c9bfa6',
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
  const settle = (p, value) => {
    if (cur === p) cur = null;
    p.stop?.();
    p.resolve(value);
  };
  const begin = (p) => {
    if (!p.talk && tk) closeTalk();
    if (cur) settle(cur, cur.fallback);
    cur = p;
  };

  const onKey = (e) => {
    if (dead || !cur || e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target)) return;
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

  const affords = (o) => o.afford ?? (memTotal != null && Number(o.cost) <= memTotal);

  function buildCard(style, o, i) {
    const b = el('button', 'rm-card');
    const tilt = style === 'board' ? BOARD_TILT : MEMORY_TILT;
    const locked = style === 'board' && !!o.locked;
    b.type = 'button';
    b.style.setProperty('--i', i);
    b.style.setProperty('--tilt', `${tilt[i % tilt.length]}deg`);
    b.setAttribute('aria-keyshortcuts', String(i + 1));
    if (style === 'board') {
      const c0 = o.colour || GLYPH_COLOURS[o.glyph] || FALLBACK_COLOURS[i % 6];
      const c = locked ? muted(c0) : c0;
      b.style.setProperty('--c', c);
      b.style.setProperty('--fg', fgFor(c));
    }
    const key = h('span', 'rm-key', String(i + 1));
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
    if (o.hint) b.append(h('span', 'rm-card-hint', String(o.hint)));
    if (style === 'board' && o.badge) b.append(h('span', 'rm-badge', String(o.badge)));
    if (locked) {
      const can = !!affords(o);
      const cost = fmt(Number(o.cost) || 0);
      const vis = el('span', null, can ? `Unlock · ${cost}` : `${cost} memories`);
      vis.setAttribute('aria-hidden', 'true');
      b.classList.add('is-locked', can ? 'is-afford' : 'is-short');
      b.setAttribute('aria-disabled', String(!can));
      b.append(h('span', 'rm-cost', el('i'), vis, el('span', 'rm-sr', can ? `Locked. Unlock for ${cost} memories.` : `Locked. Costs ${cost} memories.`)));
    }
    return b;
  }

  function ask(question, options, opts = { style: 'memory' }) {
    const style = opts.style === 'board' ? 'board' : 'memory';
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

      const setActive = (i, focus) => {
        idx = i;
        cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
        if (focus) cards[i].focus({ preventScroll: true });
      };
      // A locked card you cannot afford shakes and says how far off you are; it never resolves.
      const refuse = (i) => {
        setActive(i, true);
        restart(cards[i], 'is-nope');
        const short = Math.ceil(Number(options[i].cost) - memTotal);
        need.replaceChildren(el('span', null, memTotal != null && short > 0
          ? `Need ${fmt(short)} more ${short === 1 ? 'memory' : 'memories'}`
          : 'Not enough memories yet'));
        restart(need, 'is-on');
        unlater(needTimer);
        needTimer = later(() => need.classList.remove('is-on'), 2400);
      };
      const choose = (i) => {
        if (picked || !ready) return;
        if (options[i].locked && !affords(options[i])) return refuse(i);
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

      p.stop = () => { t.stop(); if (!picked) box?.remove(); };
      p.advance = () => { if (!ready) t.finish(); };
      p.key = (e) => {
        if (!ready) {
          if (isAdvance(e)) { e.preventDefault(); if (!e.repeat) t.finish(); }
          return;
        }
        if (/^[1-9]$/.test(e.key)) {
          if (+e.key <= options.length) { e.preventDefault(); choose(+e.key - 1); }
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
        box = el('div', `rm-choices rm-${style}${style === 'board' && options.length > 6 ? ' rm-wide' : ''}${opts.confirm ? ' rm-confirm' : ''}${style === 'board' && options.length > 6 && options.length % 4 === 3 ? ' rm-odd3' : ''}${style === 'board' && options.length > 6 && options.length % 2 ? ' rm-odd' : ''}`);
        box.setAttribute('role', 'group');
        box.setAttribute('aria-label', String(question));
        box.style.setProperty('--n', options.length);
        cards = options.map((o, i) => buildCard(style, o, i));
        if (style === 'board' && options.some((o) => o.locked)) {
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
        box.prepend(...cards);
        stack.insertBefore(box, panel);
        ready = true;
        if (window.matchMedia('(hover: hover)').matches) setActive(0, true);
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
        box.addEventListener('submit', (e) => {
          e.preventDefault();
          if (sent) return;
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
  };
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(syncCorner);
    [trEl, memChip, walChip, moneyEl].forEach((n) => ro.observe(n));
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
      let flip = 0;
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

      p.stop = () => { t?.stop(); unlater(flip); };
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

      if (fresh || reduced()) render();
      else {
        T.card.classList.add('is-flip-out');
        flip = later(() => {
          if (cur !== p) return;
          T.card.classList.remove('is-flip-out');
          restart(T.card, 'is-flip-in');
          render();
        }, 170);
      }
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
      layer.remove();
      if (ownRoot) root.style.pointerEvents = rootPE;
    },
  };
}
