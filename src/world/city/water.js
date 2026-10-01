import * as THREE from 'three';
import { createRng } from './rng.js';

// River water: one draw per river, no texture files, no render targets. A coarse grid (dense by
// the quay, wide at the horizon) takes a few summed sharp-crested sine swells in the vertex
// shader, which also lights the whole surface once per vertex: that is all the far water gets.
// Near the camera the fragment shader redoes the lighting with a normal roughened by layered
// scrolling noise, and paints the glitter and foam. Fog is three's own FogExp2 chunk, so the river
// fades into the same haze as the city. Weather only changes the water's mood (choppy = bigger,
// darker, foamier; calm = glassy).

const QUAY_HALF = 1.5;   // half the quay's width in scene.js: the water starts at its face

// dir x, dir z, wavelength (m), height (m). Crests run mostly across the river and the swells
// travel both up (+z) and down (-z) it, so they cross instead of making stripes.
const WAVES = [[0.12, 1, 96, 0.3], [-0.2, 1, 54, 0.2], [0.5, -0.87, 31, 0.11]];
const CRESTS = 2;   // foam and crest light follow only the long swells: shorter ones are under-sampled by the grid
const HEIGHT_SUM = WAVES.slice(0, CRESTS).reduce((s, w) => s + w[3], 0);
const waveTable = WAVES.map(([dx, dz, len, h]) => {
  const n = Math.hypot(dx, dz), k = Math.PI * 2 / len;
  return { dx: dx / n, dz: dz / n, k, h, omega: 0.7 * Math.sqrt(9.8 * k) };
});
const f = (v) => v.toFixed(5);
const SWELL = `
const vec4 WV[3] = vec4[3](${waveTable.map((w) => `vec4(${f(w.dx)}, ${f(w.dz)}, ${f(w.k)}, ${f(w.h)})`).join(', ')});
const vec2 WP[3] = vec2[3](${waveTable.map((w, i) => `vec2(${f(w.omega)}, ${f(i * 1.7)})`).join(', ')});
uniform float uTime;
varying vec3 vWorld, vFar;
varying vec2 vSlope;
varying float vDq, vCrest, vFres;
`;

// Body colour with the sky reflected over it. The vertex shader runs it on the swell alone for the
// far water; the fragment shader runs it again near the camera with the chop added to the normal.
// Transcendentals and divides are the expensive ops on a GPU, so squarings stand in for powers.
const SHADE = `
uniform vec2 uFres;
uniform vec3 uDeep, uShallow, uSky, uHorizon, uSunDir, uSunCol, uAmb;
vec3 shade(vec3 V, vec3 N, float dq, float crest, float tex, out float fres, out float inv2) {
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  float up = clamp(abs(R.y), 0.0, 1.0);
  vec3 sky = mix(uHorizon, uSky, up * (2.0 - up));
  float sd = max(dot(R, uSunDir), 0.0), sd2 = sd * sd, sd4 = sd2 * sd2, sd8 = sd4 * sd4, sd16 = sd8 * sd8;
  sky += uSunCol * (sd8 * sd2 * 0.12 + sd16 * sd16 * sd16 * sd16 * 0.5);
  float inv = 1.0 - ndv;
  inv2 = inv * inv;
  fres = min(1.0, uFres.x + uFres.y * inv2 * inv2);
  // Lighter and greener over the shallows by the quay, deep teal in the channel.
  float shore = 1.0 - smoothstep(0.0, 150.0, dq);
  vec3 light = uAmb + uSunCol * max(dot(N, uSunDir), 0.0) * 0.6;
  vec3 body = mix(uDeep, uShallow, shore * shore * 0.9 + 0.05 * tex + 0.05) * light;
  body += uShallow * smoothstep(0.6, 0.9, crest) * 0.4 * light;
  return mix(body, sky, fres);
}
`;

