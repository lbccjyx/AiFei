import './ArticleImage.css';

export type ArticleImageProps = {
  /** resolved image URL; null renders the missing placeholder */
  src: string | null;
  alt?: string;
  title?: string;
  /** shown as the figure caption; falls back to `alt` */
  caption?: string;
  className?: string;
};

/**
 * Standalone article image: full-width framed image with a fade-in entrance,
 * lazy loading and a caption. Used by the markdown renderer and available
 * anywhere (e.g. Lab demos). A null `src` renders a dashed placeholder.
 */
export default function ArticleImage({
  src,
  alt = '',
  title,
  caption,
  className = '',
}: ArticleImageProps) {
  if (!src) {
    return (
      <span className="article-img-missing" title={alt}>
        {alt || 'missing image'}
      </span>
    );
  }
  return (
    <figure className={['article-figure', className].filter(Boolean).join(' ')}>
      <img src={src} alt={alt} title={title} loading="lazy" />
      {caption || alt ? <figcaption>{caption || alt}</figcaption> : null}
    </figure>
  );
}
