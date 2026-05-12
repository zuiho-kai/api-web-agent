# api-web-agent

> **Chat as easily as Doubao / ChatGPT, but with your own API key.** A 0-backend, BYO-key, multi-provider AI agent that runs entirely in your browser.

[中文文档](./README.md) · **English**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)

<img width="1920" height="878" alt="screenshot" src="https://github.com/user-attachments/assets/1a889eff-3c23-4aa8-ac33-f8f1d7406baa" />

## Who is this for

**Casual users**: you don't want to sign up for yet another account, install yet another app, or fight a paywall. You already have an OpenAI / Claude / Kimi / DeepSeek key (or a corporate proxy key) — just paste it in and chat. **Skip the monthly subscription, your key, your unlimited usage.**

**Power users**: you want more than just chat — let the model search the web, read your PDFs/Excel/images, see its reasoning, switch providers at will — **without spinning up a server, Docker container, or signing up for anything**. Pure browser.

## 30 seconds to start

1. Open the page (host yourself / run locally — see below)
2. Settings panel auto-opens on first launch. Fill in one provider:
   - **Base URL**: `https://api.openai.com` (or any OpenAI-compatible / Anthropic-native endpoint, no trailing `/v1`)
   - **API Key**: `sk-…` (**stored only in your browser, never sent anywhere except your endpoint**)
3. Pick a model from the preset dropdown (Claude / GPT / Grok) or type any custom name
4. Drag a file / paste an image / start typing → Enter to send

Done.

## Feels like Doubao/ChatGPT, capabilities like Claude Code

- 🗨️ **Chat**: streaming output, Markdown + code highlighting, multi-turn context
- 🔍 **Web search**: the model decides when to search, uses Jina Reader + DuckDuckGo, **zero extra API keys**
- 📄 **Document reading**: drag a PDF / DOCX / XLSX / image, the model reads it natively
  - PDFs go to Claude via the native `document` content block — preserves layout / charts
  - Images go to vision models (Claude 4 / GPT-4o / Grok-4)
  - DOCX parsed as Markdown preserving tables and heading hierarchy
  - XLSX split per-sheet, large sheets auto head + tail truncated
- 🧠 **Visible reasoning**: 5-level thinking budget (off / low / medium / high / xhigh); Claude's thinking streams live in a collapsible panel
- ⚡ **Prompt caching**: Anthropic 3-breakpoint cache pattern, 90% input cost savings on hits
- 💾 **Persistence**: IndexedDB stores all conversations, attachments, settings — closes and reopens
- 🚀 **Zero backend**: pure static SPA, deploy anywhere (Cloudflare Pages / Vercel / GitHub Pages / Netlify / S3)

## Built-in model presets

| Family | Models |
|---|---|
| Claude | Opus 4.7 (default) / 4.6 (+ thinking) · Sonnet 4.6 (+ thinking) · Haiku 4.5 |
| GPT    | GPT-5.5 · GPT-5.4 · GPT-5.3 Codex |
| Grok   | Grok 4 · Grok 4 Heavy · Grok 4 (thinking) · Grok 4.1 Fast |

You can also type any custom model name — **any OpenAI-compatible or Anthropic-native model just works**.

## Run locally / self-host

```bash
git clone https://github.com/zuiho-kai/api-web-agent.git
cd api-web-agent
npm install
npm run dev       # local http://localhost:5173/
```

Build as static artifacts:

```bash
npm run build     # outputs to dist/
npm run preview   # preview the build locally
```

Upload `dist/` to any static host (Cloudflare Pages / Vercel / GitHub Pages / Netlify) and you're done. `public/_headers` already includes COOP/COEP headers for future WebContainers integration.

## Architecture (for the curious)

```
React UI ── Zustand store ── Agent loop ─┬─ Anthropic adapter (/v1/messages)
                                         └─ OpenAI adapter    (/v1/chat/completions)

Auto-routed by model-name prefix:
  claude-*  → Anthropic protocol (native tool_use SSE, cache_control, thinking budget)
  otherwise → OpenAI protocol (tool_calls.delta, reasoning_effort incl. Codex xhigh)

Tools (client-side)        Storage
├── web_search (Jina+DDG)  ├── IndexedDB (Dexie): conversations / messages / attachments
├── web_fetch  (Jina)      └── LocalStorage: settings + API keys
└── doc parsers (pdf/docx/xlsx, lazy-loaded browser-side)
```

## Testing

```bash
cp .env.example .env       # fill in PROXY_BASE_URL + two keys
npm test                   # 21 real-API end-to-end tests
```

No mocks; tests hit real provider endpoints. Coverage: router / SSE parsing / adapter tool-call accumulation / web_search / agent loop / multi-turn context / long-context fact extraction / prompt caching hits / thinking budget sweep.

## Privacy / security

- **Your API key lives only in browser LocalStorage** (plaintext). Clearing site data wipes it. Sent only to the endpoint you configured.
- **No backend, no analytics, no telemetry**. Pure static site.
- Documents you upload are parsed in your browser; the model sees exactly what you dragged in.
- Production build is plain static HTML/JS.

## License

MIT — see [LICENSE](./LICENSE)
