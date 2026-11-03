/**
 * 「要办的事情」—— 在一起想做的事清单。
 *
 * 勾选状态保存在浏览器本地（localStorage），不上传、不需要登录，
 * 换设备不会同步（没有后端，这是刻意的取舍）。
 *
 * 字段：id 必须唯一且不要改（改了勾选会丢）；category 会变成筛选标签。
 */
export type TodoCategory = '旅行' | '美食' | '日常' | '未来';

export type Todo = {
  id: string;
  text: string;
  category: TodoCategory;
};

export const todos: Todo[] = [
  { id: 't1', text: '一起去看一次海边的日出', category: '旅行' },
  { id: 't2', text: '在下雪的城市里走一走', category: '旅行' },
  { id: 't3', text: '自驾一次没有目的地的公路旅行', category: '旅行' },
  { id: 't4', text: '拍一组白衬衫的照片', category: '旅行' },

  { id: 't5', text: '一起做一顿年夜饭', category: '美食' },
  { id: 't6', text: '打卡凌晨的路边摊', category: '美食' },
  { id: 't7', text: '学会做对方最爱吃的那道菜', category: '美食' },

  { id: 't8', text: '把合照贴满一面墙', category: '日常' },
  { id: 't9', text: '每周留一次不带手机的散步', category: '日常' },
  { id: 't10', text: '一起养一只猫', category: '日常' },

  { id: 't11', text: '一起攒一笔旅行基金', category: '未来' },
  { id: 't12', text: '每年写一封手写的信，攒着不拆', category: '未来' },
];
