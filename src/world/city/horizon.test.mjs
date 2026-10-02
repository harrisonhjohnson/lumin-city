import assert from 'node:assert/strict';
import * as THREE from 'three';
import { skyColours, makeSky, gradedAxis, makeSea, makeHarbours, shoreLots, makeFarShores, eraOf } from './horizon.js';
import { composeLook } from './eras.js';
import { paletteFor } from './looks.js';

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const light = { colour: 0x24435a, fogColour: new THREE.Color(0xb4d0e4), skyColour: new THREE.Color(0x7fb4e0), sunDirection: new THREE.Vector3(160, 300, 120), sunColour: 0xfff1d6, hemi: [0xf4f8ff, 0x7a6a58, 3.1] };

// Sky: the horizon is the fog colour; the zenith leans away from it, and not at all in the memory haze.
const haze = new THREE.Color(0xefe9dc), fog = new THREE.Color(0xb4d0e4), blue = new THREE.Color(0x7fb4e0);
assert.equal(skyColours(haze, haze).zenith.getHex(), haze.getHex(), 'clay haze keeps one soft colour');
const noon = skyColours(blue, fog);
assert.equal(noon.horizon.getHex(), fog.getHex(), 'the horizon is the fog colour');
assert(lum(noon.zenith) < lum(blue) && lum(noon.zenith) < lum(fog), 'the zenith is deeper than the old flat sky');
for (const hex of [0x253c5b, 0x6a5a7a, 0xa9b8c8]) {
  const c = new THREE.Color(hex), z = skyColours(c, new THREE.Color(hex).offsetHSL(0, 0, 0.05)).zenith;
  assert(Math.abs(lum(z) - lum(c)) < 0.12, 'the push is gentle at every hour');
}
const sky = makeSky(noon);
assert.equal(sky.material.depthTest, false); assert.equal(sky.material.fog, false);
assert(sky.renderOrder < 0 && !sky.frustumCulled, 'the dome draws first and is never culled');

// Open sea: fine by the places it meets the rivers, coarse far away, every triangle faces up, under the rivers.
const axis = gradedAxis(-2000, 2000, [-305, 305]);
assert(axis[0] === -2000 && axis.at(-1) === 2000);
axis.slice(1).forEach((x, i) => assert(x > axis[i], 'axis is strictly increasing'));
assert(axis.slice(1).every((x, i) => Math.abs(axis[i] - 305) > 20 || x - axis[i] < 11), 'fine within 20 m of a focus');
assert(Math.max(...axis.slice(1).map((x, i) => x - axis[i])) <= 160, 'never coarser than the cap');
const sea = makeSea(light, { x: [-2000, 2000], z: [-2500, 2100], foci: { x: [-1005, -305, 305, 1005], z: [-710, 290, -910, 490] } });
const pos = sea.mesh.geometry.attributes.position, index = sea.mesh.geometry.index.array;
assert(pos.count < 30000, `${pos.count} vertices stay cheap`);
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
let down = 0;
for (let t = 0; t < index.length; t += 3) {
  a.fromBufferAttribute(pos, index[t]); b.fromBufferAttribute(pos, index[t + 1]); c.fromBufferAttribute(pos, index[t + 2]);
  if (b.sub(a).cross(c.sub(a)).y <= 0) down++;
}
assert.equal(down, 0, 'every sea triangle faces up');
sea.mesh.geometry.computeBoundingBox();
assert(sea.mesh.geometry.boundingBox.min.x === -2000 && sea.mesh.geometry.boundingBox.max.z === 2100);
assert(sea.mesh.position.y <= -0.2 - 1.6, 'the sea sits deeper than any trough of the river swell');
assert(sea.mesh.material.uniforms.uHalf.value > 1e4, 'the sea has no quay');
sea.tick(1); assert.equal(sea.mesh.material.uniforms.uTime.value, 1, 'the sea shares the river clock');

// Harbours: the river mesh turned to lie past each tip, quay edge on the island's end wall.
const [north, south] = makeHarbours(light, { span: 610, north: -710, south: 290 });
for (const [h, end, dir] of [[north, -710, -1], [south, 290, 1]]) {
  h.mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(h.mesh);
  assert(Math.abs(box.min.x + 305) < 1 && Math.abs(box.max.x - 305) < 1, 'as wide as the island');
  const [near, far] = dir < 0 ? [box.max.z, box.min.z] : [box.min.z, box.max.z];
  assert(Math.abs(near - end) < 1 && Math.abs(Math.abs(far - end) - 700) < 1, 'starts at the end wall and runs 700 m out');
  const q = new THREE.Vector3(1, 0, 0).applyQuaternion(h.mesh.quaternion);
  assert(Math.abs(q.z + dir) < 1e-6, 'local +x (the quay side) points at the island');
}

