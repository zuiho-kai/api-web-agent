import { create } from 'zustand';
import type { ChatContentBlock, ChatMessage, ProviderConfig } from '@/providers/base';
import { buildAdapter } from '@/providers/router';
import { isVisionCapable, supportsNativePDF } from '@/providers/preset-models';
import { runAgent, type AgentEvent } from '@/agent/loop';
import { createDefaultRegistry } from '@/tools/builtin';
import { chatMode } from '@/modes/chat';
import { parseDocument, type ParsedDocument } from '@/runtime/doc-parsers';
import { fileToBase64, renderPdfPagesAsImages } from '@/runtime/doc-parsers/pdf';
import {
  appendMessage,
  createConversation,
  deleteConversation as dbDeleteConversation,
  getMessages,
  listConversations,
  messageRowToChatMessage,
  replaceMessage,
  updateConversationTitle,
} from '@/storage/conversations';
import { db, uuid, type ConversationRow, type MessageRow } from '@/storage/db';
import { loadSettings, removeProvider, saveSettings, upsertProvider, type AppSettings } from '@/storage/settings';

export interface UIMessage {
  rowId: string;
  role: ChatMessage['role'];
  content: string | ChatContentBlock[];
  tool_calls?: ChatMessage['tool_calls'];
  tool_call_id?: ChatMessage['tool_call_id'];
  streaming?: boolean;
  toolExecs?: Record<string, { name: string; status: 'running' | 'done' | 'error'; result?: string; input?: Record<string, unknown> }>;
  thinking?: string;
}

interface AppState {
  settings: AppSettings;
  conversations: ConversationRow[];
  activeId: string | null;
  messages: UIMessage[];
  isStreaming: boolean;
  abortController: AbortController | null;
  settingsOpen: boolean;

