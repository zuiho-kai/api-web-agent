# api-web-agent

> 0 后端、自带 API key、多 provider 的浏览器侧 AI Agent 平台。

**中文** · [English](./README.en.md)

接任意 OpenAI 兼容或 Anthropic 原生接口，给模型真实工具（联网搜索、抓网页、读文档），看它思考 + 执行——你的 API key 只在你浏览器里，只发给你自己选的 LLM provider。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)

## 亮点

<img width="1920" height="878" alt="image" src="https://github.com/user-attachments/assets/1a889eff-3c23-4aa8-ac33-f8f1d7406baa" />

- **双 adapter + 自动路由**：model 名前缀 `claude-*` 走 Anthropic `/v1/messages`（原生 tool_use SSE、`cache_control` 缓存、extended thinking budget）；其余（`gpt-*` / `grok-*` / `deepseek-*` / `kimi-*` / `qwen-*` ...）走 OpenAI `/v1/chat/completions`（`tool_calls.delta` 累积、`reasoning_effort` 含 Codex 扩展 `xhigh`）。
- **客户端 function calling** —— 工具实现完全在你浏览器里，不依赖各家 hosted tools。
- **内置 3 类工具，零额外 key**：
  - `web_search` —— Jina Reader + DuckDuckGo HTML
  - `web_fetch` —— Jina Reader
  - 文档上传：PDF（pdf.js）/ DOCX（mammoth）/ XLSX（SheetJS），浏览器侧解析
- **流式 UI**：Markdown + 代码高亮、工具调用卡片、可折叠的思考过程面板（实时显示模型推理）。
- **5 档思考等级**（关闭/低/中/高/超高），自动翻译成 Anthropic `budget_tokens` 或 OpenAI `reasoning_effort`。
- **Anthropic prompt caching** 3-breakpoint pattern（system / tools 末尾 / messages 末尾），跟 Claude Code 一致。
- **持久化**：IndexedDB（会话 + 消息 + 附件，Dexie 封装）+ LocalStorage（provider 配置 + 当前 model + 思考等级）。
- **部署到任何静态托管**：Cloudflare Pages / Vercel / GitHub Pages / Netlify / S3。

## 快速开始

```bash
git clone https://github.com/zuiho-kai/api-web-agent.git
cd api-web-agent
npm install
npm run dev
```

打开 `http://localhost:5173/`。首次启动会自动弹出设置面板，至少添加一个 provider：

| 字段 | 例 |
|---|---|
| **名称** | `My OpenAI` |
| **Base URL** | `https://api.openai.com`（或任意 OpenAI 兼容 / Anthropic 原生接口，不含 `/v1`）|
| **API Key** | `sk-…` |
| **协议** | 自动（推荐）—— 由 model 名前缀决定 |

然后在顶部下拉里选预设 model（Claude 4.6/4.7、GPT-5.x、Grok-4.x）或手输任意 model 名。开始对话。

## 内置模型预设

| 家族 | Models |
|---|---|
| Claude | Opus 4.7 / 4.6（+ thinking）· Sonnet 4.6（+ thinking）· Haiku 4.5 |
| GPT    | GPT-5.5 · GPT-5.4 · GPT-5.3 Codex |
| Grok   | Grok 4 · Grok 4 Heavy · Grok 4（thinking）· Grok 4.1 Fast |

自定义 model 名也行——输任意字符串，adapter 按前缀自动路由。

## 架构

```
React UI ── Zustand store ── Agent loop ─┬─ Anthropic adapter (/v1/messages)
                                         └─ OpenAI adapter    (/v1/chat/completions)

工具（客户端）              存储
├── web_search (Jina+DDG)   ├── IndexedDB (Dexie): 会话 / 消息 / 附件
├── web_fetch  (Jina)       └── LocalStorage: 设置 + API key
└── 文档解析（pdf/docx/xlsx 浏览器侧）
```

## 构建 & 部署

```bash
npm run build      # 输出到 dist/
npm run preview    # 本地预览构建产物
npm run typecheck
```

`public/_headers` 文件预设了 `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin`（为后续 WebContainers 集成预留）。Cloudflare Pages / Vercel 等托管会自动识别。

## 测试

```bash
cp .env.example .env       # 填好 PROXY_BASE_URL + 两个 key
npm test                   # 21 个真实 API 端到端测试
```

测试不 mock 任何外部调用，覆盖：

- Router model 名 → 协议路由
- SSE 解析（Anthropic event/data + OpenAI data-only）
- Adapter tool 调用累积
- Web search 工具真实 fetch
- Agent loop 端到端（如「今天东京天气怎么样」）
- 多轮上下文保留（3 条协议路径）
- 长上下文从 4KB 文档中提取 6 个事实
- Prompt caching `cache_read` 实测
- Thinking budget sweep + `reasoning_effort` 含 `xhigh`

## 隐私 / 安全模型

- **你的 API key 只存在浏览器 LocalStorage**（明文）。清除站点数据即失。仅发送给你配置的 endpoint，不会发到任何其它服务器。
- **无后端**、无埋点、无 telemetry。纯静态站。
- 上传的文档在你浏览器里解析后内联到下一条消息。原始字节可选持久化到 OPFS（Origin Private File System），跨会话复用。
- dev server 会发 COOP/COEP headers，生产构建是纯静态 HTML/JS。

## License

MIT —— 见 [LICENSE](./LICENSE)
