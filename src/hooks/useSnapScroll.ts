import { useEffect, type RefObject } from 'react';
import { isCoarsePointer } from '../lib/pointer';
import { useReducedMotion } from './useReducedMotion';

/**
 * Paged (snap) scrolling over an ordered list of sections.
 *
 * - Desktop (wheel / keyboard): one gesture drives one smooth glide to the
 *   next section; wheel deltas accumulate so a trackpad fling is one page.
 * - Touch: the finger is tracked directly. While held, scrollY follows the
 *   finger 1:1 (the pinned hero fly-through plays in lockstep), and on
 *   release the page glides to the adjacent section chosen by travel
 *   distance and flick velocity — a single continuous motion. Native touch
 *   scrolling is disabled on touch devices (`touch-action: none`) so it can't
 *   fight the mapping; horizontal gestures are left to the browser.
 *
 * `refs` are the section elements in document order; `offsets` optionally
 * adjusts each section's scroll target (px, e.g. -20 to clear the page top).
 * Reduced motion snaps instantly instead of gliding.
 *
 * The glide lock is fail-safe: `go()` skips no-op targets (already there —
 * e.g. at a boundary, which fires no scroll event), a fallback timer always
 * releases the lock, and mid-glide is detected by distance to the last target
 * so the wheel can never get stuck permanently.
 */
