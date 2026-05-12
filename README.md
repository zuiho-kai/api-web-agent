# api-web-agent

> **像豆包一样轻轻松松聊天，但用你自己的 API key。** 浏览器侧 AI Agent 工作台，0 后端、自带 key、多 provider。

**中文** · [English](./README.en.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)

<img width="1920" height="878" alt="screenshot" src="https://github.com/user-attachments/assets/1a889eff-3c23-4aa8-ac33-f8f1d7406baa" />

## 谁适合用

**轻度用户**：不想注册各家账号、不想下载 App、不想跟付费墙打交道。手里有一个 OpenAI / Claude / Kimi / DeepSeek 之类的 key（或者公司给的代理 key），打开网页填进去就能像豆包/ChatGPT 一样聊天 —— **省一次月费、自己 key 想用多少用多少**。

**进阶用户**：想要的不只是聊天 —— 模型联网搜资料、读你的 PDF/Excel/图片、看自己推理过程、跨多个 provider 任意切换，**不用部署服务器、不用 Docker、不用注册任何东西**，纯浏览器里跑。

## 30 秒上手

**最快路径（一行 Docker）**：

```bash
docker run -d -p 8080:80 ghcr.io/zuiho-kai/api-web-agent:latest
```

打开 `http://localhost:8080/`，第一次自动弹出设置面板，填进你自己的 API key，开聊。

**或者下载 dist.zip**（任何静态服务器 / 本地双击）：

1. 去 [Releases](https://github.com/zuiho-kai/api-web-agent/releases/latest) 下载 `api-web-agent-vX.Y.Z-dist.zip`
2. 解压后 `npx serve dist` 或者直接拖文件夹到 Cloudflare Pages / Vercel / Netlify

**或者本地源码跑**（最适合改代码）：

```bash
git clone https://github.com/zuiho-kai/api-web-agent.git
cd api-web-agent
npm install && npm run dev
```

### 怎么用（任选其中一种部署方式之后）

1. 第一次自动弹出设置面板，填一个 provider：
   - **Base URL**：`https://api.openai.com`（或任何 OpenAI 兼容 / Anthropic 原生接口，不含 `/v1`）
   - **API Key**：`sk-…`（**只存你浏览器，不发任何第三方服务器**）
2. 顶部 model 框选预设（Claude / GPT / Grok）或自由输入任意 model 名
3. 输入框拖拽文件 / 粘贴图片 / 直接打字 → Enter 发送

就这样。

## 用起来像豆包，能力像 Claude Code

- 🗨️ **聊天**：流式输出、Markdown + 代码高亮、多轮上下文
- 🔍 **联网搜索**：模型自己决定要不要搜，使用 Jina Reader + DuckDuckGo，**零额外 key**
- 📄 **文档阅读**：拖一个 PDF / DOCX / XLSX / 图片进来，模型直接看
  - PDF 给 Claude 走原生 PDF document，保留版面 / 图表
  - 图片走 vision model（Claude 4 / GPT-4o / Grok-4）
  - DOCX 解析为 Markdown 保留表格 + 标题层级
  - XLSX 按 sheet 分块，大表自动 head + tail 截断
- 🧠 **思考过程可见**：5 档思考预算（关闭/低/中/高/超高），Claude 的 thinking 在折叠面板里实时流式显示
- ⚡ **prompt caching**：Anthropic 3-breakpoint 缓存命中省 90% 输入费
- 💾 **持久化**：IndexedDB 存所有会话、附件、设置；关浏览器再开还在
- 🧰 **多文件代码 → 一键下载 zip**：让模型写一个完整项目（package.json + 多个 .ts/.tsx 等），模型自动调用 `bundle_files` 工具打包，浏览器直接下载 zip
- 📋 **每个代码块复制 / 下载**：鼠标 hover assistant 消息里的代码块，右上角出现"复制 / 下载"按钮
- 🚀 **零后端**：纯静态 SPA，任意托管（Cloudflare Pages / Vercel / GitHub Pages / Netlify / S3）

## 内置模型预设

| 家族 | Models |
|---|---|
| Claude | Opus 4.7（默认）/ 4.6 (+ thinking) · Sonnet 4.6 (+ thinking) · Haiku 4.5 |
| GPT    | GPT-5.5 · GPT-5.4 · GPT-5.3 Codex |
| Grok   | Grok 4 · Grok 4 Heavy · Grok 4 (thinking) · Grok 4.1 Fast |

输入框里也能输任意自定义 model 名 —— **任何 OpenAI 兼容或 Anthropic 原生 model 都能直接接入**。

## 本地跑 / 自部署

```bash
git clone https://github.com/zuiho-kai/api-web-agent.git
cd api-web-agent
npm install
npm run dev       # 本地 http://localhost:5173/
```

构建为静态产物：

```bash
npm run build     # 输出到 dist/
npm run preview   # 本地预览
```

`dist/` 整个目录上传到任何静态托管（Cloudflare Pages / Vercel / GitHub Pages / Netlify）就能用。

## 架构（给爱看代码的人）

```
React UI ── Zustand store ── Agent loop ─┬─ Anthropic adapter (/v1/messages)
                                         └─ OpenAI adapter    (/v1/chat/completions)

按 model 名前缀自动路由：
  claude-*  → Anthropic 协议（原生 tool_use SSE，cache_control 缓存，thinking budget）
  其余      → OpenAI 协议（tool_calls.delta，reasoning_effort 含 Codex xhigh）

工具（客户端）              存储
├── web_search (Jina+DDG)   ├── IndexedDB (Dexie): 会话 / 消息 / 附件
├── web_fetch  (Jina)       └── LocalStorage: 设置 + API key
└── 文档解析（pdf/docx/xlsx 浏览器侧，懒加载）
```

## 测试

```bash
cp .env.example .env
npm test          # 21 个真实 API 端到端测试
```

测试不 mock 任何外部调用，覆盖 router / SSE / adapter / 工具 / agent loop / 多轮上下文 / 长上下文事实提取 / prompt caching 命中 / thinking 预算 sweep。

## 隐私 / 安全

- **API key 只存在你浏览器 LocalStorage**（明文），清缓存即失。只发送给你自己配的 endpoint。
- **无后端、无埋点、无 telemetry**。纯静态站。
- 上传的文档在浏览器里解析，模型看到的内容跟你拖进去的一致。
- production build 是纯静态 HTML/JS。

## License

MIT — 见 [LICENSE](./LICENSE)
