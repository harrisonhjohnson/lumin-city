import * as THREE from 'three';
import { WORLD } from './bible.js';
import { createRng } from './rng.js';
import { makeWater } from './water.js';
import { lookFor } from './looks.js';

// Everything past the island and its rivers, so no edge ever shows: a gradient sky whose horizon is the
// fog colour, open sea out to the clip plane, harbour water at the island's two tips, and the far banks
// of both rivers as a few hundred instanced boxes. All static: per frame only the water clocks move.
// Beyond ~1 km the fog has all but taken the colour of everything here, so what shows is silhouette.

// Sky: a dome that follows the camera, drawn first with no depth. The horizon is the fog colour (and
// stays it below the horizon line), so far water and far banks melt into it with no seam; the zenith is
// the old flat sky colour pushed away from the fog colour, which is no push at all in the memory haze
// (sky == fog), so the clay stages stay one soft cream.
const DEEPEN = 0.85;
export function skyColours(sky, fog) {
  const a = sky.getRGB({}, THREE.SRGBColorSpace), b = fog.getRGB({}, THREE.SRGBColorSpace);
  const push = (s, f) => THREE.MathUtils.clamp(s + THREE.MathUtils.clamp((s - f) * DEEPEN, -0.22, 0.22), 0, 1);
  return { horizon: fog.clone(), zenith: new THREE.Color().setRGB(push(a.r, b.r), push(a.g, b.g), push(a.b, b.b), THREE.SRGBColorSpace) };
}

