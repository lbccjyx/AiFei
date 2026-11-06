/**
 * GitHub API 的最小封装 —— 站内「编辑」页靠它把内容直接写回仓库。
 *
 * 为什么需要 token：站点是纯静态的，没有任何服务器能接收上传。浏览器的
 * 写操作只能打到 GitHub 的 REST API，而它要一个凭证。所以这里用一个
 * **只对 AiFei 这个仓库有 Contents 读写权限**的 fine-grained token，存在
 * 这台设备的 localStorage 里，不经过任何第三方。
 *
 * 提交成功后 GitHub Actions 会自动重新构建并发布（约 1 分钟）。
 */

export const REPO = {
  owner: 'lbccjyx',
  repo: 'AiFei',
  branch: 'main',
} as const;

const TOKEN_KEY = 'aifei:gh-token';

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 隐私模式下存不住，只在本页有效 */
  }
}

export class GhError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GhError';
    this.status = status;
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`https://api.github.com${path}`, { ...init, headers });
  } catch {
    throw new GhError(
      0,
      '连不上 api.github.com —— 检查网络（需要能访问 GitHub）。',
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { message?: string };
      detail = body.message ?? '';
    } catch {
      /* 非 JSON 响应 */
    }
    if (res.status === 401) {
      throw new GhError(401, 'token 无效或已过期，重新生成一个再填。');
    }
    if (res.status === 403) {
      throw new GhError(403, `没有权限：${detail || 'token 需要 Contents 读写权限'}`);
    }
    if (res.status === 404) {
      throw new GhError(404, `找不到仓库或文件：${path}`);
    }
    throw new GhError(res.status, detail || `GitHub 返回 ${res.status}`);
  }

  return res;
}

export type Viewer = { login: string; avatarUrl: string };

/** 验证 token 是否可用，顺便拿到用户名 */
export async function getViewer(): Promise<Viewer> {
  const res = await request('/user');
  const data = (await res.json()) as { login: string; avatar_url: string };
  return { login: data.login, avatarUrl: data.avatar_url };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToText(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 路径里的中文、空格要逐段转义，否则 API 会 404 */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export type RemoteFile = { text: string; sha: string };

/** 读仓库里的一个文本文件；不存在返回 null */
export async function readTextFile(path: string): Promise<RemoteFile | null> {
  let res: Response;
  try {
    res = await request(
      `/repos/${REPO.owner}/${REPO.repo}/contents/${encodePath(path)}?ref=${REPO.branch}`,
    );
  } catch (error) {
    if (error instanceof GhError && error.status === 404) return null;
    throw error;
  }
  const data = (await res.json()) as { content?: string; sha: string };
  return { text: base64ToText(data.content ?? ''), sha: data.sha };
}

export type PutOptions = {
  path: string;
  message: string;
  /** 文本内容与二进制二选一 */
  text?: string;
  bytes?: Uint8Array;
  /** 覆盖已有文件时必须带 sha */
  sha?: string;
};

/** 新建或覆盖一个文件（一次提交），返回新文件的 sha（下次覆盖要用） */
export async function putFile({
  path,
  message,
  text,
  bytes,
  sha,
}: PutOptions): Promise<string> {
  const base64 =
    bytes !== undefined ? bytesToBase64(bytes) : bytesToBase64(new TextEncoder().encode(text ?? ''));

  const res = await request(`/repos/${REPO.owner}/${REPO.repo}/contents/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: base64,
      branch: REPO.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  const data = (await res.json()) as { content?: { sha?: string } };
  return data.content?.sha ?? '';
}

/** 读 JSON 文件并解析；不存在时返回 null */
export async function readJsonFile<T>(path: string): Promise<{ data: T; sha: string } | null> {
  const file = await readTextFile(path);
  if (!file) return null;
  return { data: JSON.parse(file.text) as T, sha: file.sha };
}

/** 写 JSON 文件（带缩进，方便在 GitHub 上看 diff），返回新 sha */
export async function writeJsonFile(
  path: string,
  value: unknown,
  message: string,
  sha?: string,
): Promise<string> {
  return putFile({ path, message, text: `${JSON.stringify(value, null, 2)}\n`, sha });
}

/** 已提交但还没被构建进站点的图片，可以先用 raw 地址显示 */
export function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${REPO.branch}/${path}`;
}
