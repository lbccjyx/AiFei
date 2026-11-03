import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { animate, spring, utils } from 'animejs';
import { useInView } from '../../lib/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export type FlipInProps = {
  children: ReactNode;
  /** stagger delay in ms */
  delay?: number;
  /** entrance duration in ms */
  duration?: number;
  /** initial rotation angle in deg (default 55) */
  angle?: number;
  /** perspective distance in px (default 1000) */
  perspective?: number;
  /** which side the element flips from (default 'left') */
  side?: 'left' | 'right';
  className?: string;
};

/**
 * Reusable scroll-triggered 3D flip-in entrance effect. Wraps any content: it
 * flips from `rotateY(±angle)` with perspective and a bouncy spring settle
 * every time it scrolls into view — scrolling away resets it to the hidden
 * state so each entrance replays. Hidden state is applied before first paint;
 * reduced motion shows the content instantly.
 *
 *   <FlipIn side="left" delay={80}>…</FlipIn>
 */
export default function FlipIn({
  children,
  delay = 0,
  duration = 950,
  angle = 55,
  perspective = 1000,
  side = 'left',
  className = '',
}: FlipInProps) {
  // The outer div is the IntersectionObserver sentinel — it never transforms,
  // so the entrance animation (which DOES transform the inner div) can't shift
  // the observed box across a viewport edge and re-trigger itself (feedback
  // loop that made the flip replay continuously).
  const ref = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || reduced) return;
    const dir = side === 'left' ? -1 : 1;
    utils.set(el, { opacity: 0, rotateY: dir * angle, translateY: 40, perspective });
    if (!inView) return;
    const anim = animate(el, {
      opacity: 1,
      rotateY: 0,
      translateY: 0,
      perspective,
      duration,
      delay,
      ease: spring({ bounce: 0.45 }),
      composition: 'replace',
    });
    return () => {
      anim.pause();
    };
  }, [inView, reduced, delay, duration, angle, perspective, side]);

  return (
    <div ref={ref} className={`flip-in${className ? ` ${className}` : ''}`}>
      <div ref={innerRef} className="flip-in__inner">
        {children}
      </div>
    </div>
  );
}
