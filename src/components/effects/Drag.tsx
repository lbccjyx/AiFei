import { useRef, type CSSProperties, type ReactNode } from 'react';
import { spring } from 'animejs';
import { useDraggable } from '../../lib/motion';

export type DragProps = {
  children: ReactNode;
  /** turn the effect on/off (default true) */
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Effect element — attaches to its child and makes it grabbable: press and
 * drag to move it against edge resistance, release and it springs back home.
 * Same physics as the home page title (anime.js Draggable, pinned bounds).
 *
 *   <Drag><div className="lab__tile">drag me</div></Drag>
 */
export default function Drag({
  children,
  enabled = true,
  className = '',
  style,
}: DragProps) {
  const ref = useRef<HTMLDivElement>(null);
  // pinned bounds [0,0,0,0]: it travels within its own footprint (built-in
  // edge resistance) and springs back to the resting spot on release
  useDraggable(ref, {
    enabled,
    container: [0, 0, 0, 0],
    releaseEase: spring({ bounce: 0.7 }),
  });
  return (
    <div
      ref={ref}
      className={`fx fx-drag${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  );
}