export function makeSky({ horizon, zenith }) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uHorizon: { value: horizon }, uZenith: { value: zenith } },
    vertexShader: `varying vec3 vDir;
void main() { vDir = position; gl_Position = (projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0)).xyww; }`,
    // Same curve the water reflects the sky with (water.js), so the two meet.
    fragmentShader: `uniform vec3 uHorizon, uZenith; varying vec3 vDir;
void main() {
  float k = clamp(normalize(vDir).y, 0.0, 1.0);
  gl_FragColor = vec4(mix(uHorizon, uZenith, k * (2.0 - k)), 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
  mesh.name = 'sky'; mesh.renderOrder = -1000; mesh.frustumCulled = false;
  return mesh;
}

// Open sea: the river shader on a coarse graded grid, so it shades exactly like the rivers at the seam
// and (the whole point) colour-matches them. It sits 1.8 m under them, deeper than any trough the
// swell can cut, so the two never touch; it draws last, so the depth test throws away every pixel
// the island, rivers and harbours already cover. There is no quay anywhere on it.
const SEA_DROP = 1.8;
export function gradedAxis(lo, hi, foci, base = 8, slope = 0.14, cap = 160) {
  const near = (x) => Math.min(...foci.map((f) => Math.abs(x - f)));
  const out = [lo];
  for (let x = lo; x < hi;) { x += Math.min(cap, base + slope * near(x)); out.push(Math.min(x, hi)); }
  return out;
}

function gridGeometry(xs, zs) {
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) pos.set([xs[i], 0, zs[j]], (j * nx + i) * 3);
  const index = new (nx * nz > 65535 ? Uint32Array : Uint16Array)((nx - 1) * (nz - 1) * 6);
  let o = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    index.set([a, c, b, b, c, d], o); o += 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return geometry;
}

export function makeSea(light, { x, z, foci }) {
  const sea = makeWater({ ...light, width: 2, depth: 2 });
  sea.mesh.geometry.dispose();
  sea.mesh.geometry = gridGeometry(gradedAxis(x[0], x[1], foci.x), gradedAxis(z[0], z[1], foci.z));
  sea.mesh.material.uniforms.uHalf.value = 1e5;   // the shader reads "distance to the quay" off this: far from any
  sea.mesh.position.y = -0.2 - SEA_DROP;
  sea.mesh.renderOrder = 1; sea.mesh.name = 'sea';
  return sea;
}

// Harbour water for the island's tips: the same river mesh turned a quarter, its quay along the end wall.
export function makeHarbours(light, { span, north, south, width = 700 }) {
  return [[north, -1], [south, 1]].map(([end, dir]) => {
    const harbour = makeWater({ ...light, width, depth: span, quay: 1 });
    harbour.mesh.rotation.y = dir * Math.PI / 2;   // local +x (toward the quay) points back at the island
    harbour.mesh.position.set(0, -0.2, end + dir * width / 2);
    harbour.mesh.name = 'harbour';
    return harbour;
  });
}

// Far banks. One strip of land past each river, rows of boxes standing back from the water, a few piers.
// Pure: the same seed, era and city always give the same lots (world coordinates, no collision anywhere).
const BANK = { gap: 560, rows: 5, rowPitch: 56, reach: 1440, landTop: 0.6, piers: 7 };
const ERAS = {
  1900: { low: [5, 17], tower: null, spire: 0.07, chimney: 0.05, shed: 0.22 },
  2000: { low: [8, 38], tower: { p: 0.16, h: [55, 140], w: [24, 40] }, spire: 0, chimney: 0, shed: 0.1, antenna: 0.3 },
  2100: { low: [24, 90], tower: { p: 0.5, h: [100, 290], w: [11, 20] }, spire: 0, chimney: 0, shed: 0.04, antenna: 0.5, taper: 0.55 },
};
const RISE = [0.5, 0.85, 1, 1, 0.9];   // the waterfront row stays low; the skyline stands back from the water

export function eraOf(look) {
  const label = lookFor(look).label || '';
  return { era: /\b(1900|2100)\b/.exec(label)?.[1] || '2000', tokyo: /tokyo/i.test(label) };
}

// edge: |x| of the near face of the bank (the river's far side, less what the last stretch of river gives up).
export function shoreLots({ era = '2000', tokyo = false, seed = WORLD.seed, edge = 865, zMid = (WORLD.z[0] + WORLD.z[1]) / 2 } = {}) {
  const rule = ERAS[era] || ERAS[2000];
  const lots = [], crowns = [], piers = [];
  const z0 = zMid - BANK.reach, z1 = zMid + BANK.reach;
  for (const side of [-1, 1]) {
    const rng = createRng(seed * 31 + (side > 0 ? 17 : 5));
    const centres = Array.from({ length: 7 }, () => ({ z: rng.range(z0, z1), r: rng.range(110, 260) }));
    const heat = (z) => Math.min(1, centres.reduce((s, c) => s + Math.exp(-(((z - c.z) / c.r) ** 2)), 0));
    for (let row = 0; row < BANK.rows; row++) {
      const x0 = edge + 12 + row * BANK.rowPitch;
      for (let z = z0 + rng.range(0, 30); z < z1;) {
        let w = rng.range(14, 40) * (tokyo ? 0.8 : 1), d = rng.range(30, 46), h, kind = 'block';
        const c = heat(z + w / 2), vacant = rng() < 0.09;
        if (rule.tower && row >= 1 && rng() < rule.tower.p * (tokyo ? 1.3 : 1) * (0.25 + c)) {
          w = rng.range(...rule.tower.w); d = Math.min(d, w * rng.range(0.9, 1.3)); h = rng.range(...rule.tower.h) * (0.6 + 0.4 * c); kind = 'tower';
        } else if (rule.spire && rng() < rule.spire) {
          w = rng.range(6, 9); d = rng.range(6, 9); h = rng.range(17, 24); kind = 'church';
        } else if (rule.chimney && rng() < rule.chimney) {
          w = d = rng.range(1.8, 2.6); h = rng.range(26, 42); kind = 'chimney';
        } else if (rng() < rule.shed) {
          w = rng.range(40, 80); d = rng.range(18, 28); h = rng.range(6, 12); kind = 'shed';
        } else {
          h = Math.max(5, (rule.low[0] + (rule.low[1] - rule.low[0]) * rng() ** 1.4) * RISE[row] * (1 + 0.35 * c) * (tokyo ? 1.25 : 1));
        }
        const lot = { side, kind, x: side * (x0 + d / 2), z: z + w / 2, w, d, h, tone: rng() };
        if (!vacant) {
          lots.push(lot);
          const top = { x: lot.x, z: lot.z, y: h, tone: lot.tone };
          if (kind === 'tower' && rng() < (rule.taper ?? 0)) crowns.push({ ...top, w: w * 0.92, d: d * 0.92, h: w * rng.range(0.7, 1.6) });
          else if (kind === 'tower' && rng() < (rule.antenna ?? 0)) crowns.push({ ...top, w: 1.3, d: 1.3, h: rng.range(18, 42), mast: true });
          if (kind === 'church') crowns.push({ ...top, w: w * 1.02, d: d * 1.02, h: rng.range(9, 15) });
        }
        z += w + (rng() < 0.12 ? rng.range(22, 30) : rng.range(4, 14));
      }
    }
    for (let k = 0; k < BANK.piers; k++) {
      const len = rng.range(80, 150);
      piers.push({ side, x: side * (edge + 14 - len / 2), z: rng.range(z0 + 50, z1 - 50), len, w: rng.range(11, 17), shed: rng() < 0.7 ? { h: rng.range(5, 9), len: len * rng.range(0.4, 0.7) } : null });
    }
  }
  return { lots, crowns, piers, edge, zMid };
}

// Far scenery has one material: palette colours pulled toward the fog, lit by the scene's lights. Windows
// are painted from world position: dark glass by day, and at night some fraction of them lit (the time's
// `lit`). Fog would swallow a lit window at a kilometre, so each one also adds its light back after the
// fog mix, fading out toward the clip plane, and at night the banks see through the fog a little further
// (a lit city glows through haze): the far skyline stays a field of lights over a dark mass, not nothing.
function shoreMaterial({ lit, windowLit }) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const glow = new THREE.Color(windowLit).getRGB({}, THREE.SRGBColorSpace);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uLit: { value: lit }, uWinLit: { value: new THREE.Color(windowLit) }, uWinGlow: { value: new THREE.Vector3(glow.r, glow.g, glow.b) }, uSee: { value: 1 - 0.5 * THREE.MathUtils.smoothstep(lit, 0.1, 0.5) } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aWin; varying vec3 vWP; varying vec3 vN; varying vec2 vWin;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz; vN = normal; vWin = aWin;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLit, uSee; uniform vec3 uWinLit, uWinGlow; varying vec3 vWP; varying vec3 vN; varying vec2 vWin;\nvec3 gGlow = vec3(0.0);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (vWin.x > 0.0 && abs(vN.y) < 0.5) {
  float along = abs(vN.z) > 0.5 ? vWP.x : vWP.z;
  vec2 g = vec2(along / 5.0, (vWP.y - ${BANK.landTop.toFixed(1)}) / 4.0), cell = floor(g), f = fract(g);
  float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.7);
  float on = step(fract(sin(dot(cell + vec2(vWin.y * 31.0, abs(vN.z) * 7.0), vec2(12.9898, 78.233))) * 43758.5453), uLit * 0.5);
  float shimmer = 1.0;
  #ifdef USE_FOG
    shimmer = 1.0 - smoothstep(500.0, 1100.0, vFogDepth);   // sub-pixel by then: let the haze have it
  #endif
  diffuseColor.rgb *= 1.0 - win * (1.0 - on) * 0.4 * shimmer;
  totalEmissiveRadiance += uWinLit * win * on * 1.1;
  float reach = 1.0;
  #if defined( USE_FOG ) && defined( FOG_EXP2 )
    reach = exp(-0.6 * fogDensity * vFogDepth) * (1.0 - smoothstep(1100.0, 1550.0, vFogDepth));
  #endif
  gGlow = uWinGlow * win * on * 0.9 * reach * smoothstep(0.1, 0.5, uLit);
}`)
      .replace('#include <fog_fragment>', `#if defined( USE_FOG ) && defined( FOG_EXP2 )
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth * uSee * uSee));
#endif
gl_FragColor.rgb += gGlow;`);
  };
  material.customProgramCacheKey = () => 'shore-windows';
  return material;
}

