# 拼豆 Pindou

拼豆图纸编辑器与分享社区。创建像素风格的拼豆图纸，匿名分享，发现他人的设计——无需注册账号。

## 功能

- **画布编辑器** — 基于 WebGL (PixiJS v8)，无限稀疏网格，支持缩放、平移、画笔和橡皮擦工具
- **固定网格分辨率** — 网格线和豆子始终按数据格分辨率渲染，导入的图纸在任意缩放级别下格子数量保持不变（LOD 仅控制画笔块大小）
- **图片转图纸** — 将任意图片转换为拼豆图纸，使用当前品牌色号（服务端 sharp + 感知色差匹配）
- **多品牌色号** — 内置 MARD（漫漫）、Perler、Hama、Artkal 色号库，可自由切换品牌
- **匿名发布** — 无需注册即可发布图纸，通过编辑令牌管理已发布内容
- **图纸画廊** — 浏览最新发布的图纸，带缩略图预览
- **详情页** — 每张图纸都有只读交互式画布，可缩放查看细节

## 技术栈

| | |
|---|---|
| 框架 | Next.js 16 (App Router) |
| 画布 | PixiJS v8 (WebGL) |
| 样式 | Tailwind CSS v4 + shadcn/ui (Base UI) |
| 数据库 | PostgreSQL (Neon) via @neondatabase/serverless + Drizzle ORM |
| 图片转换 | sharp（服务端，Node runtime） |
| 色彩计算 | culori |
| 语言 | TypeScript (strict) |

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

```
src/
  app/                  # Next.js App Router 页面
    editor/             # 编辑器页面
    patterns/           # 图纸画廊
    patterns/[id]/      # 图纸详情页
    api/patterns/       # REST API（GET 列表、POST 发布）
    api/patterns/[id]/  # GET 单张图纸
    api/transform/      # POST 图片 → 图纸转换（Node runtime）
  components/
    editor/             # 工具栏、缩放控件、色号面板、发布弹窗、图片导入弹窗
    pattern/            # 图纸卡片
    pixi-canvas.tsx     # 可复用 PixiJS 画布组件
    ui/                 # shadcn/ui 组件（禁止手动修改）
  hooks/
    use-pixi-app.ts     # PixiJS Application 生命周期（WebGL 上下文管理）
    use-pixi-canvas.ts  # 缩放/平移/绘制指针事件、固定分辨率重建
    use-active-palette.ts # 当前品牌状态订阅
  lib/
    editor/index.ts     # 纯函数：网格计算、LOD、边界、序列化
    palette/            # 品牌色号数据（MARD、Perler、Hama、Artkal）
    transform.ts        # 图片 → 图纸转换（仅 Node）
    thumbnail.ts        # 服务端 PNG 缩略图生成（sharp）
    validation.ts       # 共享 zod schema
    utils.ts            # 通用工具函数
  db/                   # Drizzle schema + 连接（PostgreSQL / Neon）
```

## 编辑器

访问 `/editor` 使用编辑器，功能包括：

- **画笔** — 使用当前颜色绘制；拖拽时通过 Bresenham 算法插值，防止断线
- **橡皮擦** — 擦除豆子（将格子置空）
- **图片导入** — 上传图片并转换为拼豆图纸，使用当前品牌色号
- **缩放** — 滚轮缩放（以光标为中心，0.5×–20×）、百分比输入、适应画布按钮
- **平移** — 鼠标中键拖拽
- **色号面板** — 左侧边栏，品牌切换器，按系列分组的色块
- **发布** — 将图纸保存到画廊，可填写标题、描述和署名

## API

| 方法 | 路由 | 说明 |
|---|---|---|
| `GET` | `/api/patterns?page=1` | 分页获取已发布图纸列表 |
| `POST` | `/api/patterns` | 发布新图纸 |
| `GET` | `/api/patterns/[id]` | 获取单张图纸 |
| `POST` | `/api/transform` | 将图片转换为图纸（multipart `file`、`width`、`brandId`） |

## 开源协议

MIT
