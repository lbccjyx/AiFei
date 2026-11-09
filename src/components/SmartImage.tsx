import { useEffect, useRef, useState } from 'react';
import type { Photo } from '../lib/photos';
import './SmartImage.css';

export type SmartImageProps = {
  photo: Photo;
  alt?: string;
  className?: string;
  /** 单张大图场景（灯箱、抽屉）：一上来就要清楚的，不等空闲 */
  eager?: boolean;
  /** 缩略图加载失败（比如「待构建」的照片还没发布完） */
  onError?: () => void;
  /** 配合 srcSet 用：这个位置大概多宽（默认整屏宽） */
  sizes?: string;
};

/**
 * 三段式加载：
 *
 *   1. blur  24px 的模糊占位，base64 内联在 JS 里 —— 0 请求，先把画面撑住
 *   2. thumb 缩略图（420 / 720 两档，浏览器按格子宽度自己挑）
 *   3. full  1600px 大图，等浏览器闲下来再换；如果后台预取已经把它拿下来了，
 *            这一次是直接命中缓存，几乎立刻就好
 *
 * 三层是叠在一起的 <img>，谁先到谁先显示，靠 opacity 交叉淡入，不会闪白。
 */
export default function SmartImage({
  photo,
  alt,
  className,
  eager = false,
  onError,
  sizes = '100vw',
}: SmartImageProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [thumbReady, setThumbReady] = useState(false);
  const [wantFull, setWantFull] = useState(eager);
  const [fullReady, setFullReady] = useState(false);
  const [broken, setBroken] = useState(false);

  const thumbSrc = photo.thumb ?? photo.src;
  const fullSrc = photo.full ?? photo.src;
  // 手机格子只有 180px 宽，让浏览器自己去拿 420 那档就够，不用下 720
  const srcSet =
    photo.thumb && photo.thumbSm ? `${photo.thumbSm} 420w, ${photo.thumb} 720w` : undefined;

  // 一个实例只负责一张图：换图时调用方用 key 重新挂载（照片墙就是按 src 做 key 的），
  // 省掉一堆「props 变了要重置内部状态」的麻烦
  useEffect(() => {
    if (eager || wantFull || !thumbReady) return;
    const host = hostRef.current;
    if (!host) return;

    let timer: number | undefined;
    let idle: number | undefined;

    const schedule = () => {
      // 先进视野、再等 0.7 秒、最后等浏览器空闲 —— 让缩略图和滚动先走完
      timer = window.setTimeout(() => {
        const run = () => setWantFull(true);
        if (typeof window.requestIdleCallback === 'function') {
          idle = window.requestIdleCallback(run, { timeout: 2500 });
        } else {
          idle = window.setTimeout(run, 900);
        }
      }, 700);
    };

    // 根边距 0：只有真的出现在屏幕上才升级，别为屏幕外的图白花流量
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        schedule();
      },
      { rootMargin: '0px' },
    );
    observer.observe(host);

    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      if (idle === undefined) return;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [eager, wantFull, thumbReady, photo.src]);

  const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : undefined;

  return (
    <span
      ref={hostRef}
      className={className ? `si ${className}` : 'si'}
      style={ratio ? { aspectRatio: ratio } : undefined}
      data-thumb={thumbReady ? '1' : '0'}
      data-full={fullReady ? '1' : '0'}
      data-broken={broken ? '1' : '0'}
    >
      {photo.blur ? <img className="si__blur" src={photo.blur} alt="" aria-hidden="true" /> : null}

      <img
        className="si__img"
        src={thumbSrc}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt ?? photo.caption}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setThumbReady(true)}
        onError={() => {
          setBroken(true);
          onError?.();
        }}
      />

      {wantFull && fullSrc !== thumbSrc ? (
        <img
          className="si__full"
          src={fullSrc}
          alt=""
          aria-hidden="true"
          decoding="async"
          onLoad={() => setFullReady(true)}
        />
      ) : null}
    </span>
  );
}