export function useSnapScroll(
  refs: RefObject<HTMLElement | null>[],
  offsets: number[] = [],
) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const nodes = refs.map((r) => r.current).filter((n): n is HTMLElement => !!n);
    if (nodes.length === 0) return;

    const tops = () =>
      nodes.map((n, i) => n.getBoundingClientRect().top + window.scrollY + (offsets[i] ?? 0));

    const nearestTo = (list: number[], y: number) => {
      let best = 0;
      for (let i = 1; i < list.length; i++) {
        if (Math.abs(list[i] - y) < Math.abs(list[best] - y)) best = i;
      }
      return best;
    };

    const nearest = (list: number[]) => nearestTo(list, window.scrollY);

    let animating = false;
    let lastTarget: number | null = null;
    let settleTimer = 0;
    let failSafeTimer = 0;
    let acc = 0;

    const go = (i: number) => {
      const list = tops();
      const c = Math.max(0, Math.min(list.length - 1, i));
      const target = list[c];
      // no-op if already there (e.g. scrolling past the last page): never set
      // the lock, otherwise no scroll event fires and the wheel would stick
      if (Math.abs(target - window.scrollY) < 1) {
        acc = 0;
        return;
      }
      animating = true;
      lastTarget = target;
      window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
      // safety net: release the lock even if no scroll event ever fires
      window.clearTimeout(failSafeTimer);
      failSafeTimer = window.setTimeout(() => {
        animating = false;
      }, 1600);
    };

    // release the glide lock shortly after scrolling settles
    const onScroll = () => {
      if (!animating) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        animating = false;
        lastTarget = null;
        window.clearTimeout(failSafeTimer);
      }, 160);
    };

    const onWheel = (e: WheelEvent) => {
      // hold input while a glide is in flight — either flagged or still far
      // from where we last aimed
      const gliding =
        animating || (lastTarget !== null && Math.abs(window.scrollY - lastTarget) > 60);
      if (gliding) {
        e.preventDefault(); // don't let the native scroll fight the glide
        return;
      }
      acc += e.deltaY;
      if (Math.abs(acc) < 50) return;
      const dir = acc > 0 ? 1 : -1;
      acc = 0;
      e.preventDefault();
      go(nearest(tops()) + dir);
    };

    const onKey = (e: KeyboardEvent) => {
      let dir = 0;
      if (e.key === 'PageDown' || e.key === 'ArrowDown') dir = 1;
      else if (e.key === 'PageUp' || e.key === 'ArrowUp') dir = -1;
      else if (e.key === 'Home' || e.key === 'End') {
        // always swallow native paging — even mid-glide, where it would
        // otherwise cancel the smooth scroll and strand the page
        e.preventDefault();
        if (!animating) go(e.key === 'Home' ? 0 : tops().length - 1);
        return;
      }
      if (dir === 0) return;
      // Always preventDefault, including while a glide is in flight: key
      // repeat otherwise drives native scrolling that cancels the smooth
      // glide halfway (the wheel path already does this).
      e.preventDefault();
      if (animating) return;
      go(nearest(tops()) + dir);
    };

    // --- touch: direct finger-driven paging --------------------------------
    // Native vertical scrolling is taken over (touch-action: none). The page
    // follows the finger while held; release flips to the adjacent section by
    // travel distance or flick velocity, gliding continuously to it.
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollY = 0;
    let lastClientY = 0;
    let lastMoveT = 0;
    let velocity = 0; // px/ms, positive when the finger moves down
    let raf = 0;
    let pendingY: number | null = null;
    let axisLocked: 'x' | 'y' | null = null;
    let prevTouchAction = '';
    let prevOverscroll = '';

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const applyPending = () => {
      raf = 0;
      if (pendingY !== null) {
        const clamped = Math.max(0, Math.min(maxScroll(), pendingY));
        window.scrollTo(0, clamped);
        pendingY = null;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      dragging = true;
      axisLocked = null;
      startX = t.clientX;
      startY = t.clientY;
      lastClientY = t.clientY;
      startScrollY = window.scrollY;
      lastMoveT = performance.now();
      velocity = 0;
      window.clearTimeout(settleTimer);
      // a finger landing cancels any in-flight glide and takes over
      animating = false;
      lastTarget = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      // a second finger (pinch / two-finger scroll) ends the paged gesture
      if (e.touches.length !== 1) {
        release();
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // decide gesture axis once; ignore horizontal swipes entirely
      if (!axisLocked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axisLocked === 'x') {
          dragging = false;
          return;
        }
      }
      if (axisLocked === 'x') return;

      e.preventDefault(); // we own vertical scrolling
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      velocity = (t.clientY - lastClientY) / dt;
      lastClientY = t.clientY;
      lastMoveT = now;

      // content follows the finger 1:1: finger down (dy>0) reveals content
      // above. Clamped to the document edges (hard stop); the release glide
      // always lands on a valid section.
      pendingY = Math.max(0, Math.min(maxScroll(), startScrollY - dy));
      if (!raf) raf = requestAnimationFrame(applyPending);
    };

    const release = () => {
      if (!dragging) return;
      dragging = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      applyPending();
      if (axisLocked !== 'y') return;

      // choose the target: a strong flick OR a drag past ~22% of the viewport
      const travel = lastClientY - startY;
      const flick = Math.abs(velocity) > 0.45;
      const far = Math.abs(travel) > window.innerHeight * 0.22;
      let dir = 0;
      if (flick || far) dir = velocity < 0 || travel < 0 ? 1 : -1;

      if (reduced) {
        go(nearest(tops()) + dir);
        return;
      }
      // from the CURRENT position: a short drag stays on this page (glides
      // back), a deliberate gesture advances exactly one section
      go(nearest(tops()) + dir);
    };

    if (isCoarsePointer) {
      // take over touch input at the root scroller; restore on cleanup
      prevTouchAction = document.documentElement.style.touchAction;
      prevOverscroll = document.documentElement.style.overscrollBehavior;
      document.documentElement.style.touchAction = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', release, { passive: true });
      window.addEventListener('touchcancel', release, { passive: true });
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', release);
      window.removeEventListener('touchcancel', release);
      if (raf) cancelAnimationFrame(raf);
      if (isCoarsePointer) {
        document.documentElement.style.touchAction = prevTouchAction;
        document.documentElement.style.overscrollBehavior = prevOverscroll;
      }
      window.clearTimeout(settleTimer);
      window.clearTimeout(failSafeTimer);
    };
  }, [refs, reduced, offsets]);
}
