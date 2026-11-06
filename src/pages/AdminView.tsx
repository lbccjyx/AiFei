import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CATEGORIES, todos as builtTodos, type Todo, type TodoCategory } from '../data/todos';
import { timeline as builtTimeline, type TimelineItem } from '../data/timeline';
import { photos } from '../lib/photos';
import { photoCaptions } from '../data/photos';
import {
  REPO,
  getToken,
  saveToken,
  getViewer,
  readJsonFile,
  writeJsonFile,
  putFile,
  rawUrl,
  GhError,
} from '../lib/gh';
import {
  addPendingPhoto,
  addPendingTimeline,
  addPendingTodo,
  dropPendingTimeline,
  usePending,
} from '../lib/pending';
import Reveal from '../components/effects/Reveal';
import './AdminView.css';

const TIMELINE_FILE = 'src/data/timeline.json';
const TODOS_FILE = 'src/data/todos.json';
const CAPTIONS_FILE = 'src/data/photo-captions.json';
const ACTIONS_URL = `https://github.com/${REPO.owner}/${REPO.repo}/actions`;

function messageOf(error: unknown): string {
  if (error instanceof GhError) return error.message;
  if (error instanceof Error) return error.message;
  return '未知错误';
}

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

/** 文件名里只留中英文数字和连字符，避免路径出问题 */
function safeName(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|#%\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return cleaned || 'photo';
}

/** 压到最长边 1800px 的 JPEG；GIF/SVG 原样上传 */
async function compressImage(file: File): Promise<{ bytes: Uint8Array; ext: string }> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    const ext = file.type === 'image/svg+xml' ? 'svg' : 'gif';
    return { bytes: new Uint8Array(await file.arrayBuffer()), ext };
  }

  const bitmap = await createImageBitmap(file);
  const max = 1800;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('这个浏览器不支持 canvas，换一个试试');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.86),
  );
  if (!blob) throw new Error('图片压缩失败，换一张试试');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'jpg' };
}

type QueueItem = {
  uid: string;
  file: File;
  caption: string;
  preview: string;
};

