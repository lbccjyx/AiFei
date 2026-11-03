import { Fragment, type ElementType, type ReactNode } from 'react';
import { parseMarkdown } from './tokenizer';
import ArticleImage from '../../components/ArticleImage';
import type { Block, Inline } from './ast';

/**
 * Renders the markdown AST into React elements. Default elements are plain
 * intrinsic tags styled by `.article` CSS so the output always matches the
 * blog look; `components` lets callers override any tag (e.g. custom heading
 * or code components). Text is escaped by React automatically; only raw HTML
 * nodes use dangerouslySetInnerHTML (content is trusted local files).
 */
export type MarkdownComponents = Partial<Record<string, ElementType>>;

export type MarkdownOptions = {
  /** resolves relative asset paths (e.g. `./hello-world/cover.svg`) */
  resolveAsset?: (rel: string) => string | null;
  components?: MarkdownComponents;
};

export function markdownToReact(src: string, opts: MarkdownOptions = {}): ReactNode {
  return renderBlocks(parseMarkdown(src), opts);
}

function renderBlocks(blocks: Block[], opts: MarkdownOptions): ReactNode {
  return blocks.map((block, i) => (
    <Fragment key={i}>{renderBlock(block, opts)}</Fragment>
  ));
}

function renderBlock(block: Block, opts: MarkdownOptions): ReactNode {
  const C = opts.components ?? {};
  switch (block.type) {
    case 'heading': {
      const Tag = (C[`h${block.level}`] ?? `h${block.level}`) as ElementType;
      const id = slugify(plainText(block.children));
      return (
        <Tag id={id}>{renderInline(block.children, opts)}</Tag>
      );
    }
    case 'paragraph': {
      const P = C.p ?? 'p';
      return <P>{renderInline(block.children, opts)}</P>;
    }
    case 'code': {
      const Pre = C.pre ?? 'pre';
      const Code = C.code ?? 'code';
      return (
        <Pre>
          <Code className={block.lang ? `lang-${block.lang}` : undefined}>{block.text}</Code>
        </Pre>
      );
    }
    case 'blockquote': {
      const Bq = C.blockquote ?? 'blockquote';
      return <Bq>{renderBlocks(block.children, opts)}</Bq>;
    }
    case 'list': {
      const Tag = (block.ordered ? C.ol ?? 'ol' : C.ul ?? 'ul') as ElementType;
      const Li = C.li ?? 'li';
      return (
        <Tag start={block.ordered ? block.start : undefined}>
          {block.items.map((item, i) => (
            <Li key={i}>{renderBlocks(item.children, opts)}</Li>
          ))}
        </Tag>
      );
    }
    case 'hr': {
      const Hr = C.hr ?? 'hr';
      return <Hr />;
    }
    case 'table': {
      const Table = C.table ?? 'table';
      const Thead = C.thead ?? 'thead';
      const Tbody = C.tbody ?? 'tbody';
      const Tr = C.tr ?? 'tr';
      const Th = C.th ?? 'th';
      const Td = C.td ?? 'td';
      return (
        <div className="table-wrap">
          <Table>
            <Thead>
              <Tr>
                {block.head.map((cell, i) => (
                  <Th key={i}>{renderInline(cell, opts)}</Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {block.rows.map((row, r) => (
                <Tr key={r}>
                  {row.map((cell, i) => (
                    <Td key={i}>{renderInline(cell, opts)}</Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      );
    }
    case 'html': {
      const Div = C.html ?? 'div';
      return <Div className="article-html" dangerouslySetInnerHTML={{ __html: block.html }} />;
    }
  }
}

function renderInline(nodes: Inline[], opts: MarkdownOptions): ReactNode {
  const C = opts.components ?? {};
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return node.text;
      case 'em':
        return <em key={i}>{renderInline(node.children, opts)}</em>;
      case 'strong':
        return <strong key={i}>{renderInline(node.children, opts)}</strong>;
      case 'del':
        return <del key={i}>{renderInline(node.children, opts)}</del>;
      case 'code':
        return <code key={i}>{node.text}</code>;
      case 'link': {
        const isAnchor = node.href.startsWith('#');
        const A = C.a ?? 'a';
        return (
          <A
            key={i}
            href={node.href}
            title={node.title}
            {...(isAnchor ? {} : { target: '_blank', rel: 'noreferrer' })}
          >
            {renderInline(node.children, opts)}
          </A>
        );
      }
      case 'image': {
        const src = resolveSrc(node.src, opts);
        const Img = C.img ?? ArticleImage;
        return (
          <Img
            key={i}
            src={src}
            alt={node.alt}
            title={node.title}
            caption={node.alt}
          />
        );
      }
      case 'html': {
        const Span = C.html ?? 'span';
        return <Span key={i} dangerouslySetInnerHTML={{ __html: node.html }} />;
      }
    }
  });
}

function resolveSrc(src: string, opts: MarkdownOptions): string | null {
  if (
    /^(https?:)?\/\//.test(src) ||
    src.startsWith('data:') ||
    src.startsWith('/') ||
    src.startsWith('#')
  ) {
    return src;
  }
  return opts.resolveAsset ? opts.resolveAsset(src) : src;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

function plainText(nodes: Inline[]): string {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'code':
        out += node.text;
        break;
      case 'html':
        break;
      case 'image':
        out += node.alt;
        break;
      case 'link':
      case 'em':
      case 'strong':
      case 'del':
        out += plainText(node.children);
        break;
    }
  }
  return out;
}
