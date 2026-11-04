/**
 * 恋爱时间表。
 *
 * 数据在 `timeline.json` 里 —— 网页上的「编辑」页提交的就是那个 JSON，
 * 这里只负责类型和导出，所以别把数据写回这个文件。
 *
 * 字段：
 *   date       'YYYY-MM-DD'，时间表自动按它从早到晚排序
 *   title      标题
 *   text       正文，可选
 *   tag        小标签，可选
 *   highlight  重要节点（描边卡片），可选
 *   photo      配图：content/photos 里的文件名（不含扩展名），可选
 */
import raw from './timeline.json';

export type TimelineItem = {
  date: string;
  title: string;
  text?: string;
  tag?: string;
  highlight?: boolean;
  photo?: string;
};

export const timeline = raw as unknown as TimelineItem[];
