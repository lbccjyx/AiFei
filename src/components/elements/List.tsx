import {
  type ElementType,
  type HTMLAttributes,
  type LiHTMLAttributes,
  type ReactNode,
} from 'react';
import './List.css';

export type ListProps = {
  children: ReactNode;
  /** render as `<ol>` (ordered) or `<ul>` (default) */
  ordered?: boolean;
  /** draw hairline dividers between rows */
  divided?: boolean;
  /** remove default marker bullets/numbers */
  unstyled?: boolean;
  className?: string;
} & HTMLAttributes<HTMLElement>;

export type ListItemProps = LiHTMLAttributes<HTMLLIElement>;

/**
 * Generic vertical list with an optional divider treatment and a
 * `List.Item` row helper.
 *
 *   <List divided>
 *     <List.Item>…</List.Item>
 *   </List>
 */
function ListImpl({
  children,
  ordered = false,
  divided = false,
  unstyled = false,
  className = '',
  ...rest
}: ListProps) {
  const Tag: ElementType = ordered ? 'ol' : 'ul';
  const classes = [
    'ui-list',
    divided ? 'ui-list--divided' : '',
    unstyled ? 'ui-list--unstyled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

function Item({ children, className = '', ...rest }: ListItemProps) {
  const classes = ['ui-list__item', className].filter(Boolean).join(' ');
  return (
    <li className={classes} {...rest}>
      {children}
    </li>
  );
}

const List = Object.assign(ListImpl, { Item });

export default List;
