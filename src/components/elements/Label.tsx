import { type ReactNode } from 'react';
import './Label.css';

export type LabelVariant = 'text' | 'eyebrow' | 'badge';
export type LabelTone = 'default' | 'muted' | 'accent';

export type LabelProps = {
  children: ReactNode;
  /**
   * - `text`    — plain inline text (default)
   * - `eyebrow` — small uppercase tracked heading label
   * - `badge`   — bordered pill marker
   */
  variant?: LabelVariant;
  /** color treatment (default 'default') */
  tone?: LabelTone;
  className?: string;
};

/**
 * Small inline descriptive text: field names, section eyebrows, status
 * badges. Purely presentational — for interactive chips see TagPill.
 *
 *   <Label variant="eyebrow">Section</Label>
 *   <Label variant="badge" tone="accent">New</Label>
 */
export default function Label({
  children,
  variant = 'text',
  tone = 'default',
  className = '',
}: LabelProps) {
  const classes = [
    'ui-label',
    `ui-label--${variant}`,
    `ui-label--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <span className={classes}>{children}</span>;
}
