/** Node types for the self-written markdown engine. */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'em'; children: Inline[] }
  | { type: 'strong'; children: Inline[] }
  | { type: 'del'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; title?: string; children: Inline[] }
  | { type: 'image'; alt: string; src: string; title?: string }
  | { type: 'html'; html: string };

export type ListItem = { children: Block[] };

export type Block =
  | { type: 'heading'; level: number; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { type: 'hr' }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { type: 'html'; html: string };
