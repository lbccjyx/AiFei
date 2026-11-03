import { type MouseEvent } from 'react';
import { isPlainClick, usePageReveal } from './page-reveal-context';
import './TagPill.css';

/**
 * Tag pill. By default it is clickable and navigates to the tag's
 * collection page (`tag:<name>`); stopPropagation keeps nested pills
 * (e.g. inside a post card) from triggering the parent's click.
 *
 * Pass `interactive={false}` where tags are decorative only (post cards),
 * so they render as a plain span and never navigate.
 */
export default function TagPill({
  tag,
  interactive = true,
}: {
  tag: string;
  interactive?: boolean;
}) {
  const startReveal = usePageReveal();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isPlainClick(e)) return;
    startReveal(`tag:${tag}`, e.clientX, e.clientY);
  };

  if (!interactive) {
    return (
      <span className="tag-pill tag-pill--plain" aria-hidden="true">
        {tag}
      </span>
    );
  }

  return (
    <button type="button" className="tag-pill" onClick={handleClick}>
      {tag}
    </button>
  );
}
