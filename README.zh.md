<p align="center">
  <img src="apps/web/public/lockup.svg" alt="PINDOU" width="280" />
</p>
<p align="center">拼豆图纸编辑器与分享社区。</p>
<p align="center">
  <a href="https://github.com/xingxingmofashu/pindou/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/xingxingmofashu/pindou/ci.yml?style=flat-square&branch=main" /></a>
  <a href="https://github.com/xingxingmofashu/pindou"><img alt="GitHub stars" src="https://img.shields.io/github/stars/xingxingmofashu/pindou?style=flat-square" /></a>
  <a href="https://github.com/xingxingmofashu/pindou"><img alt="License" src="https://img.shields.io/github/license/xingxingmofashu/pindou?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

---

创建像素风格的拼豆图纸，使用 GitHub 登录，与世界分享你的设计。

**线上地址：** [xingxing-pindou.vercel.app](https://xingxing-pindou.vercel.app)（Vercel）· [xingxing-pindou.netlify.app](https://xingxing-pindou.netlify.app)（Netlify，中国大陆可访问）

<p align="center">
  <img src=".github/assets/zh/preview.png" alt="拼豆图纸编辑器预览" width="800" />
</p>

## 功能

- **画布编辑器** — 基于 WebGL (PixiJS v8)，无限稀疏网格，以光标为中心的缩放、平移，以及画笔 / 橡皮擦 / 油漆桶工具
- **固定网格分辨率** — 网格线和豆子始终按数据格分辨率渲染，导入的图纸在任意缩放级别下格子数量保持不变（LOD 仅控制画笔块大小）
- **图片转图纸** — 在浏览器内将任意图片转换为拼豆图纸（Web Worker + canvas，OKLab 感知色差匹配）；支持照片 / 插画模式、合并相近颜色、移除背景，以及排除指定色号
- **实时珠子用量** — 编辑器右侧面板实时显示已绘制的尺寸、珠子总数和每种色号的数量
- **导出 PNG 图纸** — 下载带坐标的打印图纸，可选色号标签和随珠尺寸缩放的用量列表
- **多品牌色号** — 内置 MARD（漫漫）、Perler、Hama、Artkal 色号库，可自由切换品牌
- **GitHub 登录** — 使用 GitHub 身份发布图纸（Better Auth），无需单独注册账号或填写用户名
- **图纸画廊** — 浏览最新发布的图纸，带缩略图预览
- **详情页** — 每张图纸都有只读交互式画布，作者可进入编辑
- **桌面应用** — 离线 Electron 编辑器（macOS + Windows），与网页版共用画布，本地 SQLite 存储，通过 GitHub Releases 提示更新

## 技术栈

| | |
|---|---|
| 框架 | Next.js 16 (App Router) |
| 画布 | PixiJS v8 (WebGL) |
| 样式 | Tailwind CSS v4 + shadcn/ui (Base UI) |
| 数据库 | PostgreSQL (Neon) via @neondatabase/serverless + Drizzle ORM |
| 认证 | Better Auth (GitHub OAuth) |
| 图片转换 | 浏览器内（Web Worker + canvas，OKLab 感知色差） |
| 缩略图 | sharp（服务端，Node runtime） |
| 色彩计算 | culori |
| 限流 | Upstash Redis (@upstash/ratelimit) |
| 语言 | TypeScript (strict) |
| 桌面端 | Electron 37 + Electron Forge 7 (Vite) |

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (http://localhost:3000)
pnpm dev

# 生产构建
pnpm build

# 代码检查
pnpm lint
```

## 项目结构

pnpm monorepo，依赖方向严格单向：`@pindou/shared ← @pindou/core ← @pindou/ui ← @pindou/web`。

```
apps/
  web/                  # @pindou/web —— Next.js 16 应用（可部署单元）
    src/
      app/              # App Router 路由 —— 服务端页面负责取数并渲染
                        # client.tsx 内容组件，每段路由配 loading.tsx（骨架屏）+ error.tsx（错误边界）
        [lang]/         # 带语言前缀的路由（en / zh）
          (site)/       # 站点主布局（页头 + 页脚外壳）
            (content)/  # 首页 + 图纸画廊 + 图纸详情
            (workspace)/# 编辑器 + 图纸编辑页面
          sign-in/      # GitHub 登录页
        api/            # Better Auth 路由处理 + REST API（patterns、brands）
      components/       # 仅 web 使用的组件（header、footer、color-palette、providers 等）
      db/               # Drizzle schema（认证 + 应用表）+ Neon 连接
      i18n/             # 服务端字典加载（getDictionary）
      lib/              # 仅 web 的辅助模块：auth、server/{palettes,patterns,meta}、escapeLike
      workers/          # 浏览器内图片解码 + 预缩放（transform.worker.ts）
  desktop/              # @pindou/desktop —— Electron 应用（离线编辑器）
    src/
      main/             # 主进程：窗口、IPC、SQLite 存储、自动更新
      preload/          # contextBridge API 面
      renderer/         # React UI（Vite）
      shared/           # IPC 通道名
    drizzle/            # SQLite schema + 迁移
    resources/          # 应用图标（icns）+ 图标源文件
  vercel.json           # Vercel 部署配置（Root Directory: apps/web）
  netlify.toml          # Netlify 部署配置（Base: apps/web）

packages/
  shared/               # @pindou/shared —— 纯常量 + 类型（无任何依赖）
    src/constants.ts    #   编辑器/上传上限、画布背景色
    src/types.ts        #   三张表的行类型 + Palette
  core/                 # @pindou/core —— 框架无关的业务逻辑
    src/editor.ts       #   纯函数：网格计算、LOD、油漆桶、序列化、计数
    src/export.ts       #   仅客户端：PNG 图纸导出（禁止在服务端运行）
    src/transform.ts    #   纯图片→图纸量化（OKLab 感知色差）
    src/date.ts         #   本地化日期格式化（date-fns）
    src/utils.ts        #   cn、fetcher、postJson、hexToRgb、珠子计数工具
    src/i18n/           #   语言配置 + 字典（en/zh）+ 客户端 I18nProvider
    src/hooks/          #   Zustand store + PixiJS 生命周期 hooks（use-editor、use-pixi-canvas 等）
    src/server/         #   仅 Node 基础设施：r2.ts、grid-storage.ts、rate-limit.ts、thumbnail.ts
  ui/                   # @pindou/ui —— 组件库（Base UI + Tailwind）
    src/components/     #   共享编辑器组件（pixi-canvas、bead-stats、dialogs 等）
    src/components/ui/  #   shadcn/ui 基础组件（禁止手动修改）
    src/index.css       #   Tailwind 入口（tw-animate-css + @layer base）
    src/index.ts        #   根导出（基础组件 + 品牌元素 + 工具函数）
```

web 专属依赖（认证、worker、路由、主题）通过 props/hooks 注入共享组件，
保证包依赖图无环——ui 包不碰 Next.js，core 不碰 React 状态。

## 编辑器

访问 `/editor` 使用编辑器，功能包括：

- **画笔 / 橡皮擦 / 油漆桶** — 使用当前颜色绘制（拖拽时通过 Bresenham 算法插值，防止断线）、擦除豆子、或对连通区域进行填充
- **撤销 / 重做** — 逐步回退编辑操作（⌘Z / ⇧⌘Z；Windows/Linux 为 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y）
- **显示色号** — 在画布上切换显示每颗豆子的色号标签
- **图片导入** — 上传图片并转换为拼豆图纸；高级选项包括照片 / 插画模式、合并相近颜色、移除背景，以及从色板中排除指定色号
- **导出 PNG** — 下载带坐标的打印图纸，可选色号标签和珠子用量列表
- **珠子用量面板** — 右侧边栏显示图纸尺寸、珠子总数和每种色号数量，随绘制实时更新
- **缩放** — 滚轮缩放（以光标为中心，0.5×–20×）、百分比输入、适应画布按钮
- **平移** — 鼠标中键或右键拖拽
- **色号面板** — 左侧边栏，品牌切换器，按系列分组的色块
- **发布** — 使用 GitHub 登录后将图纸保存到画廊，可填写标题和描述；署名自动取自你的 GitHub 账号

## API

| 方法 | 路由 | 说明 |
|---|---|---|
| `GET` | `/api/patterns?page=1` | 分页获取已发布图纸列表 |
| `POST` | `/api/patterns` | 发布新图纸（需 GitHub 登录，已限流） |
| `GET` | `/api/patterns/[id]` | 获取单张图纸 |
| `PATCH` | `/api/patterns/[id]` | 更新图纸的标题、描述或网格（仅作者，已限流） |
| `GET` | `/api/brands` | 获取所有品牌及其色号 |
| `GET` | `/api/brands/[id]` | 获取单个品牌及其色号 |

图片转图纸完全在浏览器内完成（无 `/api/transform`），上传的图片不会离开客户端。发布/编辑的 JSON 请求体上限 20 MB；网格限制为每边 4096 格、总格数 100 万。发布与编辑按用户限流（20 次 / 60 秒），基于 Upstash Redis。

## 桌面应用

桌面应用（`apps/desktop`）是基于 Electron Forge + Vite 的离线 Electron 编辑器。它与网页版通过 `@pindou/*` 包共享 PixiJS 画布和编辑器逻辑，图纸数据本地存储在 SQLite（Drizzle）中。

### 开发

```bash
pnpm desktop:dev        # 以开发模式运行 Electron 应用
pnpm desktop:package    # 打包应用（out/Pindou-darwin-arm64/…）
pnpm desktop:make       # 构建安装包（dmg / exe / zip，输出到 out/make）
```

### 发布

打 `v*` tag 会触发 `Release Desktop` 工作流，分别构建 macOS（arm64）和 Windows（x64）并发布 GitHub Release：

| 平台 | 产物 |
|---|---|
| macOS | `pindou-desktop-mac-arm64.dmg` / `.zip` |
| Windows | `pindou-desktop-win-x64.exe` |

发布包未做代码签名（beta 阶段）。如果 macOS 下载后提示应用已损坏，请运行：

```bash
xattr -cr /Applications/Pindou.app
```

Windows 上 SmartScreen 可能弹出警告——点击 **更多信息** → **仍要运行**。

### Windows FAQ

**应用安装在哪里？**
Squirrel 按用户安装（无需管理员权限），位置在 `%LOCALAPPDATA%\pindou-desktop`，不在 Program Files。会自动创建开始菜单快捷方式。

**为什么 SmartScreen 会警告？**
安装包尚未代码签名。点击 **更多信息** → **仍要运行** 即可——应用由本仓库的 CI 构建。

**为什么安装时会运行 `Updater.exe` / 出现 `%LOCALAPPDATA%\SquirrelTemp`？**
那是 Squirrel 的安装器/更新器，是"按用户安装"流程的正常部分。它只在安装/更新/卸载时短暂运行，用于注册快捷方式并完成安装，然后退出。它不会下载任何东西，也不会在每次启动应用时运行。

**如何更新？**
应用启动时会检查新版本并弹窗提示（中英文按系统语言切换）。点击确认后打开 GitHub Releases 页面——下载新的 `.exe` 并运行即可，本地图纸数据会保留。

**如何卸载？**
设置 → 应用 → 已安装的应用 → 找到 **Pindou** → 卸载。卸载后 `%LOCALAPPDATA%\pindou-desktop` 下的图纸数据可能仍会保留。

### 自动更新

打包应用启动时会检查 update.electronjs.org 是否有新版本，并向用户弹出提示（中英文根据系统语言自动切换）。点击确认后打开 GitHub Releases 页面手动下载——刻意不使用自动下载，因为 Squirrel.Mac 会拒绝未签名构建的 adhoc 签名。

## 开源协议

[Apache License 2.0](LICENSE)