const vertexShader = /* glsl */`
${SWELL}
${SHADE}
uniform float uAmp, uSlope, uHalf, uQuay;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vDq = uHalf - uQuay * position.x - ${f(QUAY_HALF)};
  float away = distance(cameraPosition.xz, w.xz);
  float y = 0.0, crest = 0.0;
  vec2 slope = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 wv = WV[i];
    float ph = wv.z * dot(wv.xy, w.xz) - WP[i].x * uTime + WP[i].y;
    float e = exp(sin(ph) - 1.0);
    y += wv.w * (e - 0.47);
    if (i < ${CRESTS}) crest += wv.w * e;
    slope += wv.xy * (wv.z * wv.w * cos(ph) * e);
  }
  // Calmer against the quay so crests never climb over it; flat far away, where the grid is coarse.
  float damp = mix(0.15, 1.0, smoothstep(0.0, 24.0, vDq));
  w.y += y * 1.6 * uAmp * damp * (1.0 - smoothstep(300.0, 800.0, away));
  vSlope = slope * uSlope * damp * (1.0 - 0.8 * smoothstep(120.0, 700.0, away));
  vCrest = crest / ${f(HEIGHT_SUM)};
  vWorld = w.xyz;
  float inv2;
  vFar = shade(normalize(cameraPosition - w.xyz), vec3(-vSlope.x, 1.0, -vSlope.y) * max(1.0 - 0.5 * dot(vSlope, vSlope), 0.5), max(vDq, 0.0), vCrest, 0.0, vFres, inv2);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

// A tileable gradient-noise texture, made here once (no files) and shared by every river: red is
// the value, green and blue its slope, so one tap gives the chop's normal and mipmaps fade the
// detail out by themselves with distance. Gradient noise is a few dozen ALU ops per tap in the
// shader; this makes it a single fetch.
const NOISE = { cells: 32, size: 256, value: 1.4, slope: 3 };
let noiseTexture = null;
function noiseFor() {
  if (noiseTexture) return noiseTexture;
  const { cells, size } = NOISE, rng = createRng(812);
  const grads = Array.from({ length: cells * cells }, () => { const a = rng() * Math.PI * 2; return [Math.cos(a), Math.sin(a)]; });
  const grad = (i, j) => grads[(j & (cells - 1)) * cells + (i & (cells - 1))];
  const data = new Uint8Array(size * size * 4);
  const quintic = (x) => x * x * x * (x * (x * 6 - 15) + 10), dquintic = (x) => 30 * x * x * (x * (x - 2) + 1);
  const pack = (x, scale) => Math.round((0.5 + 0.5 * Math.max(-1, Math.min(1, x / scale))) * 255);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x * cells / size, py = y * cells / size, i = Math.floor(px), j = Math.floor(py), fx = px - i, fy = py - j;
    const u = quintic(fx), v = quintic(fy), du = dquintic(fx), dv = dquintic(fy);
    const ga = grad(i, j), gb = grad(i + 1, j), gc = grad(i, j + 1), gd = grad(i + 1, j + 1);
    const va = ga[0] * fx + ga[1] * fy, vb = gb[0] * (fx - 1) + gb[1] * fy, vc = gc[0] * fx + gc[1] * (fy - 1), vd = gd[0] * (fx - 1) + gd[1] * (fy - 1);
    const k1 = vb - va, k2 = vc - va, k4 = va - vb - vc + vd;
    const dx = ga[0] + u * (gb[0] - ga[0]) + v * (gc[0] - ga[0]) + u * v * (ga[0] - gb[0] - gc[0] + gd[0]) + du * (k1 + v * k4);
    const dy = ga[1] + u * (gb[1] - ga[1]) + v * (gc[1] - ga[1]) + u * v * (ga[1] - gb[1] - gc[1] + gd[1]) + dv * (k2 + u * k4);
    data.set([pack(va + u * k1 + v * k2 + u * v * k4, 1 / NOISE.value), pack(dx, NOISE.slope), pack(dy, NOISE.slope), 255], (y * size + x) * 4);
  }
  noiseTexture = new THREE.DataTexture(data, size, size);   // DataTexture defaults to nearest filtering: squares up close
  noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
  noiseTexture.magFilter = THREE.LinearFilter;
  noiseTexture.minFilter = THREE.LinearMipmapNearestFilter; noiseTexture.generateMipmaps = true;
  noiseTexture.needsUpdate = true;
  return noiseTexture;
}

const fragmentShader = /* glsl */`
${SWELL}
${SHADE}
uniform sampler2D uNoise;
uniform float uChop, uChopK, uThr, uLit, uRain;
uniform vec3 uFoamCol, uGlow;
#include <fog_pars_fragment>

