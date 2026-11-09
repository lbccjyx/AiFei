import { useEffect, useMemo, useRef, useState } from 'react';
import { type TodoCategory } from '../data/todos';
import { useTodos, type TodoFilter } from '../lib/todos';
import { mergeTodos, usePending } from '../lib/pending';
import { isPlainClick, usePageReveal } from '../components/page-reveal-context';
import Reveal from '../components/effects/Reveal';
import './TodoView.css';

/** 筛选顺序：全部 → 四个分类（按分类在清单里第一次出现的顺序） */
const CATEGORIES: TodoCategory[] = ['旅行', '美食', '日常', '未来'];
const FILTERS: TodoFilter[] = ['全部', ...CATEGORIES];

type Status = { kind: 'ok' | 'warn' | 'error'; text: string };

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.4 8.6 6.5 11.6 12.7 4.6" />
    </svg>
  );
}

export default function TodoView() {
  const {
    todos: builtTodos,
    done,
    recorded,
    toggle,
    reset,
    saving,
    canCommit,
    hasOverrides,
    doneCount,
  } = useTodos();
  const pending = usePending();
  const startReveal = usePageReveal();
  const [filter, setFilter] = useState<TodoFilter>('全部');
  const [status, setStatus] = useState<Status | null>(null);
  const statusTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    },
    [],
  );

  const notify = (next: Status, ms = 6500) => {
    setStatus(next);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), ms);
  };

  /** 点一下：先本地生效，提交到仓库后再告诉结果 */
  const onToggle = async (id: string) => {
    const result = await toggle(id);
    if (result.ok) {
      notify({ kind: 'ok', text: '✓ 已提交到仓库，约 1 分钟后生效（所有设备都能看到）。' });
    } else if (result.reason === 'no-token') {
      notify({
        kind: 'warn',
        text: '只记在这台设备。想永久保存：去「编辑」页填一次 token，之后点一下就直接提交到仓库。',
      }, 10000);
    } else {
      notify({ kind: 'error', text: `✗ ${result.message}` }, 9000);
    }
  };

  // 构建进站点的 + 刚提交还没构建的
  const entries = useMemo(
    () => mergeTodos(builtTodos, pending.todos),
    [builtTodos, pending.todos],
  );
  const all = useMemo(() => entries.map((entry) => entry.todo), [entries]);
  const pendingTexts = useMemo(
    () => new Set(entries.filter((entry) => entry.pending).map((entry) => entry.todo.text)),
    [entries],
  );

  const total = all.length;
  const visible = useMemo(
    () => (filter === '全部' ? all : all.filter((todo) => todo.category === filter)),
    [all, filter],
  );

  const doneOfFilter = useMemo(
    () => visible.reduce((acc, todo) => acc + (done[todo.id] ? 1 : 0), 0),
    [visible, done],
  );

  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Bucket list</p>
        <h1 className="page__title">要一起做的事</h1>
        <p className="page__sub">
          {canCommit
            ? `${total} 件小事，勾掉 ${doneCount} 件。点一下就会写进仓库，约 1 分钟后所有设备都同步。`
            : `${total} 件小事，勾掉 ${doneCount} 件。点一下先记在这台设备；去「编辑」页填一次 token，之后点一下就直接写进仓库。`}
        </p>
      </header>

      <div className="todo__meter">
        <div
          className="todo__track"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="已完成"
        >
          <span className="todo__bar" style={{ width: `${percent}%` }} />
        </div>
        <span className="todo__count">
          {String(doneCount).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </div>

      <div className="todo__filters" role="group" aria-label="按分类筛选">
        {FILTERS.map((name) => {
          const countOf =
            name === '全部' ? total : all.filter((todo) => todo.category === name).length;
          return (
            <button
              key={name}
              type="button"
              className="chip"
              data-active={filter === name}
              aria-pressed={filter === name}
              onClick={() => setFilter(name)}
            >
              {name}
              <span className="chip__count">{countOf}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="todo__empty">这个分类还是空的。</p>
      ) : (
        <ul className="todo__list">
          {visible.map((todo, index) => {
            const isDone = Boolean(done[todo.id]);
            return (
              <li key={todo.id}>
                <Reveal delay={Math.min(index, 6) * 40} duration={380}>
                  <button
                    type="button"
                    className="todo__row"
                    data-done={isDone}
                    data-saving={Boolean(saving[todo.id])}
                    aria-pressed={isDone}
                    aria-busy={Boolean(saving[todo.id])}
                    onClick={() => void onToggle(todo.id)}
                  >
                    <span className="todo__box" aria-hidden="true">
                      {isDone ? <CheckMark /> : null}
                    </span>
                    <span className="todo__text">{todo.text}</span>
                    {recorded[todo.id] && isDone ? (
                      <span className="todo__record">
                        {todo.doneDate ? `已记录 · ${todo.doneDate}` : '已记录'}
                      </span>
                    ) : null}
                    {pendingTexts.has(todo.text) ? (
                      <span className="todo__pending">待构建</span>
                    ) : null}
                    {saving[todo.id] ? <span className="todo__saving">提交中…</span> : null}
                    <span className="todo__cat">{todo.category}</span>
                  </button>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}

      {status ? <p className={`todo__status is-${status.kind}`}>{status.text}</p> : null}

      <div className="todo__foot">
        <span className="todo__foot-note">
          {filter === '全部' ? '全部清单' : `${filter}清单`}里已完成 {doneOfFilter} 件
        </span>
        <div className="todo__foot-actions">
          <button
            type="button"
            className="todo__add"
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              startReveal('admin', event.clientX, event.clientY);
            }}
          >
            ＋ 添加一件
          </button>
          {!canCommit ? (
            <button
              type="button"
              className="todo__add"
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                startReveal('admin', event.clientX, event.clientY);
              }}
            >
              填 token（永久记录）
            </button>
          ) : null}
          {hasOverrides ? (
            <button type="button" className="todo__reset" onClick={reset}>
              清除本地标记
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
