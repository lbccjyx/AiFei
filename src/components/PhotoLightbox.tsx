import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Photo } from '../lib/photos';
import './PhotoLightbox.css';

export type PhotoLightboxProps = {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/**
 * 照片灯箱：点击大图，Esc 关闭，左右方向键翻页，点背景也能关。
 * 打开时锁住 body 滚动，关闭后恢复。
 *
 * 加载上用「缩略图撑框 + 大图淡入」：720px 的缩略图多半已经在照片墙上缓存过，
 * 先把它铺上去定住尺寸，1600px 的大图到了再原位置淡入 —— 翻页时不会跳、
 * 也不会先白一下。
 */
export default function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: PhotoLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const photo = photos[index];
  const total = photos.length;
  const src = photo ? (photo.full ?? photo.src) : '';
  const thumbSrc = photo ? (photo.thumb ?? photo.src) : '';

  // 记住「哪一张已经加载完」：翻页时 src 一变 loaded 自动回到 false，
  // 省掉一个专门用来重置的 effect
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = src !== '' && loadedSrc === src;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft' && total > 1) {
        event.preventDefault();
        onIndexChange((index - 1 + total) % total);
      } else if (event.key === 'ArrowRight' && total > 1) {
        event.preventDefault();
        onIndexChange((index + 1) % total);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, total, onClose, onIndexChange]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!photo) return null;

  return createPortal(
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className="lb__close"
        onClick={onClose}
        aria-label="关闭"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
        </svg>
      </button>

      <figure className="lb__stage" onClick={(event) => event.stopPropagation()}>
        <div
          className={`lb__frame${loaded ? ' is-loaded' : ''}`}
          style={photo.blur ? { backgroundImage: `url("${photo.blur}")` } : undefined}
        >
          <img className="lb__thumb" src={thumbSrc} alt={photo.caption} decoding="async" />
          <img
            key={src}
            className="lb__img"
            src={src}
            alt=""
            aria-hidden="true"
            decoding="async"
            onLoad={() => setLoadedSrc(src)}
          />
        </div>
        <figcaption className="lb__cap">
          <span className="lb__idx">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <span className="lb__text">{photo.caption}</span>
        </figcaption>
      </figure>

      {total > 1 ? (
        <>
          <button
            type="button"
            className="lb__nav lb__nav--prev"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((index - 1 + total) % total);
            }}
            aria-label="上一张"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M12.5 4L6.5 10l6 6" />
            </svg>
          </button>
          <button
            type="button"
            className="lb__nav lb__nav--next"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((index + 1) % total);
            }}
            aria-label="下一张"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M7.5 4l6 6-6 6" />
            </svg>
          </button>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