// Gradient noise, one unit per cell: (value, d/dx, d/dy). gn eases the lookup between texels
// (smoothstep on the fraction, explicit gradients for the mip) so up close it is smooth, not
// faceted; gnFast is the plain bilinear tap, fine for the layers that are already tiny.
vec3 gnFast(vec2 p) {
  vec3 s = texture2D(uNoise, p * ${f(1 / NOISE.cells)}).rgb * 2.0 - 1.0;
  return vec3(s.x / ${f(NOISE.value)}, s.yz * ${f(NOISE.slope)});
}
vec3 gn(vec2 p) {
  vec2 uv = p * ${f(1 / NOISE.cells)}, st = uv * ${f(NOISE.size)}, fr = fract(st);
  vec3 s = textureGrad(uNoise, (floor(st) + fr * fr * (3.0 - 2.0 * fr) + 0.5) * ${f(1 / NOISE.size)}, dFdx(uv), dFdy(uv)).rgb * 2.0 - 1.0;
  return vec3(s.x / ${f(NOISE.value)}, s.yz * ${f(NOISE.slope)});
}

// Smooth value noise for the light streaks.
float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), f.x), mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Rain: one expanding ring per cell, each on its own beat. Returns the slope it adds and its brightness.
vec3 rings(vec2 p, float cell, float seed) {
  vec2 g = p / cell, id = floor(g) + seed, fr = fract(g);
  vec2 h = fract(sin(vec2(dot(id, vec2(127.1, 311.7)), dot(id, vec2(269.5, 183.3)))) * 43758.5453);
  float age = fract(uTime * 0.8 + h.x);
  vec2 d = fr - (0.35 + 0.3 * vec2(h.y, fract(h.x * 7.0)));
  float len = length(d);
  float ring = smoothstep(0.06, 0.0, abs(len - age * 0.3)) * (1.0 - age) * (1.0 - age);
  return vec3(d / max(len, 1e-3) * ring, ring);
}

