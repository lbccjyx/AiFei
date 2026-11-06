/**
 * 时间轴的「篇章」：按月派生，不新增数据字段。
 * 想改标题就改这里，key 是 YYYY-MM。
 */
export type Chapter = { label: string; line: string };

export const chapters: Record<string, Chapter> = {
  '2026-09': { label: '九月', line: '九月，开始聊天' },
  '2026-10': { label: '十月', line: '十月，去了很远的地方' },
  '2026-11': { label: '十一月', line: '十一月，日常' },
};

export function chapterOf(date: string): Chapter {
  const key = date.slice(0, 7);
  return chapters[key] ?? { label: key, line: key };
}
