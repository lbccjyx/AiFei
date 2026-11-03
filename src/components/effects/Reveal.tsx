import { animate, utils } from 'animejs';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useInView } from '../../lib/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export type RevealProps = {
  children: ReactNode;
  /** stagger delay in ms */
  delay?: number;
  /** entrance duration in ms */
  duration?: number;
  /** entrance travel distance in px */
  y?: number;
  className?: string;
};

/**
 * Scroll-triggered entrance wrapper: fades + slides its content in once it
 * scrolls into view. Renders instantly when reduced motion is requested.
 */
export default function Reveal({
  children,
  delay = 0,
  duration = 560,
  y = 26,
  className = '',
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();

  // useLayoutEffect (not useEffect): the hidden/animated state must be applied
  // BEFORE the first paint, otherwise the content flashes fully visible for a
  // frame on mount and only then hides and fades in.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      utils.set(el, { opacity: 1, translateY: 0 });
      return;
    }
    if (!inView) {
      utils.set(el, { opacity: 0, translateY: y });
      return;
    }
    animate(el, {
      opacity: [0, 1],
      translateY: [y, 0],
      duration,
      delay,
      ease: 'out(3)',
      composition: 'replace',
    });
  }, [inView, reduced, delay, duration, y]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
