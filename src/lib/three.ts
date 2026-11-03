import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type ThreeSceneHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** called every frame with elapsed seconds and delta seconds */
  update?: (t: number, dt: number) => void;
  dispose?: () => void;
};

export type SceneFactory = (h: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}) => ThreeSceneHandle;

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * Owns a WebGLRenderer lifecycle inside the returned ref's element: resize
 * handling, rAF loop (skipped for reduced motion), StrictMode-safe disposal
 * and a WebGL-unavailable fallback flag. `sceneFactory` should be stable
 * (memoized) — the scene is built once per mount.
 */
export function useThreeCanvas(
  sceneFactory: SceneFactory,
  cameraZ = 8,
): { ref: RefObject<HTMLDivElement | null>; available: boolean } {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [available] = useState(canUseWebGL);

  useEffect(() => {
    const host = ref.current;
    if (!host || !canUseWebGL()) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // extremely rare after the capability check; leave host empty
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.z = cameraZ;

    const handle = sceneFactory({ scene, camera });

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let stopped = false;
    let last = performance.now();
    const start = last;
    const loop = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
      last = now;
      handle.update?.((now - start) / 1000, dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      handle.update?.(0, 0);
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      handle.dispose?.();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [sceneFactory, cameraZ, reduced]);

  return { ref, available };
}
