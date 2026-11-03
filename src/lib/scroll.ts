/**
 * Unified scroll snapshot. A module-level snapshot is kept up to date by
 * global listeners so any rAF loop (three scenes, scroll-driven transforms)
 * can read the current scroll position without subscribing — mirroring the
 * pointer store in `pointer.ts`.
 */

export type ScrollSnapshot = {
  /** current vertical scroll offset (px) */
  y: number;
  /** smoothed vertical velocity, px per frame (16.67ms) */
  vy: number;
};

/** Height of the home hero fly-through runway, in viewport-height units. */
export const HERO_FLY_RUNWAY_VH = 130;

const snap: ScrollSnapshot = { y: 0, vy: 0 };

let lastY = 0;
let lastT = 0;
let pending = false;

function read() {
  pending = false;
  const y = window.scrollY;
  const now = performance.now();
  if (lastT) {
    const dt = Math.max(8, now - lastT);
    snap.vy = ((y - lastY) / dt) * 16.67;
  }
  snap.y = y;
  lastY = y;
  lastT = now;
}

function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(read);
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  read();
}

export function getScroll(): ScrollSnapshot {
  return snap;
}

