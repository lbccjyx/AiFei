/**
 * 大图的「有空再下」队列。
 *
 * 页面先把缩略图铺满，剩下的大图交给这里在后台一张一张地拿 —— 不跟当前
 * 正在看的图抢带宽，也不在用户翻别的页时继续偷偷下载。
 *
 * 省流量 / 慢网（saveData、2g、3g）时整个功能直接关掉：宁可等用户点开灯箱
 * 时再下那一张，也不要在人家流量里塞 5 MB。
 */

type Connection = { saveData?: boolean; effectiveType?: string };

function connection(): Connection | undefined {
  return (navigator as Navigator & { connection?: Connection }).connection;
}

/** 这个网络环境适合后台预取吗 */
export function canPrefetch(): boolean {
  if (typeof navigator === 'undefined') return false;
  const info = connection();
  if (info?.saveData) return false;
  if (info?.effectiveType && /(^|-)2g$|(^|-)3g$/.test(info.effectiveType)) return false;
  return true;
}

const warmed = new Set<string>();
const inflight = new Map<string, Promise<void>>();

export function isWarm(url: string): boolean {
  return warmed.has(url);
}

/** 拿一张（已经拿过的直接返回）。失败也算「结束」，不重试。 */
export function warmImage(url: string): Promise<void> {
  if (warmed.has(url)) return Promise.resolve();
  const pending = inflight.get(url);
  if (pending) return pending;

  const task = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    const settle = () => {
      warmed.add(url);
      inflight.delete(url);
      resolve();
    };
    img.onload = settle;
    img.onerror = settle;
    img.src = url;
  });
  inflight.set(url, task);
  return task;
}

export type PrefetchOptions = {
  /** 进页面后先等多久再开始（ms） */
  delay?: number;
  /** 每张之间歇多久（ms） */
  gap?: number;
};

/**
 * 排队把一批图慢慢下完。返回一个取消函数：离开页面就停，别在别的页面上偷流量。
 */
export function prefetchAll(urls: string[], options: PrefetchOptions = {}): () => void {
  const queue = [...new Set(urls)].filter((url) => !warmed.has(url) && !inflight.has(url));
  if (!queue.length || !canPrefetch()) return () => {};

  const gap = options.gap ?? 900;
  const delay = options.delay ?? 2200;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const step = () => {
    if (cancelled) return;
    if (document.visibilityState === 'hidden') {
      timer = setTimeout(step, 4000);
      return;
    }
    const next = queue.shift();
    if (!next) return;

    const run = () => {
      if (cancelled) return;
      void warmImage(next).then(() => {
        if (!cancelled) timer = setTimeout(step, gap);
      });
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      timer = setTimeout(run, 300);
    }
  };

  timer = setTimeout(step, delay);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