  init(): Promise<void>;
  newConversation(): Promise<void>;
  selectConversation(id: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  sendMessage(text: string, attachments?: File[]): Promise<void>;
  stop(): void;
  updateSettings(patch: Partial<AppSettings>): void;
  addOrUpdateProvider(p: ProviderConfig): void;
  removeProviderById(id: string): void;
  openSettings(): void;
  closeSettings(): void;
}

const registry = createDefaultRegistry();

export const useStore = create<AppState>((set, get) => ({
  settings: loadSettings(),
  conversations: [],
  activeId: null,
  messages: [],
  isStreaming: false,
  abortController: null,
  settingsOpen: false,

  async init() {
    const convs = await listConversations();
    set({ conversations: convs });
    if (convs.length > 0 && !get().activeId) {
      await get().selectConversation(convs[0].id);
    }
  },

  async newConversation() {
    const c = await createConversation('chat');
    set((s) => ({ conversations: [c, ...s.conversations], activeId: c.id, messages: [] }));
  },

  async selectConversation(id) {
    const rows = await getMessages(id);
    set({ activeId: id, messages: rows.map(rowToUI) });
  },

  async deleteConversation(id) {
    await dbDeleteConversation(id);
    const convs = await listConversations();
    set((s) => ({
      conversations: convs,
      activeId: s.activeId === id ? convs[0]?.id ?? null : s.activeId,
      messages: s.activeId === id ? [] : s.messages,
    }));
    if (get().activeId && get().activeId !== id) {
      await get().selectConversation(get().activeId!);
    } else if (convs[0]) {
      await get().selectConversation(convs[0].id);
    }
  },

  async sendMessage(text, attachments = []) {
    const { settings } = get();
    const provider = settings.providers.find((p) => p.id === settings.activeProviderId);
    if (!provider) {
      alert('请先在设置里添加一个 Provider');
      return;
    }
    if (!settings.activeModel) {
      alert('请在设置里选一个模型');
      return;
    }

    let convId = get().activeId;
    if (!convId) {
      const c = await createConversation('chat', text.slice(0, 30) || '新对话');
      convId = c.id;
      set((s) => ({ conversations: [c, ...s.conversations], activeId: c.id }));
    }

    // Attachment dispatch — route by file type × model capability:
    //   image/*           → image_url block (vision model required)
    //   PDF + Claude      → document block, raw base64 (Anthropic native)
    //   PDF + GPT vision  → render pages → image_url blocks
    //   PDF + other       → pdfjs text extraction (fallback)
    //   docx/xlsx/txt/md  → parser → text injection
    const visionOK = isVisionCapable(settings.activeModel);
    const nativePDF = supportsNativePDF(settings.activeModel);

    const parsedDocs: ParsedDocument[] = [];
    const imageBlocks: ChatContentBlock[] = [];
    const documentBlocks: ChatContentBlock[] = [];

    for (const f of attachments) {
      try {
        const isImage = f.type.startsWith('image/');
        const isPDF = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

        if (isImage) {
          if (!visionOK) {
            console.warn(`Image "${f.name}" skipped — model ${settings.activeModel} is not vision-capable.`);
            continue;
          }
          const dataUrl = await fileToDataUrl(f);
          imageBlocks.push({ type: 'image_url', image_url: { url: dataUrl } });
          await db.attachments.add({
            id: uuid(),
            conversationId: convId,
            name: f.name,
            mime: f.type,
            parsedText: '',
            meta: { kind: 'image', dataUrl },
            createdAt: Date.now(),
          });
        } else if (isPDF && nativePDF) {
          const b64 = await fileToBase64(f);
          documentBlocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: b64 },
            name: f.name,
          });
          await db.attachments.add({
            id: uuid(),
            conversationId: convId,
            name: f.name,
            mime: 'application/pdf',
            parsedText: '',
            meta: { kind: 'pdf-native' },
            createdAt: Date.now(),
          });
        } else if (isPDF && visionOK) {
          const pages = await renderPdfPagesAsImages(f, 20);
          for (const url of pages) {
            imageBlocks.push({ type: 'image_url', image_url: { url } });
          }
          await db.attachments.add({
            id: uuid(),
            conversationId: convId,
            name: f.name,
            mime: 'application/pdf',
            parsedText: '',
            meta: { kind: 'pdf-rendered', pageCount: pages.length },
            createdAt: Date.now(),
          });
        } else {
          const p = await parseDocument(f);
          parsedDocs.push(p);
          await db.attachments.add({
            id: uuid(),
            conversationId: convId,
            name: p.name,
            mime: p.mime,
            parsedText: p.text,
            meta: { ...(p.meta ?? {}), kind: 'doc' },
            createdAt: Date.now(),
          });
        }
      } catch (e) {
        console.error('attachment failed', e);
      }
    }

    // Build user message content. Pure-text fast path stays as a string;
    // mixed paths (with images / documents) use a content-block array.
    const textPart = parsedDocs.length > 0
      ? `${parsedDocs.map((d) => `<document name="${d.name}">\n${d.text}\n</document>`).join('\n\n')}\n\n${text}`.trim()
      : text;

    const nonTextBlocks = [...documentBlocks, ...imageBlocks];
    let userContent: string | ChatContentBlock[];
    if (nonTextBlocks.length > 0) {
      const blocks: ChatContentBlock[] = [...nonTextBlocks];
      if (textPart) blocks.push({ type: 'text', text: textPart });
      userContent = blocks;
    } else {
      userContent = textPart;
    }

    const userMsg: ChatMessage = { role: 'user', content: userContent };
    const userRow = await appendMessage(convId, userMsg);

    // Title from first user message
    const allMsgs = await getMessages(convId);
    if (allMsgs.filter((m) => m.role === 'user').length === 1) {
      const title = (text || parsedDocs.map((d) => d.name).join(', ') || '新对话').slice(0, 40);
      await updateConversationTitle(convId, title);
      const convs = await listConversations();
      set({ conversations: convs });
    }

    set((s) => ({ messages: [...s.messages, rowToUI(userRow)] }));

    // Build full chat history for the agent
    const historyRows = await getMessages(convId);
    const historyMsgs = historyRows.map(messageRowToChatMessage);

    // Start streaming
    const abort = new AbortController();
    set({ isStreaming: true, abortController: abort });

    const adapter = buildAdapter(provider, settings.activeModel);
    const system = chatMode.buildSystemPrompt();

    // Placeholder assistant message
    const assistantRowId = uuid();
    const placeholderRow: MessageRow = {
      id: assistantRowId,
      conversationId: convId,
      order: (historyRows[historyRows.length - 1]?.order ?? 0) + 1,
      role: 'assistant',
      content: [],
      createdAt: Date.now(),
    };
    await db.messages.add(placeholderRow);
    set((s) => ({ messages: [...s.messages, { rowId: assistantRowId, role: 'assistant', content: [], streaming: true, toolExecs: {}, thinking: '' }] }));

    let accumulatedText = '';
    let accumulatedThinking = '';
    const assistantBlocks: ChatContentBlock[] = [];
    const toolExecs: NonNullable<UIMessage['toolExecs']> = {};

    try {
      const stream = runAgent({
        adapter,
        registry,
        request: {
          model: settings.activeModel,
          messages: historyMsgs,
          system,
          thinking: settings.thinkingLevel,
        },
        signal: abort.signal,
      });

      for await (const ev of stream) {
        handleAgentEvent(ev, {
          onText: (t) => {
            accumulatedText += t;
            updateAssistantUI(assistantRowId, accumulatedText, toolExecs, accumulatedThinking, true);
          },
          onThinking: (t) => {
            accumulatedThinking += t;
            updateAssistantUI(assistantRowId, accumulatedText, toolExecs, accumulatedThinking, true);
          },
          onToolUseStop: (id, name, input) => {
            assistantBlocks.push({ type: 'tool_use', id, name, input });
          },
          onTextFinalized: () => {
            if (accumulatedText) {
              assistantBlocks.push({ type: 'text', text: accumulatedText });
              accumulatedText = '';
            }
          },
          onToolExecStart: (id, name, input) => {
            toolExecs[id] = { name, status: 'running', input };
            updateAssistantUI(assistantRowId, currentText(assistantBlocks), toolExecs, accumulatedThinking, true);
          },
          onToolExecDone: (id, _name, content, isError) => {
            const prev = toolExecs[id] ?? { name: '', status: 'running', input: {} };
            toolExecs[id] = { ...prev, status: isError ? 'error' : 'done', result: content };
            updateAssistantUI(assistantRowId, currentText(assistantBlocks), toolExecs, accumulatedThinking, true);
          },
          onError: (msg) => {
            accumulatedText += `\n\n[Error: ${msg}]`;
            updateAssistantUI(assistantRowId, accumulatedText, toolExecs, accumulatedThinking, true);
          },
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      // Finalize: build content blocks
      if (accumulatedText) assistantBlocks.push({ type: 'text', text: accumulatedText });
      const finalContent: string | ChatContentBlock[] =
        assistantBlocks.length === 1 && assistantBlocks[0].type === 'text'
          ? assistantBlocks[0].text
          : assistantBlocks;
      await replaceMessage(assistantRowId, { content: finalContent });
      set((s) => ({
        isStreaming: false,
        abortController: null,
        messages: s.messages.map((m) =>
          m.rowId === assistantRowId
            ? { ...m, content: finalContent, streaming: false, toolExecs, thinking: accumulatedThinking || undefined }
            : m,
        ),
      }));
    }

    function currentText(blocks: ChatContentBlock[]): string {
      const accumulated = accumulatedText;
      const fromBlocks = blocks
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return fromBlocks + accumulated;
    }

    function updateAssistantUI(
      rowId: string,
      text: string,
      execs: NonNullable<UIMessage['toolExecs']>,
      thinking: string,
      streaming: boolean,
    ) {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.rowId === rowId
            ? { ...m, content: text, toolExecs: { ...execs }, thinking: thinking || undefined, streaming }
            : m,
        ),
      }));
    }
  },

  stop() {
    get().abortController?.abort();
  },

  updateSettings(patch) {
    const next = { ...get().settings, ...patch };
    saveSettings(next);
    set({ settings: next });
  },

  addOrUpdateProvider(p) {
    const next = upsertProvider(get().settings, p);
    saveSettings(next);
    set({ settings: next });
  },

  removeProviderById(id) {
    const next = removeProvider(get().settings, id);
    saveSettings(next);
    set({ settings: next });
  },

  openSettings() {
    set({ settingsOpen: true });
  },
  closeSettings() {
    set({ settingsOpen: false });
  },
}));

