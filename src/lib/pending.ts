/**
 * 「刚提交、但还没被构建进站点」的内容。
 *
 * 编辑页把内容提交到 GitHub 后，Actions 要重新构建一次（约一分钟）才会
 * 出现在真正的内容里。这段真空期把新条目记在 localStorage，页面上先显示
 * 出来并打上「待构建」标记 —— 等构建追上（同一条内容出现在构建结果里）
 * 就自动隐藏，不会重复。
 */
import { useSyncExternalStore } from 'react';
import type { TimelineItem } from '../data/timeline';
import type { Todo } from '../data/todos';
import type { Photo } from './photos';

export type PendingTimeline = { uid: string; item: TimelineItem };
export type PendingPhoto = {
  uid: string;
  /** 文件名（不含扩展名），和构建后的一致 */
  name: string;
  caption: string;
  /** raw.githubusercontent 上的地址，提交成功后立即可用 */
  url: string;
};
export type PendingTodo = { uid: string; todo: Todo };

export type PendingState = {
  timeline: PendingTimeline[];
  photos: PendingPhoto[];
  todos: PendingTodo[];
};

const STORAGE_KEY = 'aifei:pending:v1';
const EMPTY: PendingState = { timeline: [], photos: [], todos: [] };

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function read(): PendingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PendingState>;
    return {
      timeline: isArray(parsed.timeline) ? (parsed.timeline as PendingTimeline[]) : [],
      photos: isArray(parsed.photos) ? (parsed.photos as PendingPhoto[]) : [],
      todos: isArray(parsed.todos) ? (parsed.todos as PendingTodo[]) : [],
    };
  } catch {
    return EMPTY;
  }
}

let state: PendingState = read();
const listeners = new Set<() => void>();

function commit(next: PendingState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 存不下就只在本页有效 */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PendingState {
  return state;
}

export function usePending(): PendingState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addPendingTimeline(item: TimelineItem): void {
  commit({ ...state, timeline: [...state.timeline, { uid: uid(), item }] });
}

export function addPendingPhoto(photo: Omit<PendingPhoto, 'uid'>): void {
  commit({ ...state, photos: [...state.photos, { ...photo, uid: uid() }] });
}

export function addPendingTodo(todo: Todo): void {
  commit({ ...state, todos: [...state.todos, { uid: uid(), todo }] });
}

/** 构建追上之后，把已经在真内容里的待构建条目清掉 */
export function prunePending(built: {
  timeline: TimelineItem[];
  photos: Photo[];
  todos: Todo[];
}): void {
  const timelineKeys = new Set(built.timeline.map((item) => `${item.date}|${item.title}`));
  const photoNames = new Set(built.photos.map((photo) => photo.name));
  const todoTexts = new Set(built.todos.map((todo) => todo.text));

  const timeline = state.timeline.filter((entry) => !timelineKeys.has(`${entry.item.date}|${entry.item.title}`));
  const photos = state.photos.filter((entry) => !photoNames.has(entry.name));
  const todos = state.todos.filter((entry) => !todoTexts.has(entry.todo.text));

  if (
    timeline.length === state.timeline.length &&
    photos.length === state.photos.length &&
    todos.length === state.todos.length
  ) {
    return;
  }
  commit({ timeline, photos, todos });
}

/** 在「编辑」页里删掉/改掉某条时，把它对应的待构建标记也一起清掉 */
export function dropPendingTimeline(match: (item: TimelineItem) => boolean): void {
  const timeline = state.timeline.filter((entry) => !match(entry.item));
  if (timeline.length === state.timeline.length) return;
  commit({ ...state, timeline });
}

export type TimelineEntry = { item: TimelineItem; pending: boolean };
export type PhotoEntry = Photo & { pending: boolean };
export type TodoEntry = { todo: Todo; pending: boolean };

const byDate = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function mergeTimeline(built: TimelineItem[], pending: PendingTimeline[]): TimelineEntry[] {
  const known = new Set(built.map((item) => `${item.date}|${item.title}`));
  return [
    ...built.map((item) => ({ item, pending: false })),
    ...pending
      .filter((entry) => !known.has(`${entry.item.date}|${entry.item.title}`))
      .map((entry) => ({ item: entry.item, pending: true })),
  ].sort((a, b) => byDate(a.item.date, b.item.date));
}

export function mergePhotos(built: Photo[], pending: PendingPhoto[]): PhotoEntry[] {
  const known = new Set(built.map((photo) => photo.name));
  return [
    ...built.map((photo) => ({ ...photo, pending: false })),
    ...pending
      .filter((entry) => !known.has(entry.name))
      .map((entry) => ({ src: entry.url, name: entry.name, caption: entry.caption, pending: true })),
  ];
}

export function mergeTodos(built: Todo[], pending: PendingTodo[]): TodoEntry[] {
  const known = new Set(built.map((todo) => todo.text));
  return [
    ...built.map((todo) => ({ todo, pending: false })),
    ...pending
      .filter((entry) => !known.has(entry.todo.text))
      .map((entry) => ({ todo: entry.todo, pending: true })),
  ];
}
