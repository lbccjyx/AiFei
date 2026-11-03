import { animate, spring, utils } from 'animejs';
import { useRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { useMagnetic } from '../../lib/motion';
import './Button.css';

type Variant = 'solid' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  variant?: Variant;
  size?: Size;
  /** element is attracted toward the cursor (fine pointers only) */
  magnetic?: boolean;
  /** show a ripple at the click position */
  ripple?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  variant = 'solid',
  size = 'md',
  magnetic = false,
  ripple = true,
  className = '',
  children,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onClick,
  ...rest
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useMagnetic(ref, { enabled: magnetic });

  const pressIn = () => {
    const el = ref.current;
    if (!el) return;
    animate(el, {
      scale: 0.95,
      duration: 90,
      ease: 'out(2)',
      composition: 'replace',
    });
  };

  const pressOut = () => {
    const el = ref.current;
    if (!el) return;
    animate(el, {
      scale: 1,
      duration: 240,
      ease: spring({ bounce: 0.5 }),
      composition: 'replace',
    });
  };

  const spawnRipple = (event: MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || !ripple) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2.2;
    const span = document.createElement('span');
    span.className = 'btn-ripple';
    span.style.left = `${x}px`;
    span.style.top = `${y}px`;
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    el.appendChild(span);
    utils.set(span, { scale: 0, opacity: 0.5 });
    animate(span, {
      scale: 1,
      duration: 480,
      ease: 'out(3)',
      composition: 'replace',
    });
    animate(span, {
      opacity: 0,
      duration: 480,
      ease: 'out(2)',
      composition: 'replace',
      onComplete: () => span.remove(),
    });
  };

  const classes = ['btn', `btn--${variant}`, `btn--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      onPointerDown={(e) => {
        pressIn();
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        pressOut();
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        pressOut();
        onPointerLeave?.(e);
      }}
      onClick={(e) => {
        spawnRipple(e);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
