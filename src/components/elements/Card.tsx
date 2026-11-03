import { type HTMLAttributes, type ReactNode } from 'react';
import './Card.css';

export type CardProps = {
  children: ReactNode;
  /** bordered surface (default) or flat (no border, transparent) */
  variant?: 'outlined' | 'flat';
  /** add padding; pass false when the content manages its own padding */
  padded?: boolean;
  className?: string;
} & HTMLAttributes<HTMLElement>;

/**
 * Generic surface container with the site's border / radius language. Pure
 * layout: attach motion with the effects components, e.g.
 *
 *   <Tilt><Card>…</Card></Tilt>
 */
export default function Card({
  children,
  variant = 'outlined',
  padded = true,
  className = '',
  ...rest
}: CardProps) {
  const classes = [
    'ui-card',
    `ui-card--${variant}`,
    padded ? 'ui-card--padded' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes} {...rest}>
      {children}
    </section>
  );
}
