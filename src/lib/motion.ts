import { animate, spring, utils, createDraggable, createScope } from 'animejs';
import { useEffect, useState, type RefObject } from 'react';
import { isFinePointer, subscribePointer } from './pointer';
import { getScroll, HERO_FLY_RUNWAY_VH } from './scroll';
import { useReducedMotion } from '../hooks/useReducedMotion';

type TweenTarget = HTMLElement | SVGElement;

/**
 * Conventional magnetic behavior: while the pointer is over the element, the
 * element follows it with a small offset proportional to the pointer's
 * position within the element (max `maxOffset` px); it springs back to rest
 * when the pointer leaves. No radius, no extra clamping.
 */
export function useMagnetic<T extends TweenTarget>(
  ref: RefObject<T | null>,
  opts: {
    /** maximum pixel offset when the pointer is at the element's edge */
    maxOffset?: number;
    enabled?: boolean;
  } = {},
) {
  const { maxOffset = 8, enabled = true } = opts;
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || reduced || !isFinePointer) return;

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // pointer position within the element, normalized -0.5..0.5
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      animate(el, {
        translateX: px * 2 * maxOffset,
        translateY: py * 2 * maxOffset,
        duration: 120,
        ease: 'out(3)',
        composition: 'replace',
      });
    };

    const onLeave = () =>
      animate(el, {
        translateX: 0,
        translateY: 0,
        duration: 260,
        ease: spring({ bounce: 0.4 }),
        composition: 'replace',
      });

    el.addEventListener('pointermove', onMove as EventListener);
    el.addEventListener('pointerleave', onLeave as EventListener);
    return () => {
      el.removeEventListener('pointermove', onMove as EventListener);
      el.removeEventListener('pointerleave', onLeave as EventListener);
      animate(el, {
        translateX: 0,
        translateY: 0,
        duration: 120,
        ease: 'out(2)',
        composition: 'replace',
      });
    };
  }, [ref, maxOffset, enabled, reduced]);
}

/**
 * Tilts the element toward the cursor while hovered (parent needs
 * `perspective`).
 */
export function useTilt<T extends TweenTarget>(
  ref: RefObject<T | null>,
  opts: { max?: number; enabled?: boolean } = {},
) {
  const { max = 8, enabled = true } = opts;
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || reduced || !isFinePointer) return;

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      animate(el, {
        rotateX: -py * max,
        rotateY: px * max,
        duration: 180,
        ease: 'out(3)',
        composition: 'replace',
      });
    };
    const onLeave = () =>
      animate(el, {
        rotateX: 0,
        rotateY: 0,
        duration: 360,
        ease: spring({ bounce: 0.4 }),
        composition: 'replace',
      });

    el.addEventListener('pointermove', onMove as EventListener);
    el.addEventListener('pointerleave', onLeave as EventListener);
    return () => {
      el.removeEventListener('pointermove', onMove as EventListener);
      el.removeEventListener('pointerleave', onLeave as EventListener);
    };
  }, [ref, max, enabled, reduced]);
}

/**
 * Parallax: shifts the element by the pointer position (normalized -1..1),
 * scaled by `depth` and the viewport size.
 */
export function useParallax<T extends TweenTarget>(
  ref: RefObject<T | null>,
  depth = 0.03,
) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    return subscribePointer((s) => {
      utils.set(el, {
        translateX: s.nx * depth * 100,
        translateY: s.ny * depth * 60,
      });
    });
  }, [ref, depth, reduced]);
}

/**
 * Scroll-driven transform: every frame while mounted, computes the home hero
 * fly-through progress (0..1 over `HERO_FLY_RUNWAY_VH`) and calls `fn` with
 * it, so the caller can imperatively write styles (`utils.set`) — never state,
 * which would re-render every frame. Skipped (progress pinned to 0) under
 * reduced motion.
 */
export function useScrollTransform<T extends TweenTarget>(
  ref: RefObject<T | null>,
  opts: {
    /** turn the effect off entirely (default true) */
    enabled?: boolean;
    /** called every frame with the element and progress 0..1 */
    fn: (el: T, p: number) => void;
  },
) {
  const { enabled = true, fn } = opts;
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled || reduced) {
      fn(el, 0);
      return;
    }
    let raf = 0;
    const loop = () => {
      const total = window.innerHeight * (HERO_FLY_RUNWAY_VH / 100);
      const p = total > 0 ? Math.min(1, Math.max(0, getScroll().y / total)) : 0;
      fn(el, p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ref, enabled, reduced, fn]);
}

/**
 * Makes the element draggable with anime.js's built-in Draggable physics.
 * With the default pinned container `[0, 0, 0, 0]` the element stays near its
 * resting spot (built-in edge resistance) and springs home on release — the
 * same pattern as anime.js's draggable logo demo.
 */
export function useDraggable<T extends HTMLElement>(
  ref: RefObject<T | null>,
  opts: {
    /** turn the effect on/off (default true) */
    enabled?: boolean;
    /** drag bounds relative to the resting spot [top, right, bottom, left];
     *  defaults to pinned `[0, 0, 0, 0]` (move in place, spring back) */
    container?: [number, number, number, number];
    /** easing applied on release; defaults to a bouncy spring */
    releaseEase?: ReturnType<typeof spring>;
  } = {},
) {
  const {
    enabled = true,
    container = [0, 0, 0, 0],
    releaseEase,
  } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const scope = createScope({ root: el }).add(() => {
      createDraggable(el, {
        container,
        releaseEase: releaseEase ?? spring({ bounce: 0.7 }),
      });
    });
    return () => {
      scope.revert();
    };
  }, [ref, enabled, container, releaseEase]);
}

/**
 * Press-and-release bounce: squashes the element while pressed, then springs
 * it back with a bouncy anime.js spring on release — the classic "charge and
 * pop" click feedback. Skipped under reduced motion.
 */
export function useClickBounce<T extends TweenTarget>(
  ref: RefObject<T | null>,
  opts: { enabled?: boolean; pressScale?: number; bounce?: number } = {},
) {
  const { enabled = true, pressScale = 0.9, bounce = 0.6 } = opts;
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || reduced) return;

    const press = () =>
      animate(el, {
        scale: pressScale,
        duration: 110,
        ease: 'out(3)',
        composition: 'replace',
      });
    const release = () =>
      animate(el, {
        scale: 1,
        duration: 700,
        ease: spring({ bounce }),
        composition: 'replace',
      });

    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    return () => {
      el.removeEventListener('pointerdown', press);
      el.removeEventListener('pointerup', release);
      el.removeEventListener('pointercancel', release);
      el.removeEventListener('pointerleave', release);
      utils.set(el, { scale: 1 });
    };
  }, [ref, enabled, reduced, pressScale, bounce]);
}

/**
 * Reveals when the element scrolls into view (IntersectionObserver).
 */
export function useInView<T extends HTMLElement>(
  ref: RefObject<T | null>,
  opts: { threshold?: number; rootMargin?: string; once?: boolean } = {},
): boolean {
  const { threshold = 0, rootMargin = '0px 0px -40px 0px', once = true } = opts;
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) io.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, rootMargin, once]);

  return inView;
}
