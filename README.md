# api-web-agent

> A 0-backend, BYO-key, multi-provider AI agent platform that runs entirely in your browser.

Connect to any OpenAI-compatible or Anthropic-native endpoint, give the model real tools (web search, web fetch, document reading), and watch it think and act — all without sending your API keys to anyone but the LLM provider you choose.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)

## Highlights

- **Dual adapter with auto-routing**: model names starting with `claude-*` route to the Anthropic `/v1/messages` protocol (native tool_use SSE, prompt caching with `cache_control`, extended thinking budget). Everything else (`gpt-*`, `grok-*`, `deepseek-*`, `kimi-*`, `qwen-*`, …) routes to the OpenAI `/v1/chat/completions` protocol (`tool_calls.delta` accumulation, `reasoning_effort` including the Codex `xhigh` extension).
- **Client-side function calling** — your tools, your runtime. No dependency on provider-hosted tools or vendor-specific APIs.
- **Built-in tools (zero external API keys required)**:
  - `web_search` — Jina Reader + DuckDuckGo HTML
  - `web_fetch` — Jina Reader
  - Document upload: PDF (pdf.js), DOCX (mammoth), XLSX (SheetJS), all parsed in-browser.
- **Streaming UI** with Markdown + code highlight, tool-call cards, and a collapsible thinking panel that streams the model's reasoning in real time.
- **5-level thinking control** (关闭/低/中/高/超高) unified across Anthropic `budget_tokens` and OpenAI `reasoning_effort`.
- **Prompt caching pattern** baked into the Anthropic adapter (3-breakpoint Claude-Code-style: system / tools tail / messages tail).
- **Persistence**: IndexedDB (conversations + messages + attachments) via Dexie, LocalStorage (provider configs + active model + thinking level).
- **Deploy anywhere static**: Cloudflare Pages, Vercel, GitHub Pages, Netlify, or a plain S3 bucket.

## Quick start

```bash
git clone <repo-url> api-web-agent
cd api-web-agent
npm install
npm run dev
```

Open `http://localhost:5173/`. The settings panel opens automatically on first launch — add at least one provider:

| Field | Example |
|---|---|
| **Name** | `My OpenAI` |
| **Base URL** | `https://api.openai.com` (or any OpenAI-compatible / Anthropic-native endpoint, no trailing `/v1`) |
| **API Key** | `sk-…` |
| **Protocol** | Auto (recommended) — let the model-name prefix decide |

Then pick a model from the preset dropdown (Claude 4.6/4.7, GPT-5.x, Grok-4.x) or type any custom model name. Start chatting.

## Built-in model presets

| Family | Models |
|---|---|
| Claude | Opus 4.7 / 4.6 (+ thinking) · Sonnet 4.6 (+ thinking) · Haiku 4.5 |
| GPT    | GPT-5.5 · GPT-5.4 · GPT-5.3 Codex |
| Grok   | Grok 4 · Grok 4 Heavy · Grok 4 (thinking) · Grok 4.1 Fast |

Custom model names work too — just type any string and the adapter routes by prefix.

## Architecture

```
React UI ── Zustand store ── Agent loop ─┬─ Anthropic adapter  (/v1/messages)
                                         └─ OpenAI adapter     (/v1/chat/completions)

Tools (client-side)         Storage
├── web_search (Jina+DDG)   ├── IndexedDB (Dexie): conversations, messages, attachments
├── web_fetch  (Jina)       └── LocalStorage: settings + API keys
└── doc parsers (pdf/docx/xlsx, browser-side)
```

## Build & deploy

```bash
npm run build      # outputs to dist/
npm run preview    # serve dist/ locally
npm run typecheck
```

The `public/_headers` file sets `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin` for Cloudflare Pages, preparing the ground for future WebContainers support.

## Testing

```bash
cp .env.example .env       # then fill in PROXY_BASE_URL + two keys
npm test                   # 21 real-API end-to-end tests
```

Tests hit real provider endpoints (no mocks). They cover:

- Router model-name → protocol detection
- SSE parsing (Anthropic event/data + OpenAI data-only)
- Adapter tool-call accumulation
- Web search tool real fetch
- Agent loop end-to-end (e.g. "What's the weather in Tokyo?")
- Multi-turn context retention across 3 protocol paths
- Long-context fact extraction from a ~4KB document
- Prompt caching `cache_read` measurement
- Thinking budget sweep + `reasoning_effort` including `xhigh`

## Privacy / security model

- **Your API keys live only in your browser's LocalStorage** (plaintext). Clearing site data deletes them. They're sent only to the endpoint you configured — never to any other server.
- **No backend**, no analytics, no telemetry. Static site through and through.
- Documents you upload are parsed in your browser and embedded inline into the next message. The original bytes can also be persisted to OPFS (Origin Private File System) for re-use across sessions.
- The dev server sends COOP/COEP headers but the production build is otherwise plain static HTML/JS.

## License

MIT — see [LICENSE](./LICENSE).