void main() {
  // Where the haze has all but swallowed the water there is nothing to shade.
  float fog2 = 0.0;
  #if defined( USE_FOG ) && defined( FOG_EXP2 )
    fog2 = fogDensity * fogDensity * vFogDepth * vFogDepth;
    if (fog2 > 4.5) { gl_FragColor = vec4(fogColor, 1.0); return; }
  #endif
  vec3 toCam = cameraPosition - vWorld;
  float d2 = dot(toCam, toCam), invd = inversesqrt(d2), dist = d2 * invd;
  vec3 V = toCam * invd;
  vec2 p = vWorld.xz;
  float t = uTime;
  float dq = max(vDq, 0.0);
  float damp = mix(0.45, 1.0, smoothstep(0.0, 24.0, vDq));
  // Close up (and not lost in fog) the chop is added and the lighting redone per pixel; farther
  // out the vertex-lit colour stands in, since the chop would mip out there anyway.
  float detail = (1.0 - smoothstep(130.0, 240.0, dist)) * step(fog2, 2.0);
  float k = uChopK * damp;

  vec3 a = vec3(0.0), b = vec3(0.0);
  vec2 broad = vec2(0.0);
  vec3 col = vFar;
  float fres = vFres, inv2 = 0.0, spatter = 0.0;
  vec2 slope = vSlope;
  if (detail > 0.0) {
    // Chop: three scrolling noise layers (the second pointing across the first), added to the swell.
    const mat2 TURN = mat2(0.8, -0.6, 0.6, 0.8);
    a = gn(p * 0.11 + vec2(0.0, -t * 0.3));
    b = gn(TURN * p * 0.3 + vec2(t * 0.2, t * 0.28));
    broad = a.yz * 0.132 * k;
    slope += broad + (b.yz * TURN) * 0.15 * k;
    if (dist < 140.0) slope += gnFast(p * 0.75 + vec2(-t * 0.5, t * 0.4) + a.yz * 0.3).yz * 0.135 * k * (1.0 - smoothstep(60.0, 140.0, dist));
    if (uRain > 0.0) {
      vec3 drops = (rings(p, 2.1, 0.0) + rings(p, 3.4, 57.0)) * uRain * (1.0 - smoothstep(40.0, 160.0, dist));
      slope += drops.xy * 0.5; spatter = drops.z;
    }
    vec3 N = vec3(-slope.x, 1.0, -slope.y) * max(1.0 - 0.5 * dot(slope, slope), 0.5);
    float nearFres;
    vec3 lit = shade(V, N, dq, vCrest, b.x, nearFres, inv2) + uAmb * spatter * 0.2;
    col = mix(vFar, lit, detail);
    fres = mix(vFres, nearFres, detail);
  }

  // Sun/moon glitter: a broad lobe around the mirror direction, with crisp sparkles that twinkle
  // with the chop inside it. The noise mips out with distance, so far sparkles fade into the lobe.
  vec2 swellSlope = vSlope + broad;
  vec3 Nsm = vec3(-swellSlope.x, 1.0, -swellSlope.y) * max(1.0 - 0.5 * dot(swellSlope, swellSlope), 0.5);
  vec3 H = normalize(uSunDir + V);
  float l1 = max(dot(Nsm, H), 0.0), l2 = l1 * l1, l4 = l2 * l2, l8 = l4 * l4, l16 = l8 * l8, l32 = l16 * l16;
  float lobe = mix(l32 * l32, l32, uChop);
  float glint = lobe * 0.18;
  if (lobe > 0.2 && detail > 0.0) {
    float fine = mix(gnFast(p * 5.0 + vec2(-t * 0.7, t * 0.6)).x, gnFast(p * 1.5 + vec2(t * 0.3, -t * 0.35)).x, smoothstep(40.0, 120.0, dist));
    glint += smoothstep(0.99 - lobe * 0.23, 1.015 - lobe * 0.23, fine * 0.5 + 0.5) * 2.2;
  }
  col += uSunCol * glint * (0.3 + 0.7 * fres) * (1.0 - smoothstep(500.0, 900.0, dist));

  // City light on the water by the quays: a soft warm wash that breathes with the swell, not
  // individual streaks (those read as grass at this scale).
  if (uLit > 0.0 && dq < 40.0) {
    float near = 1.0 - smoothstep(2.0, 40.0, dq);
    float breathe = 0.65 + 0.35 * vnoise(p * 0.05 + vec2(0.0, t * 0.2));
    col += uGlow * near * near * breathe * uLit * inv2 * 0.12;
  }

  // Foam: broken flecks along the long swells' crests, and a lapping band at the quay face.
  // A soft halo around an opaque core keeps the edges lively.
  if (vCrest > uThr - 0.25 && fog2 < 2.0) {
    float field = vCrest + gn(vec2(p.x * 0.4, p.y * 0.8 + t * 1.6)).x * 0.6;
    if (field > uThr) col = mix(col, uFoamCol, max(smoothstep(uThr + 0.05, uThr + 0.09, field) * 0.85, smoothstep(uThr, uThr + 0.05, field) * 0.3) * damp);
  }
  if (dq < 5.0 && detail > 0.0) {
    float lap = 0.5 + 0.5 * sin(t * 1.1 + p.y * 0.06 + a.x * 2.0);
    float ragged = sin(p.y * 0.8 - t * 1.9 + a.x * 4.0) * 0.5 + sin(p.y * 2.1 + t * 2.3 + b.x * 3.0) * 0.25;
    float reach = (0.35 + 0.8 * lap) * (1.0 + 0.5 * uChop) + ragged * 0.2;
    float band = 1.0 - smoothstep(reach - 0.08, reach + 0.08, dq);
    col = mix(col, uFoamCol, band * 0.92);
    col = mix(col, uFoamCol, (1.0 - smoothstep(0.0, 4.0, dq)) * 0.1);
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// Grid in the xz plane: spacing grows geometrically away from the quay edge (the side `quay`
// points to), and along the river it is fine (3 m) through the middle band the player can reach,
// then widens toward the ends, where fog hides it.
function riverGeometry(width, depth, quay) {
  const nx = 64, grow = 1.052, half = width / 2, fine = depth * 0.32, step = 3;
  const away = Array.from({ length: nx + 1 }, (_, i) => width * (grow ** i - 1) / (grow ** nx - 1));
  const rows = [];
  for (let z = 0, s = step; z < depth / 2; z += s, s *= z > fine ? 1.15 : 1) rows.push(z);
  rows.push(depth / 2);
  const zs = [...rows.slice(1).reverse().map((z) => -z), ...rows.map((z) => z)].map((z) => Math.max(-depth / 2, Math.min(depth / 2, z)));
  const nz = zs.length - 1;
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pos.set([quay * (half - away[i]), 0, zs[j]], (j * (nx + 1) + i) * 3);
  const index = new Uint16Array(nx * nz * 6);
  let o = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    // x runs the other way for quay = +1, so the winding flips to keep the face up.
    index.set(quay > 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d], o); o += 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return geometry;
}

// width x depth is the river's plane, centred on the mesh; `quay` (+1 or -1) is the local x
// side the stone quay is on. Light comes in as scene.js's own numbers: sun colour already
// multiplied by its intensity, hemi = [sky, ground, intensity] as given to HemisphereLight,
// lit = how many windows glow, glow = the colour the city lights the air.
export function makeWater({ width, depth, quay = 1, colour, fogColour, skyColour, sunDirection, sunColour, hemi, weather = {}, lit = 0, glow = null }) {
  const choppy = weather.choppy ?? (weather.particles?.kind === 'rain' ? 1 : weather.wet ? 0.4 : weather.particles ? 0.2 : 0);
  const base = new THREE.Color(colour);
  // Tints scale with how coloured the palette's water is, so 1900 greys and the clay stage stays pale.
  const sat = THREE.MathUtils.clamp((Math.max(base.r, base.g, base.b) - Math.min(base.r, base.g, base.b)) / Math.max(base.r, base.g, base.b, 1e-4) * 1.5, 0, 1);
  const tint = (r, g, b) => new THREE.Color(1, 1, 1).lerp(new THREE.Color(r, g, b), sat);
  const dark = 1 - 0.3 * choppy;
  const deep = base.clone().multiply(tint(0.62, 0.8, 1.0)).multiplyScalar(0.8 * dark);
  const shallow = base.clone().multiply(tint(1.2, 1.9, 1.5)).multiplyScalar(1.1 * dark);
  const ambient = new THREE.Color(hemi[0]).lerp(new THREE.Color(hemi[1]), 0.1).multiplyScalar(hemi[2] / Math.PI);
  const sun = new THREE.Color(sunColour).multiplyScalar(1 / Math.PI);
  // Foam is lit mostly by how bright the light is, a little by its colour.
  const lightIn = ambient.clone().add(sun.clone().multiplyScalar(0.5)), lum = (lightIn.r + lightIn.g + lightIn.b) / 3;
  const foamLit = new THREE.Color(lum, lum, lum).lerp(lightIn, 0.35);
  const foam = new THREE.Color(0xf4f7f6).lerp(shallow, 0.12).multiply(foamLit.setRGB(Math.min(foamLit.r, 1), Math.min(foamLit.g, 1), Math.min(foamLit.b, 1)));
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 }, uChop: { value: choppy }, uChopK: { value: 0.35 + 0.65 * choppy }, uThr: { value: 0.97 - 0.07 * choppy }, uFres: { value: new THREE.Vector2((0.07 - 0.04 * choppy) * (1.25 - 0.25 * choppy), 0.93 * (1.25 - 0.25 * choppy)) }, uRain: { value: weather.particles?.kind === 'rain' ? 1 : 0 },
      uAmp: { value: 0.55 + 1.05 * choppy }, uSlope: { value: 2.4 + 1.6 * choppy },
      uHalf: { value: width / 2 }, uQuay: { value: quay }, uLit: { value: lit }, uNoise: { value: noiseFor() },
      uDeep: { value: deep }, uShallow: { value: shallow }, uFoamCol: { value: foam },
      uSky: { value: new THREE.Color(skyColour) }, uHorizon: { value: new THREE.Color(fogColour) },
      uSunDir: { value: new THREE.Vector3().copy(sunDirection).normalize() },
      uSunCol: { value: sun },
      uAmb: { value: ambient }, uGlow: { value: new THREE.Color(glow ?? 0x000000) },
    },
    vertexShader, fragmentShader,
  });
  const mesh = new THREE.Mesh(riverGeometry(width, depth, quay), material);
  mesh.name = 'water';
  return {
    mesh,
    tick: (dt) => { material.uniforms.uTime.value += dt * (1 + 0.5 * choppy); },
  };
}
