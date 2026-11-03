/** '2024-05-20' → '2024 年 5 月 20 日'（无法解析时原样返回） */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(iso);
  if (!m) return iso;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return iso;
  return `${m[1]} 年 ${month} 月 ${day} 日`;
}

/** '2024-05-20' → '2024.05.20'（时间表的日期栏） */
export function formatDotDate(iso: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(iso);
  if (!m) return iso;
  const pad = (n: string) => n.padStart(2, '0');
  return `${m[1]}.${pad(m[2])}.${pad(m[3])}`;
}

/** '2024-05-20' → '2024' */
export function formatYear(iso: string): string {
  const m = /^(\d{4})/.exec(iso);
  return m ? m[1] : iso;
}
