import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TodoCategory } from '../data/todos';
import { todos as allTodos } from '../data/todos';
import { getToken } from './gh';
import { commitTodoChanges, type CommitResult } from './todo-remote';

/**
 * 待办清单的勾选状态。
 *
 * 三层：
 *   1. **仓库里的记录** —— `todos.json` 里写了 `"done": true` 的，所有设备都显示已完成。
 *   2. **未保存的改动** —— 点一下只改本地并标成「未保存」，点「保存改动」才提交。
 *   3. **已提交、等构建** —— 提交成功但 Actions 还没跑完（约 1 分钟），这期间
 *      仍按本地状态显示，构建追上之后两边自然一致。
 *
 * 没有 token 时，保存会失败并提示去「编辑」页填一次；点待办本身仍然只记本机。
 */
const STORAGE_KEY = 'aifei:todos:v1';

/** id → true/false：只存「和文件不一样」的那些，和文件一致就从这里删掉 */
type Overrides = Record<string, boolean>;
/** id → 目标状态：本地改过、还没提交的 */
type Pending = Record<string, boolean>;

function readOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const map: Overrides = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') map[id] = value;
    }
    return map;
  } catch {
    return {};
  }
}

/** 写一条覆盖值；和文件里一致就不必占地方 */
function withOverride(
  prev: Overrides,
  id: string,
  value: boolean,
  recorded: Record<string, boolean>,
): Overrides {
  const next = { ...prev };
  if (Boolean(recorded[id]) === value) delete next[id];
  else next[id] = value;
  return next;
}

export type TodoFilter = '全部' | TodoCategory;

export function useTodos() {
  const [overrides, setOverrides] = useState<Overrides>(readOverrides);
  const [pending, setPending] = useState<Pending>({});
  /** 已经提交、但仓库还没重新构建的那几条（用来判断「和基线比是否又改了」） */
  const [saved, setSaved] = useState<Pending>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      /* 隐私模式 / 存储被禁用：勾选只在本次会话有效 */
    }
  }, [overrides]);

  /** 文件里写的完成状态（todos.json 的 done: true） */
  const recorded = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const todo of allTodos) if (todo.done) map[todo.id] = true;
    return map;
  }, []);

  /** 生效状态：本地临时勾选优先，其次才是文件记录 */
  const done = useMemo(() => {
    const map: Record<string, boolean> = { ...recorded };
    for (const [id, value] of Object.entries(overrides)) {
      if (value) map[id] = true;
      else delete map[id];
    }
    return map;
  }, [overrides, recorded]);

  /** 基线 = 已提交过的值，没有就看仓库里的 */
  const baselineOf = useCallback(
    (id: string) => saved[id] ?? Boolean(recorded[id]),
    [recorded, saved],
  );

  const canCommit = useMemo(() => Boolean(getToken()), []);

  /** 点一下：只改本地，并记进「待保存」 */
  const toggle = useCallback(
    (id: string) => {
      const next = !done[id];
      setOverrides((prev) => withOverride(prev, id, next, recorded));
      setPending((prev) => {
        const map = { ...prev };
        if (next === baselineOf(id)) delete map[id];
        else map[id] = next;
        return map;
      });
    },
    [baselineOf, done, recorded],
  );

  /** 把所有待保存的改动一次性提交 */
  const save = useCallback(async (): Promise<CommitResult> => {
    const changes = Object.entries(pending).map(([id, value]) => ({ id, done: value }));
    if (!changes.length) {
      return { ok: false, reason: 'nothing', message: '没有要保存的改动。' };
    }
    setSaving(true);
    try {
      const result = await commitTodoChanges(changes);
      if (result.ok) {
        setSaved((prev) => ({ ...prev, ...pending }));
        setPending({});
      }
      return result;
    } finally {
      setSaving(false);
    }
  }, [pending]);

  /** 撤销还没保存的改动 */
  const revert = useCallback(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(pending)) {
        if (baselineOf(id)) next[id] = true;
        else delete next[id];
      }
      return next;
    });
    setPending({});
  }, [baselineOf, pending]);

  const doneCount = useMemo(
    () => allTodos.reduce((acc, todo) => acc + (done[todo.id] ? 1 : 0), 0),
    [done],
  );

  const recordedCount = useMemo(
    () => allTodos.reduce((acc, todo) => acc + (recorded[todo.id] ? 1 : 0), 0),
    [recorded],
  );

  const pendingCount = Object.keys(pending).length;

  return {
    todos: allTodos,
    done,
    recorded,
    pending,
    pendingCount,
    toggle,
    save,
    revert,
    saving,
    canCommit,
    doneCount,
    recordedCount,
    total: allTodos.length,
  };
}
