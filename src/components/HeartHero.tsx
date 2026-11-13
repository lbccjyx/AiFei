import { useCallback } from 'react';
import * as THREE from 'three';
import { useThreeCanvas } from '../lib/three';
import { getTheme, subscribeTheme } from '../lib/theme';
import { getScroll, HERO_FLY_RUNWAY_VH } from '../lib/scroll';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './HeartHero.css';

/**
 * 首页主视觉：一颗 3D 粒子爱心，会随心跳一胀一缩，每下心跳炸出一簇金色火星。
 *
 * 心形不是一个平面图形挤出厚度，而是拿隐式曲面
 *   (x² + 9/4·y² + z² − 1)³ − x²z³ − 9/80·y²z³ = 0
 * 从原点向各方向射线求交，采出表面点 —— 这样它有心尖、有肚子、顶部中间有凹槽，
 * 转动时侧面会暗下去、正面会亮起来，是真有体积的。
 *
 * 相机沿用站点原来的「滚动飞入」：往下滚，镜头朝爱心推进，最后从它旁边穿过去。
 */

const FOV = 42;
const CAM_Z = 6.4;
const FLY_Z = 5.1;
const COUNT = 20000;
const MAX_SPARKS = 3200;

/** 心形隐式函数 */
function heartField(x: number, y: number, z: number): number {
  const a = x * x + 2.25 * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
}

function heartGradient(x: number, y: number, z: number, out: number[]): number[] {
  const a = x * x + 2.25 * y * y + z * z - 1;
  const a2 = 3 * a * a;
  out[0] = a2 * 2 * x - 2 * x * z * z * z;
  out[1] = a2 * 4.5 * y - 0.225 * y * z * z * z;
  out[2] = a2 * 2 * z - 3 * x * x * z * z - 0.3375 * y * y * z * z;
  return out;
}

type Palette = {
  deep: THREE.Color;
  mid: THREE.Color;
  bright: THREE.Color;
  hot: THREE.Color;
  spec: THREE.Color;
};

const LIGHT_PALETTE: Palette = {
  deep: new THREE.Color('#2b0008'),
  mid: new THREE.Color('#96001a'),
  bright: new THREE.Color('#e0001e'),
  hot: new THREE.Color('#ff1a35'),
  spec: new THREE.Color('#ff9aa5'),
};

const DARK_PALETTE: Palette = {
  deep: new THREE.Color('#5c0a18'),
  mid: new THREE.Color('#b8142c'),
  bright: new THREE.Color('#ef233c'),
  hot: new THREE.Color('#ff5b6e'),
  spec: new THREE.Color('#ffc2c9'),
};

const LIGHT_LIGHT_DIR = new THREE.Vector3(-0.38, 0.52, 0.76).normalize();
const HALF_VEC = LIGHT_LIGHT_DIR.clone().add(new THREE.Vector3(0, 0, 1)).normalize();

const PALETTE = ['#ff1f3d', '#ff4a5e', '#ff6a2a', '#ffa21f', '#ffcf4a'];
const GOLD = ['#ffa21f', '#ffcf4a', '#ff7a1f', '#ffe08a', '#fff3cc'];

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
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.92)');
    gradient.addColorStop(0.75, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  dotTexture = new THREE.CanvasTexture(canvas);
  dotTexture.colorSpace = THREE.SRGBColorSpace;
  return dotTexture;
}

/** 采出心形表面点，同时算好浅色 / 深色两套顶点颜色 */
function buildHeartMesh() {
  const positions: number[] = [];
  const colorsLight: number[] = [];
  const colorsDark: number[] = [];

  const g3 = [0, 0, 0];
  const n = new THREE.Vector3();
  const golden = Math.PI * (3 - Math.sqrt(5));

  const push = (px: number, py: number, pz: number) => {
    // 换轴：让心尖朝下
    const X = px;
    const Y = pz;
    const Z = -py;

    heartGradient(px, py, pz, g3);
    const gl = Math.hypot(g3[0], g3[1], g3[2]) || 1;
    n.set(g3[0] / gl, g3[2] / gl, -g3[1] / gl);

    const diff = Math.max(0, n.dot(LIGHT_LIGHT_DIR));
    const spec = Math.pow(Math.max(0, n.dot(HALF_VEC)), 26);

    for (const [palette, target] of [
      [LIGHT_PALETTE, colorsLight],
      [DARK_PALETTE, colorsDark],
    ] as const) {
      const k = Math.min(1, 0.04 + diff * 1.12);
      const tmp = new THREE.Color();
      if (k < 0.3) tmp.copy(palette.deep).lerp(palette.mid, k / 0.3);
      else if (k < 0.68) tmp.copy(palette.mid).lerp(palette.bright, (k - 0.3) / 0.38);
      else tmp.copy(palette.bright).lerp(palette.hot, Math.min(1, (k - 0.68) / 0.32));
      tmp.lerp(palette.spec, Math.min(0.22, spec * 0.7));
      target.push(tmp.r, tmp.g, tmp.b);
    }

    positions.push(X + (Math.random() - 0.5) * 0.008, Y + (Math.random() - 0.5) * 0.008, Z + (Math.random() - 0.5) * 0.008);
  };

  for (let i = 0; i < COUNT; i++) {
    const u = 1 - (2 * (i + 0.5)) / COUNT;
    const r0 = Math.sqrt(Math.max(0, 1 - u * u));
    const th = golden * i;
    const dx = r0 * Math.cos(th);
    const dy = r0 * Math.sin(th);
    const dz = u;

    let lo = 0;
    let hi = 1.45;
    if (heartField(dx * hi, dy * hi, dz * hi) < 0) continue;
    for (let k = 0; k < 34; k++) {
      const mid = (lo + hi) / 2;
      if (heartField(dx * mid, dy * mid, dz * mid) < 0) lo = mid;
      else hi = mid;
    }
    const rad = (lo + hi) / 2;
    push(dx * rad, dy * rad, dz * rad);
  }

  return {
    positions: new Float32Array(positions),
    colorsLight: new Float32Array(colorsLight),
    colorsDark: new Float32Array(colorsDark),
    count: positions.length / 3,
  };
}

