import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useTilt as useTiltHook } from '../../lib/motion';

export type TiltProps = {
  children: ReactNode;
  /** turn the effect on/off (default true) */
  enabled?: boolean;
  /** max tilt angle in degrees (default 10) */
  max?: number;
  /** perspective distance in px (default 900) */
  perspective?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Effect element — attaches to its child and rotates it in 3D toward the
 * cursor while hovered (rotateX/rotateY), easing back flat on leave. The
 * outer wrapper carries `perspective` (it must sit on the rotated element's
 * parent) and the inner element rotates, so no `perspective` CSS is needed
 * at the call site. Fine pointers only, respects reduced motion.
 *
 *   <Tilt max={14}><Card>…</Card></Tilt>
 */
export default function Tilt({
  children,
  enabled = true,
  max = 10,
  perspective = 900,
  className = '',
  style,
}: TiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  useTiltHook(ref, { enabled, max });
  return (
    <div
      className={`fx fx-tilt${className ? ` ${className}` : ''}`}
      style={{ perspective, ...style }}
    >
      <div ref={ref} className="fx-tilt__inner">
        {children}
      </div>
    </div>
  );
}
