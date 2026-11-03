import {
  useRef,
  type ElementType,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useMagnetic, useTilt, useDraggable, useClickBounce } from '../lib/motion';
import { isPlainClick, usePageReveal } from './page-reveal-context';

/** default pinned drag bounds: move in place, spring back home */
const PINNED_CONTAINER: [number, number, number, number] = [0, 0, 0, 0];

export type FxProps = {
  /** element to render; defaults to 'div'. Any intrinsic element works. */
  as?: ElementType;
  /** apply the magnetic follow effect */
  magnetic?: boolean;
  /** max pixel offset for magnetic (default 8) */
  magneticOffset?: number;
  /** apply the tilt-on-hover effect (parent needs `perspective`) */
  tilt?: boolean;
  /** max tilt angle in degrees (default 8) */
  tiltMax?: number;
  /**
   * Make the element draggable (anime.js Draggable). `true` pins it to its
   * resting spot (moves in place, springs home on release); pass an explicit
   * `[top, right, bottom, left]` bounds array to allow travel (memoize it).
   */
  drag?: boolean | [number, number, number, number];
  /** press-and-release bounce: squash while pressed, spring back on release */
  bounce?: boolean;
  /**
   * Click effect. Pass a pageId string to navigate there through the
   * page-reveal pipeline on a plain left click (coordinates are passed
   * through), or pass a handler to run custom click logic.
   */
  click?: string | ((e: MouseEvent<HTMLElement>) => void);
  /** for `as="button"` */
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLElement>;

/**
 * Declarative effects wrapper: any element can opt into magnetic, tilt, drag,
 * bounce and/or click behavior without writing its own hooks.
 *
 *   <Fx magnetic tilt click="post:hello-world">…</Fx>
 *   <Fx drag bounce>My Blog</Fx>
 *
 * The low-level hooks (useMagnetic / useTilt / useDraggable / useClickBounce)
 * remain available in lib/motion for custom cases.
 */
export default function Fx({
  as: Tag = 'div',
  magnetic = false,
  magneticOffset,
  tilt = false,
  tiltMax,
  drag = false,
  bounce = false,
  click,
  type,
  className,
  children,
  onClick,
  onKeyDown,
  ...rest
}: FxProps) {
  const ref = useRef<HTMLElement>(null);
  useMagnetic(ref, { enabled: magnetic, maxOffset: magneticOffset });
  useTilt(ref, { enabled: tilt, max: tiltMax });
  useDraggable(ref, {
    enabled: drag !== false,
    container: drag === false || drag === true ? PINNED_CONTAINER : drag,
  });
  useClickBounce(ref, { enabled: bounce });
  const startReveal = usePageReveal();

  const interactive = click !== undefined;

  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (typeof click === 'string') {
      if (!isPlainClick(e)) return;
      startReveal(click, e.clientX, e.clientY);
      return;
    }
    click?.(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(e);
    if (!interactive || typeof click !== 'string') return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    startReveal(click, window.innerWidth / 2, window.innerHeight / 2);
  };

  return (
    <Tag
      ref={ref as Ref<never>}
      type={type}
      className={className}
      onClick={interactive ? handleClick : onClick}
      onKeyDown={handleKeyDown}
      {...(interactive && !rest.role ? { role: 'button', tabIndex: 0 } : {})}
      {...rest}
    >
      {children}
    </Tag>
  );
}
