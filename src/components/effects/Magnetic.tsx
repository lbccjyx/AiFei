import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useMagnetic as useMagneticHook } from '../../lib/motion';

export type MagneticProps = {
  children: ReactNode;
  /** turn the effect on/off (default true) */
  enabled?: boolean;
  /** max pixel offset toward the cursor (default 12) */
  offset?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Effect element — attaches to its child and pulls it toward the cursor
 * while hovered, springing back on leave. Renders a wrapper div; size it via
 * `className`/`style`. Fine pointers only, respects reduced motion.
 *
 *   <Magnetic offset={18}><Button>Follow me</Button></Magnetic>
 */
export default function Magnetic({
  children,
  enabled = true,
  offset = 12,
  className = '',
  style,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  useMagneticHook(ref, { enabled, maxOffset: offset });
  return (
    <div
      ref={ref}
      className={`fx fx-magnetic${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  );
}
