import { useCallback, useEffect, useMemo, useState } from 'react';
import { todos as allTodos, type TodoCategory } from '../data/todos';

/**
 * 待办清单的勾选状态：只存在浏览器本地。
 *
 * 没有后端，所以勾选不会跨设备同步 —— 换浏览器 / 清缓存就会回到未勾选。
 * 想换成「两个人都能看到」的状态，最省事的做法是把清单搬到 notion / 飞书
 * 文档，这里只做展示。
 */
const STORAGE_KEY = 'aifei:todos:v1';

type DoneMap = Record<string, boolean>;

function readDone(): DoneMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const map: DoneMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === true) map[id] = true;
    }
    return map;
  } catch {
    return {};
  }
}

export type TodoFilter = '全部' | TodoCategory;

export function useTodos() {
  const [done, setDone] = useState<DoneMap>(readDone);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch {
      /* 隐私模式 / 存储被禁用：勾选只在本次会话有效 */
    }
  }, [done]);

  const toggle = useCallback((id: string) => {
    setDone((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const reset = useCallback(() => setDone({}), []);

  const doneCount = useMemo(
    () => allTodos.reduce((acc, todo) => acc + (done[todo.id] ? 1 : 0), 0),
    [done],
  );

  return {
    todos: allTodos,
    done,
    toggle,
    reset,
    doneCount,
    total: allTodos.length,
  };
}
