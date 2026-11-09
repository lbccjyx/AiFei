# AiFei

两个人的记录本。一个纯静态的恋爱小站：**恋爱时间表**、**要一起做的事**、**恋爱照片**，外加一本可以随时写两笔的日记。

没有后端、没有数据库、不用登录。构建出来就是一袋静态文件，扔到 GitHub Pages 上就能给别人看。
黑白、克制、首屏是一片会跟随滚动穿过去的粒子云 —— 视觉底子来自 [TnTeQAQ/blog-template](https://github.com/TnTeQAQ/blog-template)。

- 线上地址：https://lbccjyx.github.io/AiFei/

## 页面

| 页面 | 路径 | 内容从哪来 |
| --- | --- | --- |
| 首页 | `/` | 粒子首屏 + 三个入口 + 最近日记 + 关于 |
| 时间表 | `/timeline` | `src/data/timeline.json`，一屏可缩放的时间轴 |
| 待办 | `/todo` | `src/data/todos.json`（勾选存在浏览器本地） |
| 照片 | `/gallery` | `content/photos/` 里的图片，自动收集 |
| 日记 | `/diary` | `content/posts/*.md` |
| 关于 | `/about` | `content/about.md` |
| 编辑 | `/admin` | 不用改文件：网页上直接传照片、加时间点、加待办 |

## 在网页上编辑（推荐）

页脚右下角的「编辑」，或者直接打开 `/admin`，可以：

- 一次选/拖多张照片上传（自动压到 1800px 的 JPG，按 01、02… 排好序）
- 新增时间表条目（日期、标题、正文、标签、配图、是否重要节点）
- **改时间表**：列表里点「编辑」，改日期/标题/正文/标签/配图/是否重要节点都行
- **删时间表**：列表里点「删除」，再点一次「确认删除」
- 新增待办

提交后内容会**直接提交到这个 GitHub 仓库**，Actions 自动重新构建（约 1 分钟）后正式上线。
提交成功但还没构建完的这一分钟里，照片页/时间表上会先显示出来并标着「待构建」，构建完成后标记自动消失。

**它需要一个 GitHub token**（只在你的浏览器里存着，不经过任何第三方）：

1. 打开 https://github.com/settings/personal-access-tokens/new
2. Token name 随便写（比如 aifei-admin），Expiration 建议 90 天以上
3. Repository access → **Only select repositories** → 勾 **AiFei**
4. Permissions → Repository permissions → **Contents** 选 **Read and write**（别的一律不给）
5. Generate token，复制 `github_pat_…`，粘到 `/admin` 的输入框里，点「保存并验证」

几点说明：

- token 只存在这台设备的 `localStorage`，换设备/清缓存要再填一次；泄露了就去同一个页面 Revoke
- 想让她也能编辑，就在 github 上给她授权这个仓库，或者给她也生成一个同样权限的 token
- 时间表能改能删了；**照片和待办**目前只能加，删还得手动改文件（`content/photos/`、`src/data/todos.json`）

## 也可以直接改文件

## 日常维护：只需要改这几个地方

### 1. 名字、纪念日、几句话

`src/data/couple.ts` —— 全站的人设数据都在这一个文件里：

```ts
export const couple = {
  names: '巫鸿民 & 黄叶菲',   // 首页大标题（就是这两个名字）
  tagline: '……',               // 首页副标题
  startDate: '2024-05-20',     // 在一起的第一天，首页「第 N 天」由它算
  motto: '……',                 // 首页关于区块
  signature: '……',
};
```

改完 `startDate`，首页的「在一起 N 天」、页脚、时间表开头的天数会一起变。

### 2. 时间表

`src/data/timeline.json`，一个数组，照着注释复制一段就行：

```ts
{
  date: '2025-05-20',
  title: '一周年',
  text: '一年里我们吵过三次架……',
  tag: '纪念',          // 可选，小标签
  highlight: true,      // 可选，重要节点会显示成描边卡片
  photo: '06-一周年',   // 可选，配 content/photos/ 里的文件名（不带扩展名）
}
```

时间表按 `date` 自动从早到晚排序，不用自己排。

### 3. 要办的事情

`src/data/todos.json`：

```ts
{ id: 'w3', text: '一次拍写真', category: '日常', done: true, doneDate: '2026-11-09' }
```

`id` 唯一且别改（勾选状态按 id 记）；`category` 只能是 `旅行 | 美食 | 日常 | 未来`
（想加分类，改 `src/pages/TodoView.tsx` 顶部的 `CATEGORIES` 和 `src/data/todos.ts` 的类型）。

**怎么改、存在哪：**

| 操作 | 效果 |
| --- | --- |
| 手机上点一下 | 只改本地，那条标「未保存」 |
| 点「保存改动（N）」 | 把这批改动**一次性**提交到 `todos.json`，约 1 分钟后所有设备同步 |
| 没填过 token | 点保存时会提示去「编辑」页填一次；填完再点保存即可 |
| 文件里写 `"done": true` / `npm run todo -- done 3` | 直接改仓库，改完 `npm run deploy` |

保存是批量的：一次点 5 条再保存，仓库里只产生**一个 commit**，说明会列成
`待办：更新 5 条完成状态` + 每条一行。文件里记的完成，清单上会多一个
「已记录 · 日期」的小标签；还没保存的则标「未保存」，点「撤销」可以整批回退。

不想手写 JSON 就用命令行：

```bash
npm run todo                     # 看清单（带序号）
npm run todo -- done 3           # 第 3 条记成完成（也可以写 id，比如 w3）
npm run todo -- undo 3           # 取消完成
npm run todo -- add "一起去看海" --cat 旅行
npm run todo -- rm 3             # 删掉一条
```

改完跑 `npm run deploy` 才会到线上。

### 4. 照片

把图片丢进 `content/photos/`，文件名前面的数字决定顺序：

```
content/photos/
├── 01-初见.jpg
├── 02-第一次出门.jpg
└── 07-新照片.jpg        ← 加进来自动出现，不用改代码
```

说明文字在 `src/data/photo-captions.json` 里配（键 = 文件名去掉扩展名，不用改后缀）。
没配的照片会自动用文件名当说明（去掉开头的数字）。文件名里带中文没问题。

> 仓库里现在这 6 张是程序生成的占位图，直接删掉换成你们的照片即可。

**图片怎么加载**（`scripts/photos.mjs` 自动处理，不用手动管）：

原图单张常常 1 MB，32 张就是十几 MB，手机一次性下不动。所以构建前会先烘这几个尺寸：

| 产出 | 尺寸 | 用途 |
| --- | --- | --- |
| `blur` | 24px，base64 内联在 JS 里 | 打开就有的模糊占位，0 个请求 |
| `thumb-sm` | 420px WebP，约 20 KB | 手机照片墙（格子只有 180px 宽） |
| `thumb` | 720px WebP，约 50 KB | 大屏格子、时间表缩略图、详情抽屉 |
| `full` | 1600px WebP，约 150 KB | 灯箱、后台预取 |

照片墙用 `srcSet` + `sizes` 让浏览器按格子实际宽度自己挑 420 还是 720，
跨两列的「主图」按两列宽算，所以不会被放大发虚。

顺序是：**模糊占位 → 缩略图 → 大图**。大图只给真正出现在屏幕上的图，剩下的
在进页面 5 秒后由 `src/lib/prefetch.ts` 一张一张慢慢下（每张隔 1.1 秒）。
开了省流量模式、或者网络是 2G/3G 的设备，后台预取整个跳过。

衍生物写在 `public/media/`（已 gitignore，构建时自动生成），清单在
`src/data/photo-manifest.json`（这个要提交）。原始大图不会被打进 `dist`，
浏览器也就永远不会去下它。手动重烘：`npm run photos`。

### 4.1 打包体积上做的两件事

- **three.js 单独一个 chunk**：首页那片粒子云有 517 KB，只对首页 `lazy()` 引入，
  主包因此从 940 KB 降到 427 KB（gzip 141 KB），时间表 / 照片 / 日记页完全不下载它。
- **BGM 延后**：`public/music/yixiaoqingcheng.mp3` 有 2.3 MB，比首屏图片还重。
  现在等 `load` 事件之后再等 1.2 秒才开始探测和播放；省流量 / 2G-3G 设备干脆不自动播，
  点左下角按钮才下。

### 5. 日记

```bash
npm run new -- "标题"                # 生成 content/posts/标题.md 和同名图片文件夹
npm run new -- "标题" --tags 旅行,日常
```

然后编辑那个 Markdown 文件。图片放进同名文件夹，正文里写 `./图片名.png` 就能引用。
也支持 `npm run new -- "标题" --slug my-slug` 指定英文文件名。

### 6. 背景音乐

左下角有个播放按钮，BGM 是《一笑倾城》，用原生 `<audio loop>` 循环播放
`public/music/yixiaoqingcheng.mp3`。

- 想换歌：替换这个文件（或改 `src/components/MusicPlayer.tsx` 里的 `FILE_URL`）
- 现在这版是 **2026 南京音乐节现场版**（汪苏泷本人演唱）—— 录音室版在网易云 / QQ 音乐
  都是会员曲目，直链只给 30 秒试听，所以用了这版免费的完整现场
- 浏览器不允许没交互就自动播放：加载完再等 1.2 秒才试一次，被拦下就等你第一次点
  页面任意位置；左下角按钮随时暂停/继续。省流量 / 2G-3G 下不自动播

### 7. 时间表「长河」怎么调

时间表不是一条长列表，而是一屏可缩放的时间轴（设计见 `docs/design-brief.md` 第 5 节）：

- **位置按真实时间比例**：10 月有 20 条、9 月只有 4 条，所以 10 月自然更长
- **L0 全景**（默认）只显示标了「重要节点」的条目，放大到 2.2 倍后所有标题才出现
- 同一天的几条聚合成一个点，角标是条数
- 篇章名写在 `src/data/chapters.ts`（按月，key 是 `YYYY-MM`）
- 拖动 = 平移，双指 / `Ctrl+滚轮` = 缩放，`+/-` 键缩放，`0` 或 `Esc` 回全景

## 本地开发

```bash
npm install       # 需要 Node.js ≥ 20
npm run dev       # http://localhost:5173
npm run build     # 类型检查 + 构建到 dist/
npm run preview   # 预览构建产物
npm run lint      # ESLint
```

## 部署

已经配好 `.github/workflows/deploy.yml`：推到 `main` 分支，GitHub Actions 会自动构建并发布到 Pages。

**第一次需要手动开一次 Pages**：仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
（workflow 里带了 `enablement: true` 想自动开，失败的话就点这一下。）

之后发布：

```bash
npm run deploy            # 本地构建一次 → 提交 → 推送，Actions 接手
npm run deploy -- "补两张照片"   # 自定义提交说明
```

也可以直接 `git push`，效果一样。

### 换成自定义域名

1. `public/CNAME` 里写域名（例如 `aifei.me`），这个文件会被原样拷进构建产物；
2. DNS 加记录：根域 `A` 指向 `185.199.108.153` / `.109.153` / `.110.153` / `.111.153`，
   `www` 用 `CNAME` 指向 `lbccjyx.github.io`；
3. Settings → Pages 填 Custom domain，等证书签发后勾 Enforce HTTPS；
4. 域名是根路径，把 `.github/workflows/deploy.yml` 里的 `VITE_BASE: /AiFei/` 改成 `VITE_BASE: /`

### 换成 `<用户名>.github.io` 用户页

把仓库改名成 `lbccjyx.github.io`，`VITE_BASE` 同样改成 `/`。

## 技术说明

- **React 19 + Vite 8 + TypeScript**，样式是手写 CSS 变量（`--bg` / `--fg` / `--border`），
  亮暗两套主题，切换时有一层波纹遮罩
- **自写的 Markdown → React 引擎**（`src/lib/markdown/`），不依赖 react-markdown / remark，
  支持标题、列表、表格、引用、代码块和原生 HTML
- **Three.js 粒子首屏**：三层点云 + 指针视差，滚动驱动相机穿过粒子云；跟随系统「减少动态效果」
- **单根 History 路由**：站内跳转地址栏保持根路径，但 `/timeline`、`/posts/<slug>` 这些真实路径
  能直接打开、能分享、刷新不丢；未知路径走自定义 404
- **零后端**：待办勾选只存本地；没有账号、没有统计脚本
- 所有内容在构建时打进包（`import.meta.glob`），所以改数据 / 加图片都要重新构建

## 目录结构

```
├── content/
│   ├── about.md              # 关于页
│   ├── photos/               # 照片（自动收集，按文件名排序）
│   └── posts/                # 日记（.md）+ 同名图片文件夹
├── public/                   # favicon、robots.txt、CNAME(自定义域名时)
├── scripts/
│   ├── new-post.mjs          # npm run new
│   └── deploy.mjs            # npm run deploy
├── src/
│   ├── data/                 # couple / timeline / todos / photos  ← 内容都在这
│   ├── components/           # 导航、页脚、灯箱、特效组件
│   ├── lib/                  # markdown 引擎、three、motion、本地存储
│   ├── pages/                # 首页 / 时间表 / 待办 / 照片 / 日记 / 关于 / 404
│   ├── router/               # 单根 History 路由
│   └── styles/page.css       # 三个新页面的公共样式骨架
├── .env                      # 站名等公开配置（不要放密钥）
└── .github/workflows/        # deploy.yml（发布 Pages）、ci.yml（lint + build）
```

## License

MIT © TnTeQAQ（模板），本站内容属于我们自己。
