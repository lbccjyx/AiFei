import { useCallback } from 'react';
import * as THREE from 'three';
import { useThreeCanvas } from '../lib/three';
import { subscribePointer } from '../lib/pointer';
import { getScroll, HERO_FLY_RUNWAY_VH } from '../lib/scroll';
import { getTheme, subscribeTheme } from '../lib/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './ThreeHero.css';

/** particle depth shells: farther shells are smaller/fainter; the near shell
 *  sits in front of the camera path so it whooshes past during the fly-through */
const SHELLS = [
  { count: 400, size: 0.045, opacity: 0.35, zMin: -6, zMax: 6 },
  { count: 200, size: 0.065, opacity: 0.45, zMin: 1, zMax: 8 },
  { count: 120, size: 0.09, opacity: 0.55, zMin: 4, zMax: 11 },
] as const;

const CAM_START = 9;
const CAM_END = -2;

/**
 * 圆形柔边贴图。默认的点图元是硬方块，在深色 / 白色背景上会像马赛克，
 * 换成一张径向渐变的 alpha 贴图之后才是「光点」。
 */
let dotTexture: THREE.Texture | null = null;
function getDotTexture(): THREE.Texture {
  if (dotTexture) return dotTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.42, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  dotTexture = new THREE.CanvasTexture(canvas);
  dotTexture.colorSpace = THREE.SRGBColorSpace;
  return dotTexture;
}

/** easeInOutQuad */
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/**
 * Hero background: layered particle cloud with pointer parallax. Scrolling
 * through the pinned hero drives the camera forward along -Z (fly-through),
 * so the near shell whooshes past — the particles are drawn in the current
 * theme's foreground color. Falls back to a CSS-only backdrop when WebGL is
 * unavailable.
 */
export default function ThreeHero() {
  const reduced = useReducedMotion();

  const sceneFactory = useCallback(
    ({ scene, camera }: { scene: THREE.Scene; camera: THREE.PerspectiveCamera }) => {
      const shells = SHELLS.map(({ count, size, opacity, zMin, zMax }) => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 18;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 11;
          positions[i * 3 + 2] = zMin + (zMax - zMin) * Math.random();
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
          color: getTheme() === 'dark' ? 0xf2f0f5 : 0x08060d,
          size,
          map: getDotTexture(),
          alphaTest: 0.01,
          transparent: true,
          opacity,
          sizeAttenuation: true,
          depthWrite: false,
        });
        const points = new THREE.Points(geometry, material);
        return { points, material };
      });

      const group = new THREE.Group();
      for (const s of shells) group.add(s.points);
      scene.add(group);

      let tx = 0;
      let ty = 0;
      let cx = 0;
      let cy = 0;
      const unsubPointer = subscribePointer((s) => {
        tx = s.nx * 0.7;
        ty = s.ny * 0.45;
      });
      const unsubTheme = subscribeTheme((t) => {
        const c = t === 'dark' ? 0xf2f0f5 : 0x08060d;
        for (const s of shells) s.material.color.setHex(c);
      });

      return {
        scene,
        camera,
        update: (t: number) => {
          group.rotation.y = t * 0.05;
          group.rotation.x = Math.sin(t * 0.12) * 0.06;
          cx += (tx - cx) * 0.05;
          cy += (ty - cy) * 0.05;
          group.position.x = cx;
          group.position.y = cy;

          if (reduced) return; // single static frame at rest

          // fly-through: the camera advances through the shells as the pinned
          // hero is scrolled past
          const p = ease(getFlyProgress());
          camera.position.z = CAM_START + (CAM_END - CAM_START) * p;
          camera.position.x = Math.sin(t * 0.4) * 0.4 * p;
          camera.rotation.y = Math.sin(t * 0.35) * 0.05 * p;
        },
        dispose: () => {
          unsubPointer();
          unsubTheme();
        },
      };
    },
    [reduced],
  );
  const { ref, available } = useThreeCanvas(sceneFactory, CAM_START);

  if (!available) {
    return <div className="three-hero three-hero--fallback" aria-hidden />;
  }
  return <div ref={ref} className="three-hero" aria-hidden />;
}

/** 0..1 scroll progress through the hero runway (0 when disabled). */
function getFlyProgress(): number {
  const total = window.innerHeight * (HERO_FLY_RUNWAY_VH / 100);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, getScroll().y / total));
}
