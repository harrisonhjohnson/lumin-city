import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWater } from './water.js';

const light = { colour: 0x24435a, fogColour: 0xb4d0e4, skyColour: 0x7fb4e0, sunDirection: new THREE.Vector3(160, 300, 120), sunColour: 0xfff1d6, hemi: [0xf4f8ff, 0x7a6a58, 3.1] };

for (const quay of [1, -1]) {
  const { mesh } = makeWater({ ...light, width: 700, depth: 1400, quay });
  const g = mesh.geometry, pos = g.attributes.position, index = g.index.array;
  assert(pos.count <= 65535, 'indices fit 16 bits');
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  assert.equal(Math.round(max.x - min.x), 700);
  assert.equal(Math.round(max.z - min.z), 1400);
  assert.equal(max.y, 0);
  const xs = [...new Set(Array.from({ length: pos.count }, (_, i) => Math.round(pos.getX(i) * 1000)))].map((x) => x / 1000).sort((a, b) => (b - a) * quay);   // quay edge first
  assert.equal(xs[0], quay * 350, 'the plane starts at the quay edge');
  assert(Math.abs(xs[1] - xs[0]) < 2 && Math.abs(xs.at(-1) - xs.at(-2)) > 10, 'the grid is dense by the quay and wide at the far edge');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let down = 0;
  for (let t = 0; t < index.length; t += 3) {
    a.fromBufferAttribute(pos, index[t]); b.fromBufferAttribute(pos, index[t + 1]); c.fromBufferAttribute(pos, index[t + 2]);
    if (b.sub(a).cross(c.sub(a)).y <= 0) down++;
  }
  assert.equal(down, 0, `every triangle faces up (quay ${quay})`);
}

const noise = makeWater({ ...light, width: 700, depth: 1400 }).mesh.material.uniforms.uNoise.value;
assert.equal(noise.magFilter, THREE.LinearFilter, 'the noise is smoothed up close (DataTexture defaults to nearest: squares)');
assert(noise.generateMipmaps && noise.minFilter !== THREE.NearestFilter, 'and mipmapped in the distance');

const choppy = (weather) => makeWater({ ...light, width: 700, depth: 1400, weather }).mesh.material.uniforms.uChop.value;
assert.equal(choppy({}), 0, 'clear water is calm');
assert.equal(choppy({ wet: true, particles: { kind: 'rain' } }), 1, 'rain is choppy');
assert(choppy({ wet: true }) > 0 && choppy({ wet: true }) < 1, 'fog is a little choppy');
assert.equal(choppy({ choppy: 0.7 }), 0.7, 'a weather can set its own chop');

const water = makeWater({ ...light, width: 700, depth: 1400 });
water.tick(0.5); water.tick(0.5);
assert.equal(water.mesh.material.uniforms.uTime.value, 1, 'tick advances the waves');
assert.equal(makeWater({ ...light, width: 700, depth: 1400, glow: null }).mesh.material.uniforms.uGlow.value.getHex(), 0, 'no city glow without a sky glow');

console.log('Water: both rivers face up, dense at the quay; weather sets the chop; tick moves time.');