/** 0..1 滚过 hero runway 的进度 */
function flyProgress(): number {
  const total = window.innerHeight * (HERO_FLY_RUNWAY_VH / 100);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, getScroll().y / total));
}

const easeInOutQuad = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** 心跳：约 60 次/分，每下「扑通」两声（先重后轻） */
function beat(t: number): number {
  const period = 1;
  const x = ((t % period) + period) % period;
  const g = (u: number, c: number, w: number) => Math.exp(-Math.pow((u - c) / w, 2));
  return g(x, 0.06, 0.09) + 0.55 * g(x, 0.32, 0.12);
}

type Spark = {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  r: number;
  g: number;
  b: number;
  tw: number;
};

export default function HeartHero() {
  const reduced = useReducedMotion();

  const sceneFactory = useCallback(
    ({ scene, camera }: { scene: THREE.Scene; camera: THREE.PerspectiveCamera }) => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();

      const heart = buildHeartMesh();

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(heart.positions, 3));
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(
          getTheme() === 'dark' ? heart.colorsDark : heart.colorsLight,
          3,
        ),
      );

      const material = new THREE.PointsMaterial({
        size: 0.034,
        map: getDotTexture(),
        vertexColors: true,
        transparent: true,
        alphaTest: 0.12,
        depthWrite: true,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      const group = new THREE.Group();
      group.add(points);
      scene.add(group);

      /* 背景柔光交给 CSS 的 .heart-hero::before，canvas 里不画平面，
         否则那块渐变会被 canvas 边界切出一个矩形。 */

      // ---- 火星 ----
      const sparkPos = new Float32Array(MAX_SPARKS * 3);
      const sparkColor = new Float32Array(MAX_SPARKS * 3);
      const sparkSize = new Float32Array(MAX_SPARKS);
      const sparkAlpha = new Float32Array(MAX_SPARKS);

      const sparkGeo = new THREE.BufferGeometry();
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
      sparkGeo.setAttribute('aColor', new THREE.BufferAttribute(sparkColor, 3));
      sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1));
      sparkGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sparkAlpha, 1));
      sparkGeo.setDrawRange(0, 0);

      const sparkMat = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: getDotTexture() },
          uScale: { value: 1000 },
        },
        vertexShader: `
          uniform float uScale;
          attribute vec3 aColor;
          attribute float aSize;
          attribute float aAlpha;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vColor = aColor;
            vAlpha = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uScale / max(0.001, -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec4 tex = texture2D(uMap, gl_PointCoord);
            if (tex.a < 0.02) discard;
            float hot = pow(tex.a, 3.0) * 0.35;
            vec3 c = mix(vColor, vec3(1.0, 0.97, 0.92), hot);
            gl_FragColor = vec4(c, tex.a * vAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      });

      const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
      sparkPoints.renderOrder = 5;
      sparkPoints.frustumCulled = false;
      scene.add(sparkPoints);

      const sparks: Spark[] = [];
      const tmpV = new THREE.Vector3();
      const centerW = new THREE.Vector3();
      const col = new THREE.Color();

      const palettes: Record<'light' | 'dark', { main: string[]; gold: string[] }> = {
        light: { main: PALETTE, gold: GOLD },
        dark: {
          main: ['#ff3d55', '#ff6a7a', '#ff8a3d', '#ffc247', '#ffe08a'],
          gold: ['#ffc247', '#ffe08a', '#ff9d2e', '#fff0c0', '#fffaf0'],
        },
      };

      const spawnBurst = (
        count: number,
        vmin: number,
        vmax: number,
        gold: boolean,
        upBias: number,
        lifeMin: number,
        lifeMax: number,
      ) => {
        group.updateMatrixWorld(true);
        centerW.set(0, 0.02, 0);
        group.localToWorld(centerW);
        const palette = gold ? palettes[getTheme()].gold : palettes[getTheme()].main;

        for (let i = 0; i < count && sparks.length < MAX_SPARKS; i++) {
          let idx = (Math.random() * heart.count) | 0;
          if (heart.positions[idx * 3 + 2] < 0) idx = (Math.random() * heart.count) | 0;

          tmpV.set(
            heart.positions[idx * 3],
            heart.positions[idx * 3 + 1],
            heart.positions[idx * 3 + 2],
          );
          group.localToWorld(tmpV);

          const dir = tmpV.clone().sub(centerW);
          if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
          dir.normalize();
          dir.x += (Math.random() - 0.5) * 1.5;
          dir.y += (Math.random() - 0.5) * 1.5 + upBias;
          dir.z += (Math.random() - 0.5) * 1.5;
          dir.normalize();

          const speed = vmin + Math.random() * (vmax - vmin);
          const life = lifeMin + Math.random() * (lifeMax - lifeMin);

          col.set(palette[(Math.random() * palette.length) | 0]);

          sparks.push({
            p: tmpV.clone(),
            v: dir.multiplyScalar(speed),
            life,
            max: life,
            size: 0.012 + Math.random() * 0.02,
            r: col.r,
            g: col.g,
            b: col.b,
            tw: Math.random() * 6.28,
          });
        }
      };

      // 布局：爱心在上、文字在下。大小按 hero 容器的短边走，
      // 这样窄屏（手机）和宽屏（桌面的内容栏）都不会顶到边。
      const layout = () => {
        const aspect = camera.aspect;
        const visibleH = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360);
        const factor = aspect > 0.7 ? 0.62 : 0.72;
        const scale = (factor * Math.min(aspect, 1) * visibleH) / 2.28;
        const frac = aspect > 0.7 ? 0.42 : 0.35;

        group.scale.setScalar(scale);
        group.position.set(0, (0.5 - frac) * visibleH, 0);
      };

      let lastBeat = 0;
      let beatCount = 0;

      const unsubTheme = subscribeTheme((theme) => {
        const attr = geometry.getAttribute('color') as THREE.BufferAttribute;
        (attr.array as Float32Array).set(
          theme === 'dark' ? heart.colorsDark : heart.colorsLight,
        );
        attr.needsUpdate = true;
      });

      return {
        scene,
        camera,
        update: (t: number, dt: number) => {
          const b = reduced ? 0 : beat(t);
          layout();

          const pulse = 1 + 0.075 * b;
          group.scale.multiplyScalar(pulse);

          if (!reduced) {
            group.rotation.y = Math.sin(t * 0.34) * 0.55;
            group.rotation.x = -0.06 + Math.sin(t * 0.21 + 0.7) * 0.05;
          } else {
            group.rotation.y = 0.18;
            group.rotation.x = -0.06;
          }

          material.size = 0.034 * (1 + 0.09 * b);

          if (!reduced && b > 0.5 && lastBeat <= 0.5) {
            beatCount++;
            spawnBurst(80, 1.1, 2.6, false, 0.2, 0.8, 1.5);
            if (beatCount % 4 === 0) {
              spawnBurst(560, 2.0, 4.2, true, 0.55, 1.5, 2.5);
              spawnBurst(240, 1.5, 3.0, false, 0.35, 1.0, 2.0);
            }
          }
          lastBeat = b;

          // 火星
          let n = 0;
          for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.life -= dt;
            if (s.life <= 0) {
              sparks.splice(i, 1);
              continue;
            }
            s.v.y -= 0.85 * dt;
            s.v.multiplyScalar(1 - 0.75 * dt);
            s.p.addScaledVector(s.v, dt);

            const k = s.life / s.max;
            const tw = 0.72 + 0.28 * Math.sin(t * 26 + s.tw);
            sparkPos[n * 3] = s.p.x;
            sparkPos[n * 3 + 1] = s.p.y;
            sparkPos[n * 3 + 2] = s.p.z;
            sparkColor[n * 3] = s.r;
            sparkColor[n * 3 + 1] = s.g;
            sparkColor[n * 3 + 2] = s.b;
            sparkSize[n] = s.size * (0.45 + 0.55 * k);
            sparkAlpha[n] = Math.pow(k, 1.25) * tw;
            n++;
          }
          sparkGeo.setDrawRange(0, n);
          (sparkGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
          (sparkGeo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
          (sparkGeo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
          (sparkGeo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
          sparkMat.uniforms.uScale.value =
            (window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)) /
            (2 * Math.tan((FOV * Math.PI) / 360));

          // 飞行：往下滚，镜头朝爱心推进
          const p = reduced ? 0 : easeInOutQuad(flyProgress());
          camera.position.z = CAM_Z + (FLY_Z - CAM_Z) * p;
          camera.position.x = Math.sin(t * 0.14) * 0.18 * (1 - p);
          camera.lookAt(0, 0, 0);
        },
        dispose: () => {
          unsubTheme();
        },
      };
    },
    [reduced],
  );

  const { ref, available } = useThreeCanvas(sceneFactory, CAM_Z);

  if (!available) {
    return <div className="heart-hero heart-hero--fallback" aria-hidden />;
  }
  return <div ref={ref} className="heart-hero" aria-hidden />;
}

