# AiFei

两个人的记录本。一个纯静态的恋爱小站：**恋爱时间表**、**要一起做的事**、**恋爱照片**，外加一本可以随时写两笔的日记。

没有后端、没有数据库、不用登录。构建出来就是一袋静态文件，扔到 GitHub Pages 上就能给别人看。
黑白、克制、首屏是一片会跟随滚动穿过去的粒子云 —— 视觉底子来自 [TnTeQAQ/blog-template](https://github.com/TnTeQAQ/blog-template)。

- 线上地址：https://lbccjyx.github.io/AiFei/

## 页面

| 页面 | 路径 | 内容从哪来 |
| --- | --- | --- |
| 首页 | `/` | 粒子首屏 + 三个入口 + 最近日记 + 关于 |
| 时间表 | `/timeline` | `src/data/timeline.ts` |
| 待办 | `/todo` | `src/data/todos.ts`（勾选存在浏览器本地） |
| 照片 | `/gallery` | `content/photos/` 里的图片，自动收集 |
| 日记 | `/diary` | `content/posts/*.md` |
| 关于 | `/about` | `content/about.md` |

## 日常维护：只需要改这几个地方

### 1. 名字、纪念日、几句话

`src/data/couple.ts` —— 全站的人设数据都在这一个文件里：

```ts
export const couple = {
  names: '阿飞 & 小妃',        // 首页大标题上面的小字
  tagline: '……',               // 首页副标题
  startDate: '2024-05-20',     // 在一起的第一天，首页「第 N 天」由它算
  motto: '……',                 // 首页关于区块
  signature: '……',
};
```

改完 `startDate`，首页的「在一起 N 天」、页脚、时间表开头的天数会一起变。

### 2. 时间表

`src/data/timeline.ts`，一个数组，照着注释复制一段就行：

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

`src/data/todos.ts`：

```ts
{ id: 't13', text: '一起去看一次演唱会', category: '旅行' }
```

`id` 唯一且别改（勾选状态按 id 记）；`category` 只能是 `旅行 | 美食 | 日常 | 未来`
（想加分类，改 `src/pages/TodoView.tsx` 顶部的 `CATEGORIES` 和 `src/data/todos.ts` 的类型）。

勾选状态存在浏览器 `localStorage`（键名 `aifei:todos:v1`），换设备 / 清缓存会回到未勾选。

### 4. 照片

把图片丢进 `content/photos/`，文件名前面的数字决定顺序：

```
content/photos/
├── 01-初见.jpg
├── 02-第一次出门.jpg
└── 07-新照片.jpg        ← 加进来自动出现，不用改代码
```

说明文字在 `src/data/photos.ts` 里配（键 = 文件名去掉扩展名，不用改后缀）。
没配的照片会自动用文件名当说明（去掉开头的数字）。文件名里带中文没问题。

> 仓库里现在这 6 张是程序生成的占位图，直接删掉换成你们的照片即可。

### 5. 日记

```bash
npm run new -- "标题"                # 生成 content/posts/标题.md 和同名图片文件夹
npm run new -- "标题" --tags 旅行,日常
```

然后编辑那个 Markdown 文件。图片放进同名文件夹，正文里写 `./图片名.png` 就能引用。
也支持 `npm run new -- "标题" --slug my-slug` 指定英文文件名。

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
