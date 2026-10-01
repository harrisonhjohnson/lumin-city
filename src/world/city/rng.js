// The same LCG src/room/manhattan.js used, so a seed reproduces a city exactly.
export function createRng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  next.range = (a, b) => a + next() * (b - a);
  next.int = (a, b) => Math.floor(next.range(a, b + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}
