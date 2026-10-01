import * as THREE from 'three';
import { buildManhattan } from '../world/city/scene.js';

// The remembered city: rebuilt whole each time the memory sharpens, with the haze rolling
// back in and thinning out so the swap reads as the memory surfacing rather than a pop.
export function createWorld() {
  let current = null, fogTarget = 0, extras = null, solids = [];
  const world = {
    get scene() { return current?.scene; },
    get city() { return current; },
    extras: null,
    build(settings) {
      const old = current;
      current = buildManhattan({ ...settings });
      for (const ring of current.rings) ring.visible = false;
      // Street steam reads as dirty smudges on white clay: only once the year gives colour.
      if (settings.stage < 2) current.scene.traverse((o) => { if (o.isPoints && o.material.isShaderMaterial) o.visible = false; });
      fogTarget = current.scene.fog.density;
      if (settings.surface !== false) current.scene.fog.density = Math.max(fogTarget * 3.2, 0.012);
      extras = new THREE.Group(); current.scene.add(extras); world.extras = extras;
      solids = [...current.buildings, ...(current.city.vehicles || [])];
      if (old) disposeScene(old.scene);
      return current;
    },
    tick(dt, camera) {
      if (!current) return;
      const fog = current.scene.fog;
      fog.density = THREE.MathUtils.damp(fog.density, fogTarget, 1.1, dt);
      current.tick(dt, camera);
    },
    // Everything a ground mover collides with: building tiers and (unless they hover) vehicles.
    solids() { return solids; },
    dispose() { if (current) disposeScene(current.scene); current = null; },
  };
  return world;
}

export function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) m.dispose?.();
  });
}
