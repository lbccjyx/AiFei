import { couple } from '../data/couple';

const DAY_MS = 86_400_000;

/**
 * 解析 'YYYY-MM-DD' 为「当地时间的当天零点」。
 *
 * 不用 `new Date('2024-05-20')`：那会被当成 UTC 解析，在东八区会退回到
 * 前一天，纪念日就会算错一天。
 */
export function parseDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(iso ?? '');
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 纪念日到今天的天数（当天算第 1 天）。日期没填对时返回 0。 */
export function daysTogether(now: Date = new Date()): number {
  const start = parseDay(couple.startDate);
  if (!start) return 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - start.getTime()) / DAY_MS);
  return diff < 0 ? 0 : diff + 1;
}

/** 从纪念日到今天的整年数，用于「第 N 年」 */
export function yearsTogether(now: Date = new Date()): number {
  const start = parseDay(couple.startDate);
  if (!start) return 0;
  let years = now.getFullYear() - start.getFullYear();
  const beforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}