function instanced(geometry, material, records, place) {
  const mesh = new THREE.InstancedMesh(geometry, material, records.length);
  const dummy = new THREE.Object3D();
  records.forEach((r, i) => { place(r, dummy); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  // disposeScene (remember/world.js) frees geometry and materials only; this frees the instance buffers with the geometry.
  geometry.addEventListener('dispose', () => mesh.dispose());
  return mesh;
}

// Two draws: boxes (land, piers, buildings) and pyramids (spires, tower tops, masts).
export function makeFarShores({ palette, look, fog, lit, shore = 305, seed = WORLD.seed, zMid = (WORLD.z[0] + WORLD.z[1]) / 2 }) {
  const { era, tokyo } = eraOf(look);
  const { lots, crowns, piers, edge } = shoreLots({ era, tokyo, seed, zMid, edge: shore + BANK.gap });
  const faded = (hex, k) => new THREE.Color(hex).lerp(fog, k);
  const colours = ['facade0', 'facade1', 'facade2', 'facade3', 'facade4', 'stone'].map((n) => palette[n]);
  const wall = (tone, shade = 1) => faded(colours[Math.floor(tone * colours.length) % colours.length], 0.35).multiplyScalar(shade * (0.82 + 0.3 * ((tone * 17) % 1)));
  const land = faded(new THREE.Color(palette.asphalt).lerp(new THREE.Color(palette.stone), 0.45), 0.3);
  const deck = faded(new THREE.Color(palette.trim).lerp(new THREE.Color(palette.stone), 0.4), 0.3), shed = faded(palette.trim, 0.3);

  const parts = [];   // every box: centre, size, colour, and whether it paints windows
  for (const side of [-1, 1]) parts.push({ x: side * (edge + 950), y: BANK.landTop - 1.8, z: zMid, w: 1900, h: 3.6, d: 4400, colour: land, win: 0 });
  for (const l of lots) parts.push({ x: l.x, y: BANK.landTop + l.h / 2, z: l.z, w: l.d, h: l.h, d: l.w, colour: l.kind === 'shed' ? shed.clone().lerp(wall(l.tone), 0.5) : wall(l.tone, l.kind === 'chimney' ? 0.6 : 1), win: l.kind === 'shed' || l.kind === 'chimney' ? 0 : 1, seed: l.tone });
  for (const p of piers) {
    parts.push({ x: p.x, y: -0.15, z: p.z, w: p.len, h: 1.7, d: p.w, colour: deck, win: 0 });
    if (p.shed) parts.push({ x: p.x + Math.sign(p.x) * (p.len - p.shed.len) / 2 - Math.sign(p.x) * 6, y: 0.7 + p.shed.h / 2, z: p.z, w: p.shed.len, h: p.shed.h, d: p.w - 3, colour: shed, win: 0 });
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const boxes = instanced(unit, shoreMaterial({ lit, windowLit: palette.windowLit }), parts, (p, o) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, 0, 0); o.scale.set(p.w, p.h, p.d); });
  const win = new Float32Array(parts.length * 2);
  parts.forEach((p, i) => { boxes.setColorAt(i, p.colour); win.set([p.win, p.seed ?? 0], i * 2); });
  unit.setAttribute('aWin', new THREE.InstancedBufferAttribute(win, 2));
  boxes.name = 'far-shore';

  const pyramid = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4); pyramid.rotateY(Math.PI / 4); pyramid.translate(0, 0.5, 0);
  const tops = instanced(pyramid, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), crowns, (c, o) => {
    o.position.set(c.x, BANK.landTop + c.y, c.z); o.rotation.set(0, 0, 0); o.scale.set(c.d, c.h, c.w);
  });
  crowns.forEach((c, i) => tops.setColorAt(i, c.mast ? shed : wall(c.tone, 0.85)));
  tops.name = 'far-shore-tops';
  return [boxes, tops];
}
