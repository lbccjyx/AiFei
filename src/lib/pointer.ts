/**
 * Unified pointer state. A single module-level snapshot is kept up to date by
 * global listeners and re-emitted to subscribers, so every effect (custom
 * cursor, magnetic/tilt/parallax, three.js scenes) reads from the same source.
 */
export type PointerSnapshot = {
  /** client coordinates */
  x: number;
  y: number;
  /** normalized -1..1 relative to the viewport center */
  nx: number;
  ny: number;
  /** velocity, px per 16.67ms frame */
  vx: number;
  vy: number;
  pressed: boolean;
  /** whether the pointer is over the window */
  over: boolean;
};

const snap: PointerSnapshot = {
  x: 0,
  y: 0,
  nx: 0,
  ny: 0,
  vx: 0,
  vy: 0,
  pressed: false,
  // start hidden — the icon only appears once a real pointer enters
  over: false,
};

let lastX = 0;
let lastY = 0;
let lastT = 0;
const subscribers = new Set<(s: PointerSnapshot) => void>();

function emit() {
  for (const fn of subscribers) fn(snap);
}

function track(event: PointerEvent) {
  const now = performance.now();
  if (lastT) {
    const dt = Math.max(8, now - lastT);
    snap.vx = ((event.clientX - lastX) / dt) * 16.67;
    snap.vy = ((event.clientY - lastY) / dt) * 16.67;
  }
  lastX = event.clientX;
  lastY = event.clientY;
  lastT = now;
  snap.x = event.clientX;
  snap.y = event.clientY;
  snap.nx = (event.clientX / window.innerWidth) * 2 - 1;
  snap.ny = (event.clientY / window.innerHeight) * 2 - 1;
  snap.pressed = (event.buttons & 1) === 1;
  snap.over = true;
  emit();
}

export function subscribePointer(fn: (s: PointerSnapshot) => void): () => void {
  subscribers.add(fn);
  fn(snap);
  return () => {
    subscribers.delete(fn);
  };
}

export function getPointer(): PointerSnapshot {
  return snap;
}

/**
 * True only for devices whose primary pointer is a precise, hovering one
 * (mouse / trackpad). Touch-primary devices report `(pointer: coarse)` even
 * though some also match `(pointer: fine)` for a secondary stylus, so the
 * `hover: hover` + `pointer: fine` pair is what actually excludes phones.
 */
export const isFinePointer =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** Touch-primary device (phone / tablet): no hovering cursor, coarse input. */
export const isCoarsePointer =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', track, { passive: true });
  window.addEventListener('pointerdown', track, { passive: true });
  window.addEventListener('pointerup', track, { passive: true });

  // Track whether the mouse is inside the viewport. Pointer Events on
  // `window` are unreliable for this across browsers (enter/leave don't fire
  // while a button is held; some ports never fire them on window), so use
  // mouse events on documentElement: mouseleave there == left the page, and
  // relatedTarget null is the cross-browser equivalent.
  const markOver = () => {
    if (!snap.over) {
      snap.over = true;
      emit();
    }
  };
  const markOut = () => {
    if (snap.over) {
      snap.over = false;
      emit();
    }
  };
  document.documentElement.addEventListener('mouseenter', markOver);
  document.documentElement.addEventListener('mouseleave', markOut);
  document.documentElement.addEventListener('mouseover', (e) => {
    if (!e.relatedTarget) markOver();
  });
  document.documentElement.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) markOut();
  });
}
