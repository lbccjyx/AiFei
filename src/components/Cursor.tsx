import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, spring, utils } from 'animejs';
import { getPointer, isFinePointer } from '../lib/pointer';
import { useReducedMotion } from '../hooks/useReducedMotion';

const INTERACTIVE = 'a, button, input, select, textarea, [role="button"], [tabindex]';
const HOVER_CHECK_MS = 80;

/** Stealth-fighter style arrow pointer (iconfont, white fill). */
function ArrowIcon() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const measured = useRef(false);
  const [vb, setVb] = useState('0 0 1066 1024');

  // After first paint, ask the browser for the arrow's exact painted bounds
  // and crop the viewBox to it (no hand math → nothing clips, and the
  // top-left corner of the crop is the drawn arrow's tip = the pointer).
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const p = pathRef.current;
    if (!svg || !p || measured.current) return;
    const sr = svg.getBoundingClientRect();
    const pr = p.getBoundingClientRect();
    if (sr.width === 0 || sr.height === 0 || pr.width === 0 || pr.height === 0) return;
    const unitsX = 1066 / sr.width; // px → viewBox units (aspect matched in CSS)
    const unitsY = 1024 / sr.height;
    const x = (pr.left - sr.left) * unitsX;
    const y = (pr.top - sr.top) * unitsY;
    const w = pr.width * unitsX;
    const h = pr.height * unitsY;
    const pad = Math.max(w, h) * 0.04;
    measured.current = true;
    setVb(
      `${(x - pad).toFixed(1)} ${(y - pad).toFixed(1)} ${(w + pad * 2).toFixed(1)} ${(h + pad * 2).toFixed(1)}`,
    );
  }, []);

  return (
    <svg
      ref={svgRef}
      className="icon-arrow"
      viewBox={vb}
      preserveAspectRatio="xMinYMin meet"
      aria-hidden
    >
      {/* mirror (ships pointing the other way) + tilt up ~15° toward 10-11 o'clock */}
      <g transform="translate(1066 0) scale(-1 1)">
        <g transform="rotate(-15 533 512)">
          <path
            ref={pathRef}
            d="M784.725333 81.834667c105.216-43.349333 210.432 61.866667 167.082667 167.082666l-260.266667 632.192c-44.586667 108.202667-198.997333 104.832-238.762666-5.205333L381.226667 677.973333a42.666667 42.666667 0 0 0-25.6-25.6l-197.888-71.552c-110.037333-39.765333-113.408-194.133333-5.205334-238.72l632.192-260.309333z"
          />
        </g>
      </g>
    </svg>
  );
}

/** Pointing hand (iconfont): a single solid silhouette with an outer outline,
 *  runtime-cropped like the arrow so its drawn top-left anchors on the
 *  pointer — the two icons share the same hotspot and switching never shifts. */
const HAND_BODY =
  'M840.757895 361.094737c5.389474 0 26.947368 0 43.115789 16.168421 16.168421 16.168421 26.947368 37.726316 26.947369 70.063158v258.694737l-102.4 269.473684H377.263158v-107.789474L161.684211 522.778947v-5.389473c0-5.389474-10.778947-32.336842-10.778948-53.894737 0-26.947368 10.778947-70.063158 86.231579-70.063158 26.947368 0 59.284211 16.168421 91.621053 53.894737V129.347368c0-5.389474 0-32.336842 21.557894-48.505263 16.168421-16.168421 43.115789-26.947368 75.452632-26.947368 32.336842 0 59.284211 10.778947 75.452632 26.947368 16.168421 21.557895 16.168421 43.115789 16.168421 48.505263v134.736843h70.063158c16.168421 0 48.505263 16.168421 64.673684 53.894736h70.063158c16.168421 0 43.115789 10.778947 53.894737 48.505264h64.673684z';

function HandIcon() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const measured = useRef(false);
  const [vb, setVb] = useState('0 0 1024 1024');

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const p = pathRef.current;
    if (!svg || !p || measured.current) return;
    const sr = svg.getBoundingClientRect();
    const pr = p.getBoundingClientRect();
    if (sr.width === 0 || sr.height === 0 || pr.width === 0 || pr.height === 0) return;
    const unitsX = 1024 / sr.width; // px → viewBox units (1:1 aspect in CSS)
    const unitsY = 1024 / sr.height;
    const x = (pr.left - sr.left) * unitsX;
    const y = (pr.top - sr.top) * unitsY;
    const w = pr.width * unitsX;
    const h = pr.height * unitsY;
    const pad = Math.max(w, h) * 0.04;
    measured.current = true;
    setVb(
      `${(x - pad).toFixed(1)} ${(y - pad).toFixed(1)} ${(w + pad * 2).toFixed(1)} ${(h + pad * 2).toFixed(1)}`,
    );
  }, []);

  return (
    <svg
      ref={svgRef}
      className="icon-hand"
      viewBox={vb}
      preserveAspectRatio="xMinYMin meet"
      aria-hidden
    >
      <path ref={pathRef} d={HAND_BODY} />
    </svg>
  );
}

/**
 * Custom stealth-fighter arrow cursor (self-managed):
 * - arrow tracks the pointer directly (zero lag, no spinning)
 * - squashes on press and springs back quickly on release
 * - turns into a small pointing hand over clickable elements
 * - takes over the right button too (native context menu suppressed)
 * White silhouettes + `mix-blend-mode: difference` auto-invert on any surface.
 * Active only for fine pointers without reduced motion; otherwise native.
 */
export default function Cursor() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const active = isFinePointer && !reduced;
  const [hovering, setHovering] = useState(false);
  const [over, setOver] = useState(false);

  // hide the native cursor only while the custom one is active
  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.add('has-custom-cursor');
    return () => document.documentElement.classList.remove('has-custom-cursor');
  }, [active]);

  // take over the right button too: suppress the native context menu while
  // the custom cursor owns the pointer (press feedback already fires for any
  // button via pointerdown below)
  useEffect(() => {
    if (!active) return;
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu);
    return () => window.removeEventListener('contextmenu', onContextMenu);
  }, [active]);

  // click bounce: squash on press, quick spring back on release
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const down = () =>
      animate(el, { scale: 0.85, duration: 90, ease: 'out(2)', composition: 'replace' });
    const up = () =>
      animate(el, { scale: 1, duration: 300, ease: spring({ bounce: 0.5 }), composition: 'replace' });
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, [active]);

  // direct follow + hover detection
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;

    let raf = 0;
    let lastHoverCheck = 0;

    const loop = () => {
      const p = getPointer();
      const now = performance.now();
      // direct follow (no lag, no rotation); hide when the pointer leaves
      // the window — the last position stays parked just outside/at the edge
      utils.set(el, { translateX: p.x, translateY: p.y });
      if (p.over !== over) setOver(p.over);

      // hover detection (throttled): swap arrow <-> hand
      if (now - lastHoverCheck >= HOVER_CHECK_MS) {
        lastHoverCheck = now;
        const stack = document
          .elementsFromPoint(p.x, p.y)
          .filter((n) => !n.closest('.cursor'));
        const overInteractive = stack.some((n) => n.closest(INTERACTIVE));
        if (overInteractive !== hovering) setHovering(overInteractive);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, hovering, over]);

  if (!active) return null;

  return (
    // both icons stay mounted; the mode class crossfades them so switching
    // arrow <-> hand never jumps
    <div
      ref={ref}
      className={[
        'cursor',
        hovering ? 'is-hand' : '',
        over ? '' : 'is-out',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    >
      <ArrowIcon />
      <HandIcon />
    </div>
  );
}