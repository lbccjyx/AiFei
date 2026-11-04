/**
 * 照片说明文字。
 *
 * 照片本身不用登记：把图片丢进 `content/photos/` 就会自动出现在照片页，
 * 或者直接在网页的「编辑」页里上传。这里只负责给某几张配一句话 ——
 * 键是文件名（不带扩展名），没配图的会自动用文件名当说明。
 *
 * 数据在 photo-captions.json（编辑页提交的就是它）。
 */
import raw from './photo-captions.json';

export const photoCaptions = raw as unknown as Record<string, string>;