interface EventHandlers {
  onText(t: string): void;
  onThinking(t: string): void;
  onToolUseStop(id: string, name: string, input: Record<string, unknown>): void;
  onTextFinalized(): void;
  onToolExecStart(id: string, name: string, input: Record<string, unknown>): void;
  onToolExecDone(id: string, name: string, content: string, isError?: boolean): void;
  onError(msg: string): void;
}

function handleAgentEvent(ev: AgentEvent, h: EventHandlers): void {
  switch (ev.type) {
    case 'text_delta':
      h.onText(ev.text);
      break;
    case 'thinking_delta':
      h.onThinking(ev.text);
      break;
    case 'tool_use_stop':
      h.onToolUseStop(ev.id, ev.name, ev.input);
      h.onTextFinalized();
      break;
    case 'tool_exec_start':
      h.onToolExecStart(ev.id, ev.name, ev.input);
      break;
    case 'tool_exec_done':
      h.onToolExecDone(ev.id, ev.name, ev.content, ev.is_error);
      break;
    case 'error':
      h.onError(ev.message);
      break;
    default:
      break;
  }
}

function rowToUI(row: MessageRow): UIMessage {
  return {
    rowId: row.id,
    role: row.role,
    content: row.content,
    tool_calls: row.tool_calls,
    tool_call_id: row.tool_call_id,
  };
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}
