/**
 * 恋爱时间表。
 *
 * 下面全是示例条目 —— 把 date / title / text 换成你们自己的故事，
 * 想加就复制一段，想删就整段删掉。日期用 'YYYY-MM-DD'，时间表会按日期
 * 从早到晚自动排序，不用自己排。
 *
 * 可选字段：
 *   tag        小标签，比如 '初见' '旅行' '日常'
 *   highlight  重要节点，卡片会加重显示
 *   photo      配图：填 content/photos/ 里的文件名（不含扩展名），
 *              比如 '03-第一次看海'
 */
export type TimelineItem = {
  date: string;
  title: string;
  text?: string;
  tag?: string;
  highlight?: boolean;
  photo?: string;
};

export const timeline: TimelineItem[] = [
  {
    date: '2024-05-20',
    title: '第一次见面',
    text: '那天你穿着白色的衣服，我在门口站了很久才敢走进去。后来你说，其实你也在偷偷看我。',
    tag: '初见',
    highlight: true,
  },
  {
    date: '2024-06-01',
    title: '第一顿饭，吃得很慢',
    text: '一顿饭吃了三个小时，菜凉了也没在意，只顾着讲话。',
    tag: '日常',
  },
  {
    date: '2024-07-14',
    title: '第一场电影',
    text: '电影讲了什么我已经忘了，只记得你笑的时候会先看我一眼。',
    tag: '日常',
  },
  {
    date: '2024-08-10',
    title: '第一次一起出门',
    text: '两个人都不会做攻略，走错了很多路，但那几天好像走错路也很好。',
    tag: '旅行',
    photo: '03-一起出门',
  },
  {
    date: '2024-10-01',
    title: '第一次看海',
    text: '你说想看看海。我们在堤坝上坐了很久，风很大，说话要靠喊。',
    tag: '旅行',
    photo: '04-海边',
  },
  {
    date: '2024-12-24',
    title: '第一个平安夜',
    text: '买的苹果太大，两个人分着吃，最后都吃不下晚饭。',
    tag: '日常',
  },
  {
    date: '2025-02-14',
    title: '第一个情人节',
    text: '花不贵，你说好看就够了。',
    tag: '纪念',
  },
  {
    date: '2025-05-20',
    title: '一周年',
    text: '一年里我们吵过三次架，最长的一次四个小时就和好了。',
    tag: '纪念',
    highlight: true,
    photo: '06-一周年',
  },
  {
    date: '2025-09-09',
    title: '搬到同一个城市',
    text: '从此「今天见吗」的答案，基本都变成「见」。',
    tag: '里程碑',
    highlight: true,
  },
  {
    date: '2026-01-01',
    title: '一起跨年',
    text: '倒数的时候你抓着我的手，说新的一年也要这样。',
    tag: '日常',
  },
];