// Far banks: deterministic, era-true, cheap.
const stats = (o) => { const { lots } = shoreLots(o), h = lots.map((l) => l.h).sort((p, q) => p - q); return { lots, h, frac: (limit) => h.filter((v) => v <= limit).length / h.length, median: h[h.length >> 1], max: h.at(-1) }; };
assert.deepEqual(shoreLots({ era: '2000' }), shoreLots({ era: '2000' }), 'a seed gives the same banks twice');
assert.notDeepEqual(shoreLots({ era: '2000' }).lots[5], shoreLots({ era: '2000', seed: 7 }).lots[5], 'another seed another banks');
const e1900 = stats({ era: '1900' }), e2000 = stats({ era: '2000' }), e2100 = stats({ era: '2100' });
assert(e1900.frac(20) > 0.85 && e1900.max < 45, '1900 is low: warehouses, a few spires');
assert(e2000.frac(45) > 0.75 && e2000.max > 55 && e2000.max < 160, '2000 is mostly 8-40 m with a few taller towers');
assert(e2000.h[0] >= 5, 'nothing under 5 m');
assert(e2100.median > 40 && e2100.max > 200 && e2100.max < 320, '2100 is tall');
const slender = shoreLots({ era: '2100' }).lots.filter((l) => l.kind === 'tower');
assert(slender.length > 20 && slender.every((l) => l.w <= 20.1), '2100 towers are slender');
assert(e1900.lots.some((l) => l.kind === 'church') && e1900.lots.some((l) => l.kind === 'chimney'), '1900 has spires and chimneys');
assert(!e2000.lots.some((l) => l.kind === 'church'), 'only 1900 builds church spires');
for (const [name, s] of Object.entries({ e1900, e2000, e2100 })) {
  assert(s.lots.length > 300 && s.lots.length < 900, `${name}: ${s.lots.length} lots is a few hundred`);
  assert(s.lots.every((l) => Math.abs(l.x) - l.d / 2 >= 865 - 1e-6), `${name}: every lot stands on its bank, none over the river`);
}
const tokyo = stats({ era: '2000', tokyo: true });
assert(tokyo.median > e2000.median, 'Tokyo runs taller than New York at the same year');
assert.deepEqual(eraOf(composeLook({ city: 'nyc', era: '1900', season: 'summer' })), { era: '1900', tokyo: false });
assert.deepEqual(eraOf(composeLook({ city: 'tokyo', era: '2100', season: 'summer' })), { era: '2100', tokyo: true });
assert.equal(eraOf('nyc').era, '2000', 'no era is 2000 rules');

// Meshes: two draws, palette colours pulled toward the fog, instance buffers freed with the geometry.
const look = composeLook({ city: 'nyc', era: '2000', season: 'summer' });
const meshes = makeFarShores({ palette: paletteFor(look), look, fog: new THREE.Color(0xb4d0e4), lit: 0.04 });
assert.equal(meshes.length, 2, 'two draws');
const [boxes, tops] = meshes;
assert(boxes.count > 300 && boxes.count < 1000 && tops.count > 0);
const dist = (p, q) => Math.hypot(p.r - q.r, p.g - q.g, p.b - q.b), foggy = new THREE.Color(0xb4d0e4), tint = new THREE.Color();
const facades = ['facade0', 'facade1', 'facade2', 'facade3', 'facade4'].map((n) => new THREE.Color(paletteFor(look)[n]));
let near = 0, far = 0;
for (let i = 2; i < 200; i++) { boxes.getColorAt(i, tint); near += dist(tint, foggy); far += dist(facades[i % 5], foggy); }
assert(near < far * 0.9, 'banks are drawn in palette colours pulled toward the fog');
let freed = 0;
for (const m of meshes) m.addEventListener('dispose', () => freed++);
for (const m of meshes) m.geometry.dispose();
assert.equal(freed, 2, 'disposing the geometry (all disposeScene does) frees the instance buffers');

console.log(`Horizon: gradient sky meets fog; sea ${pos.count} verts under the rivers; harbours at both tips; banks ${e1900.lots.length}/${e2000.lots.length}/${e2100.lots.length} lots (1900/2000/2100) in 2 draws.`);
