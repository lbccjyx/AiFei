import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { animate, spring, utils } from 'animejs';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import './Flip.css';

export type FlipProps = {
  /** shown face */
  front: ReactNode;
  /** hidden face revealed on flip */
  back: ReactNode;
  /**
   * - `hover` — flips on pointer enter/leave
   * - `click` — toggles on click / Enter / Space (also exposes aria state)
   */
  trigger?: 'hover' | 'click';
  /** rotate around the vertical ('y', default) or horizontal ('x') axis */
  axis?: 'x' | 'y';
  /** flip duration in ms (default 700) */
  duration?: number;
  /** perspective distance in px (default 1000) */
  perspective?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Effect element — wraps two faces in a 3D card that flips between them on
 * hover or click. Faces must share the same box size (give each face explicit
 * sizing if their natural sizes differ). Under reduced motion the faces
 * cross-fade without rotation.
 *
 *   <Flip front={<Card>Question?</Card>} back={<Card>Answer</Card>} />
 */
export default function Flip({
  front,
  back,
  trigger = 'hover',
  axis = 'y',
  duration = 700,
  perspective = 1000,
  className = '',
  style,
}: FlipProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const reduced = useReducedMotion();

  const rotateProp = axis === 'x' ? 'rotateX' : 'rotateY';

  const apply = (showBack: boolean) => {
    const inner = innerRef.current;
    if (!inner) return;
    if (reduced) {
      // no rotation: cross-fade the two faces
      utils.set(inner, { rotateX: 0, rotateY: 0 });
      if (frontRef.current) {
        animate(frontRef.current, { opacity: showBack ? 0 : 1, duration: 200 });
      }
      if (backRef.current) {
        animate(backRef.current, { opacity: showBack ? 1 : 0, duration: 200 });
      }
      return;
    }
    animate(inner, {
      [rotateProp]: showBack ? 180 : 0,
      duration,
      ease: spring({ bounce: 0.35 }),
      composition: 'replace',
    });
  };

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    apply(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (trigger !== 'click') return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggle();
  };

  const interactive = trigger === 'click';

  return (
    <div
      className={[
        'fx',
        'fx-flip',
        axis === 'x' ? 'fx-flip--x' : 'fx-flip--y',
        reduced ? 'fx-flip--reduced' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ perspective, ...style }}
      onPointerEnter={trigger === 'hover' ? () => apply(true) : undefined}
      onPointerLeave={trigger === 'hover' ? () => apply(false) : undefined}
      onClick={interactive ? toggle : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? flipped : undefined}
    >
      <div ref={innerRef} className="fx-flip__inner">
        <div ref={frontRef} className="fx-flip__face fx-flip__front">
          {front}
        </div>
        <div ref={backRef} className="fx-flip__face fx-flip__back">
          {back}
        </div>
      </div>
    </div>
  );
}
