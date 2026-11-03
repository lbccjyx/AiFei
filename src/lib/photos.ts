import { photoCaptions } from '../data/photos';

/**
 * 照片清单。图片放在 `content/photos/` 下，构建时由 Vite 收集并给出带
 * hash 的静态地址 —— 不需要在代码里登记，丢进去就有了。
 */

const files = import.meta.glob(
  '/content/photos/**/*.{jpg,jpeg,png,webp,avif,gif,svg}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

export type Photo = {
  /** 构建后的图片地址 */
  src: string;
  /** 文件名（不含扩展名），例如 '01-初见' */
  name: string;
  /** 灯箱 / 悬浮时显示的说明 */
  caption: string;
};

/** 按「人能读的顺序」排序：02 排在 10 前面 */
const byName = (a: string, b: string) =>
  a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });

function captionOf(name: string): string {
  const stripped = name.replace(/^\d+[\s\-_.]*/, '');
  return (
    photoCaptions[name] ??
    photoCaptions[stripped] ??
    (stripped || name).replace(/[-_]+/g, ' ')
  );
}

export const photos: Photo[] = Object.entries(files)
  .map(([path, src]) => {
    const name = path
      .split('/')
      .pop()!
      .replace(/\.[^.]+$/, '');
    return { src, name, caption: captionOf(name) };
  })
  .sort((a, b) => byName(a.name, b.name));

/** 按文件名找一张照片（时间表配图用） */
export function findPhoto(name?: string): Photo | undefined {
  if (!name) return undefined;
  return photos.find((photo) => photo.name === name);
}