export default function AdminView() {
  const pending = usePending();

  /** 时间表配图可选：构建进站点的 + 刚上传还没构建的 */
  const photoNames = useMemo(
    () => [...photos.map((photo) => photo.name), ...pending.photos.map((photo) => photo.name)],
    [pending.photos],
  );

  /* ---------- 连接 ---------- */
  const [tokenInput, setTokenInput] = useState(getToken());
  const [conn, setConn] = useState<{ state: 'idle' | 'busy' | 'ok' | 'error'; text: string }>(() =>
    getToken()
      ? { state: 'busy', text: '正在验证已保存的 token…' }
      : { state: 'idle', text: '' },
  );

  const verify = useCallback(async (token: string) => {
    if (!token) {
      setConn({ state: 'error', text: '还没有填 token。' });
      return;
    }
    setConn({ state: 'busy', text: '正在验证…' });
    saveToken(token);
    try {
      const viewer = await getViewer();
      setConn({ state: 'ok', text: `已连接：@${viewer.login}` });
    } catch (error) {
      setConn({ state: 'error', text: messageOf(error) });
    }
  }, []);

  // 打开页面时自动校验一次已保存的 token（setState 只发生在异步回调里）
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    void (async () => {
      try {
        const viewer = await getViewer();
        if (alive) setConn({ state: 'ok', text: `已连接：@${viewer.login}` });
      } catch (error) {
        if (alive) setConn({ state: 'error', text: messageOf(error) });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const connected = conn.state === 'ok';

  /* ---------- 照片 ---------- */
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const nextNumber = useMemo(() => {
    const numbers = [...photos.map((photo) => photo.name), ...pending.photos.map((photo) => photo.name)]
      .map((name) => Number(/^(\d+)/.exec(name)?.[1] ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    return (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  }, [pending.photos]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const items: QueueItem[] = [...files]
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        uid: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        caption: stripExtension(file.name),
        preview: URL.createObjectURL(file),
      }));
    setQueue((prev) => [...prev, ...items]);
  };

  const uploadAll = async () => {
    if (!queue.length || uploading) return;
    setUploading(true);
    const uploaded: { name: string; caption: string }[] = [];
    try {
      let number = nextNumber;
      for (const [index, item] of queue.entries()) {
        setUploadMsg(`正在上传 ${index + 1}/${queue.length}：${item.file.name}`);
        const { bytes, ext } = await compressImage(item.file);
        const base = safeName(item.caption || stripExtension(item.file.name));
        const name = `${String(number++).padStart(2, '0')}-${base}`;
        const path = `content/photos/${name}.${ext}`;
        await putFile({ path, bytes, message: `上传照片：${name}.${ext}` });
        addPendingPhoto({
          name,
          caption: item.caption || base,
          url: rawUrl(path),
        });
        uploaded.push({ name, caption: item.caption || base });
      }

      // 说明文字合并成一次提交
      const captionsFile = await readJsonFile<Record<string, string>>(CAPTIONS_FILE);
      const captions = { ...(captionsFile?.data ?? photoCaptions) };
      for (const entry of uploaded) captions[entry.name] = entry.caption;
      await writeJsonFile(
        CAPTIONS_FILE,
        captions,
        `照片说明：${uploaded.map((entry) => entry.name).join('、')}`,
        captionsFile?.sha,
      );

      setQueue([]);
      setUploadMsg(
        `✓ 已提交 ${uploaded.length} 张照片。点这里看构建进度 → ${ACTIONS_URL}`,
      );
    } catch (error) {
      setUploadMsg(`✗ ${messageOf(error)}`);
    } finally {
      setUploading(false);
    }
  };

  /* ---------- 时间表 ---------- */
  const [form, setForm] = useState({
    date: today(),
    title: '',
    text: '',
    tag: '',
    highlight: false,
    photo: '',
  });
  const [tlMsg, setTlMsg] = useState('');
  const [remote, setRemote] = useState<{ list: TimelineItem[]; sha: string } | null>(null);
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** 正在编辑的条目在 remote.list 里的下标；null = 新增模式 */
  const [editing, setEditing] = useState<number | null>(null);
  /** 正在二次确认删除的那条 */
  const [confirming, setConfirming] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // 连上之后读一次仓库里的时间表 —— 改 / 删都需要当前 sha，不能只靠打进包里的副本
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    void (async () => {
      try {
        const file = await readJsonFile<TimelineItem[]>(TIMELINE_FILE);
        if (!alive) return;
        setRemote(file ? { list: file.data, sha: file.sha } : { list: builtTimeline, sha: '' });
        setRemoteState('ready');
      } catch (error) {
        if (!alive) return;
        setRemoteState('error');
        setTlMsg(`✗ 读取时间表失败：${messageOf(error)}`);
      }
    })();
    return () => {
      alive = false;
    };
  }, [connected]);

  const reloadTimeline = async () => {
    setRemoteState('loading');
    try {
      const file = await readJsonFile<TimelineItem[]>(TIMELINE_FILE);
      setRemote(file ? { list: file.data, sha: file.sha } : { list: builtTimeline, sha: '' });
      setRemoteState('ready');
      setTlMsg('✓ 已重新读取仓库里的时间表。');
    } catch (error) {
      setRemoteState('error');
      setTlMsg(`✗ 读取失败：${messageOf(error)}`);
    }
  };

  const remoteList = useMemo(() => remote?.list ?? [], [remote]);

  /** 展示按日期排，同时记住它在 JSON 数组里的下标，改/删才对得准 */
  const timelineRows = useMemo(
    () =>
      remoteList
        .map((item, index) => ({ item, index }))
        .sort((a, b) =>
          a.item.date < b.item.date ? -1 : a.item.date > b.item.date ? 1 : 0,
        ),
    [remoteList],
  );

  const resetForm = () => {
    setEditing(null);
    setForm({ date: today(), title: '', text: '', tag: '', highlight: false, photo: '' });
    setTlMsg('');
  };

  const startEdit = (index: number) => {
    const item = remote?.list[index];
    if (!item) return;
    setEditing(index);
    setConfirming(null);
    setTlMsg('');
    setForm({
      date: item.date,
      title: item.title,
      text: item.text ?? '',
      tag: item.tag ?? '',
      highlight: Boolean(item.highlight),
      photo: item.photo ?? '',
    });
  };

  /** 提交后 GitHub 会返回新 sha；万一没拿到就重读一次，避免下次写入 409 */
  const freshSha = async (): Promise<string> => {
    const file = await readJsonFile<TimelineItem[]>(TIMELINE_FILE);
    return file?.sha ?? '';
  };

  const saveTimeline = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.date || !form.title.trim()) {
      setTlMsg('日期和标题是必填的。');
      return;
    }
    if (!remote) {
      setTlMsg('还没读到仓库里的时间表，先点「重新读取」。');
      return;
    }
    const item: TimelineItem = {
      date: form.date,
      title: form.title.trim(),
      ...(form.text.trim() ? { text: form.text.trim() } : {}),
      ...(form.tag.trim() ? { tag: form.tag.trim() } : {}),
      ...(form.highlight ? { highlight: true } : {}),
      ...(form.photo ? { photo: form.photo } : {}),
    };
    const isEdit = editing !== null;
    const next = isEdit
      ? remote.list.map((entry, index) => (index === editing ? item : entry))
      : [...remote.list, item];

    setSaving(true);
    setTlMsg(isEdit ? '保存中…' : '提交中…');
    try {
      const sha = await writeJsonFile(
        TIMELINE_FILE,
        next,
        isEdit
          ? `修改时间点：${item.date} ${item.title}`
          : `时间表：${item.date} ${item.title}`,
        remote.sha || undefined,
      );
      setRemote({ list: next, sha: sha || (await freshSha()) });
      if (!isEdit) addPendingTimeline(item);
      if (isEdit) {
        // 改的是哪一条，就把那条旧的待构建标记清掉
        const before = remote.list[editing ?? -1];
        if (before) {
          dropPendingTimeline(
            (entry) => entry.date === before.date && entry.title === before.title,
          );
        }
      }
      setEditing(null);
      setForm({ date: today(), title: '', text: '', tag: '', highlight: false, photo: '' });
      setTlMsg(
        isEdit
          ? '✓ 已保存修改，约 1 分钟后时间表上生效。'
          : '✓ 已添加。时间表上已经能看到（标着「待构建」），约 1 分钟后正式上线。',
      );
    } catch (error) {
      setTlMsg(`✗ ${messageOf(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const removeTimeline = async (index: number) => {
    const item = remote?.list[index];
    if (!remote || !item) return;
    setSaving(true);
    setTlMsg('删除中…');
    try {
      const next = remote.list.filter((_, i) => i !== index);
      const sha = await writeJsonFile(
        TIMELINE_FILE,
        next,
        `删除时间点：${item.date} ${item.title}`,
        remote.sha || undefined,
      );
      setRemote({ list: next, sha: sha || (await freshSha()) });
      setConfirming(null);
      // 删掉的那条如果还挂着「待构建」，一起清掉
      dropPendingTimeline((entry) => entry.date === item.date && entry.title === item.title);
      // 下标会整体前移，先退出编辑态，免得编辑到别人的条目上
      resetForm();
      setTlMsg(`✓ 已删除「${item.title}」，约 1 分钟后从时间表消失。`);
    } catch (error) {
      setTlMsg(`✗ ${messageOf(error)}`);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 待办 ---------- */
  const [todoForm, setTodoForm] = useState<{ text: string; category: TodoCategory }>({
    text: '',
    category: '旅行',
  });
  const [todoMsg, setTodoMsg] = useState('');

  const submitTodo = async (event: FormEvent) => {
    event.preventDefault();
    if (!todoForm.text.trim()) {
      setTodoMsg('先写点什么。');
      return;
    }
    setTodoMsg('提交中…');
    try {
      const file = await readJsonFile<Todo[]>(TODOS_FILE);
      const list = file?.data ?? builtTodos;
      const todo: Todo = {
        id: `t${Date.now().toString(36)}`,
        text: todoForm.text.trim(),
        category: todoForm.category,
      };
      await writeJsonFile(TODOS_FILE, [...list, todo], `待办：${todo.text}`, file?.sha);
      addPendingTodo(todo);
      setTodoForm({ ...todoForm, text: '' });
      setTodoMsg('✓ 已提交，约 1 分钟后出现在清单里。');
    } catch (error) {
      setTodoMsg(`✗ ${messageOf(error)}`);
    }
  };

  const queued =
    pending.timeline.length + pending.photos.length + pending.todos.length;

  return (
    <div className="page admin">
      <header className="page__head">
        <p className="eyebrow">Admin</p>
        <h1 className="page__title">编辑</h1>
        <p className="page__sub">
          这里的改动会直接提交到 GitHub 仓库（{REPO.owner}/{REPO.repo}），
          Actions 重新构建后生效，大约 1 分钟。token 只存在这台设备的浏览器里。
        </p>
      </header>

      <section className="admin-card">
        <h2 className="admin-card__title">
          <span className="admin-card__no">01</span> 连接 GitHub
        </h2>

        {connected ? (
          <p className="admin-ok">
            {conn.text}
            <button
              type="button"
              className="admin-link"
              onClick={() => {
                saveToken('');
                setTokenInput('');
                setConn({ state: 'idle', text: '' });
              }}
            >
              断开
            </button>
          </p>
        ) : (
          <>
            <p className="admin-hint">
              纯静态站没有服务器能接收上传，所以写操作走 GitHub API，需要一个只有这个仓库
              Contents 读写权限的 token。填一次就好。
            </p>
            <div className="admin-row">
              <input
                className="admin-input"
                type="password"
                placeholder="github_pat_…"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="admin-btn"
                onClick={() => void verify(tokenInput.trim())}
                disabled={conn.state === 'busy'}
              >
                {conn.state === 'busy' ? '验证中…' : '保存并验证'}
              </button>
            </div>
            {conn.state === 'error' ? <p className="admin-error">{conn.text}</p> : null}
            <details className="admin-help">
              <summary>怎么生成这个 token（约 2 分钟）</summary>
              <ol>
                <li>
                  打开{' '}
                  <a
                    className="admin-a"
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    github.com/settings/personal-access-tokens/new
                  </a>
                </li>
                <li>Token name 随便写，比如 aifei-admin；Expiration 选 90 天或更长</li>
                <li>
                  Repository access 选 <b>Only select repositories</b> → 勾 <b>AiFei</b>
                </li>
                <li>
                  Permissions → Repository permissions → <b>Contents</b> 选{' '}
                  <b>Read and write</b>（其他都不用给）
                </li>
                <li>Generate token → 复制以 github_pat_ 开头的那串，粘到上面</li>
              </ol>
              <p className="admin-hint">
                坏了/泄露了就回同一个页面 Revoke 再生成一个。别在别人的电脑上填。
              </p>
            </details>
          </>
        )}
      </section>

      <section className="admin-card">
        <h2 className="admin-card__title">
          <span className="admin-card__no">02</span> 上传照片
        </h2>
        {connected ? (
          <>
            <label
              className="admin-drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <span>点这里选照片，或者直接把图片拖进来</span>
              <span className="admin-drop-hint">会自动压到 1800px 宽的 JPG</span>
            </label>

            {queue.length > 0 ? (
              <ul className="admin-queue">
                {queue.map((item, index) => (
                  <li className="admin-queue__item" key={item.uid}>
                    <img className="admin-queue__img" src={item.preview} alt="" />
                    <div className="admin-queue__body">
                      <input
                        className="admin-input"
                        value={item.caption}
                        placeholder="这张照片写点什么"
                        onChange={(event) =>
                          setQueue((prev) =>
                            prev.map((entry) =>
                              entry.uid === item.uid
                                ? { ...entry, caption: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <span className="admin-queue__name">
                        将保存为 {String(nextNumber + index).padStart(2, '0')}-
                        {safeName(item.caption)}.jpg
                      </span>
                    </div>
                    <button
                      type="button"
                      className="admin-x"
                      aria-label="移除"
                      onClick={() =>
                        setQueue((prev) => prev.filter((entry) => entry.uid !== item.uid))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="admin-actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => void uploadAll()}
                disabled={uploading || queue.length === 0}
              >
                {uploading
                  ? '上传中…'
                  : queue.length > 0
                    ? `上传这 ${queue.length} 张`
                    : '上传照片'}
              </button>
              {uploadMsg ? <span className="admin-msg">{uploadMsg}</span> : null}
            </div>
          </>
        ) : (
          <p className="admin-hint">先在上面连接 GitHub。</p>
        )}
      </section>

      <section className="admin-card">
        <h2 className="admin-card__title">
          <span className="admin-card__no">03</span> 时间表
        </h2>
        {connected ? (
          <>
            <div className="admin-list__head">
              <span className="admin-hint">
                {remoteState === 'loading'
                  ? '读取中…'
                  : remoteState === 'error'
                    ? '读取失败'
                    : `仓库里共 ${remoteList.length} 条`}
              </span>
              <button
                type="button"
                className="admin-btn admin-btn--sm"
                onClick={() => void reloadTimeline()}
                disabled={saving || remoteState === 'loading'}
              >
                重新读取
              </button>
            </div>

            {remoteState === 'ready' ? (
              <ul className="admin-list">
                {timelineRows.map(({ item, index }) => (
                  <li
                    className={`admin-list__row${editing === index ? ' is-editing' : ''}`}
                    key={`${item.date}-${item.title}-${index}`}
                  >
                    {confirming === index ? (
                      <>
                        <span className="admin-list__title">
                          删除「{item.title}」？这条会从时间表里消失。
                        </span>
                        <div className="admin-list__actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm admin-btn--danger"
                            onClick={() => void removeTimeline(index)}
                            disabled={saving}
                          >
                            确认删除
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
                            onClick={() => setConfirming(null)}
                            disabled={saving}
                          >
                            取消
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <time className="admin-list__date">{item.date}</time>
                        <span className="admin-list__title">{item.title}</span>
                        {item.photo ? (
                          <span className="admin-list__flag">配图</span>
                        ) : null}
                        {item.highlight ? (
                          <span className="admin-list__flag">重要</span>
                        ) : null}
                        <div className="admin-list__actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
                            onClick={() => startEdit(index)}
                            disabled={saving}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--sm"
                            onClick={() => setConfirming(index)}
                            disabled={saving}
                          >
                            删除
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}

            <form className="admin-form" onSubmit={(event) => void saveTimeline(event)}>
              <p className="admin-hint">
                {editing === null
                  ? '新增一条时间点：'
                  : `正在编辑「${remoteList[editing]?.title ?? ''}」，改完点保存。`}
              </p>
              <div className="admin-row">
                <label className="admin-field">
                  <span>日期</span>
                  <input
                    className="admin-input"
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                    required
                  />
                </label>
                <label className="admin-field admin-field--grow">
                  <span>标题</span>
                  <input
                    className="admin-input"
                    value={form.title}
                    placeholder="第一次一起看日出"
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    required
                  />
                </label>
              </div>

              <label className="admin-field">
                <span>正文（可不填）</span>
                <textarea
                  className="admin-input admin-textarea"
                  rows={3}
                  value={form.text}
                  placeholder="那天几点起的床、风有多大、你说了什么"
                  onChange={(event) => setForm({ ...form, text: event.target.value })}
                />
              </label>

              <div className="admin-row">
                <label className="admin-field">
                  <span>标签（可不填）</span>
                  <input
                    className="admin-input"
                    value={form.tag}
                    placeholder="旅行 / 纪念 / 日常"
                    onChange={(event) => setForm({ ...form, tag: event.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>配图（可不填）</span>
                  <select
                    className="admin-input"
                    value={form.photo}
                    onChange={(event) => setForm({ ...form, photo: event.target.value })}
                  >
                    <option value="">不配图</option>
                    {photoNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.highlight}
                  onChange={(event) => setForm({ ...form, highlight: event.target.checked })}
                />
                <span>重要节点（时间表上显示成描边卡片）</span>
              </label>

              <div className="admin-actions">
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={saving}
                >
                  {saving ? '保存中…' : editing === null ? '添加到时间表' : '保存修改'}
                </button>
                {editing !== null ? (
                  <button type="button" className="admin-btn" onClick={resetForm}>
                    取消编辑
                  </button>
                ) : null}
                {tlMsg ? <span className="admin-msg">{tlMsg}</span> : null}
              </div>
            </form>
          </>
        ) : (
          <p className="admin-hint">先在上面连接 GitHub。</p>
        )}
      </section>

      <section className="admin-card">
        <h2 className="admin-card__title">
          <span className="admin-card__no">04</span> 新增待办
        </h2>
        {connected ? (
          <form className="admin-form" onSubmit={(event) => void submitTodo(event)}>
            <div className="admin-row">
              <label className="admin-field admin-field--grow">
                <span>想做的事</span>
                <input
                  className="admin-input"
                  value={todoForm.text}
                  placeholder="一起去看一次演唱会"
                  onChange={(event) => setTodoForm({ ...todoForm, text: event.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>分类</span>
                <select
                  className="admin-input"
                  value={todoForm.category}
                  onChange={(event) =>
                    setTodoForm({
                      ...todoForm,
                      category: event.target.value as TodoCategory,
                    })
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="admin-actions">
              <button type="submit" className="admin-btn admin-btn--primary">
                提交到清单
              </button>
              {todoMsg ? <span className="admin-msg">{todoMsg}</span> : null}
            </div>
          </form>
        ) : (
          <p className="admin-hint">先在上面连接 GitHub。</p>
        )}
      </section>

      <section className="admin-card admin-card--muted">
        <h2 className="admin-card__title">
          <span className="admin-card__no">05</span> 等待构建的内容
        </h2>
        <p className="admin-hint">
          {queued === 0
            ? '没有等待构建的内容。'
            : `${pending.photos.length} 张照片、${pending.timeline.length} 条时间点、${pending.todos.length} 条待办已提交，等 Actions 构建完就会自动从「待构建」变成正式内容。`}
        </p>
        <p className="admin-hint">
          <a className="admin-a" href={ACTIONS_URL} target="_blank" rel="noreferrer">
            看构建进度 →
          </a>
        </p>
      </section>

      <Reveal>
        <p className="admin-foot">
          时间表数据在 <code>src/data/timeline.json</code>，待办在{' '}
          <code>src/data/todos.json</code>，照片在 <code>content/photos/</code>
          —— 想批量改的话，直接在 GitHub 上改这些文件也一样。
        </p>
      </Reveal>
    </div>
  );
}
