import Dexie, { type EntityTable } from 'dexie';
import type { ChatContentBlock, AssistantToolCall } from '@/providers/base';

export interface ConversationRow {
  id: string;
  title: string;
  modeId: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  order: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ChatContentBlock[];
  tool_call_id?: string;
  tool_calls?: AssistantToolCall[];
  createdAt: number;
}

export interface AttachmentRow {
  id: string;
  conversationId: string;
  name: string;
  mime: string;
  parsedText: string;
  meta?: Record<string, unknown>;
  createdAt: number;
}

export class AgentDB extends Dexie {
  conversations!: EntityTable<ConversationRow, 'id'>;
  messages!: EntityTable<MessageRow, 'id'>;
  attachments!: EntityTable<AttachmentRow, 'id'>;

  constructor() {
    super('api-web-agent');
    this.version(1).stores({
      conversations: 'id, updatedAt, modeId',
      messages: 'id, conversationId, [conversationId+order]',
      attachments: 'id, conversationId',
    });
  }
}

export const db = new AgentDB();

export function uuid(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}
