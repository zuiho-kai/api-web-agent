import type { ChatMessage } from '@/providers/base';
import { db, uuid, type ConversationRow, type MessageRow } from './db';

export async function createConversation(modeId = 'chat', title = '新对话'): Promise<ConversationRow> {
  const now = Date.now();
  const row: ConversationRow = { id: uuid(), title, modeId, createdAt: now, updatedAt: now };
  await db.conversations.add(row);
  return row;
}

export async function listConversations(): Promise<ConversationRow[]> {
  return db.conversations.orderBy('updatedAt').reverse().toArray();
}

export async function deleteConversation(id: string): Promise<void> {
  await db.transaction('rw', db.conversations, db.messages, db.attachments, async () => {
    await db.conversations.delete(id);
    await db.messages.where('conversationId').equals(id).delete();
    await db.attachments.where('conversationId').equals(id).delete();
  });
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  await db.conversations.update(id, { title, updatedAt: Date.now() });
}

export async function getMessages(conversationId: string): Promise<MessageRow[]> {
  return db.messages.where({ conversationId }).sortBy('order');
}

export async function appendMessage(
  conversationId: string,
  msg: ChatMessage,
): Promise<MessageRow> {
  const last = await db.messages
    .where('conversationId')
    .equals(conversationId)
    .reverse()
    .sortBy('order');
  const order = (last[0]?.order ?? -1) + 1;
  const row: MessageRow = {
    id: uuid(),
    conversationId,
    order,
    role: msg.role,
    content: msg.content,
    tool_call_id: msg.tool_call_id,
    tool_calls: msg.tool_calls,
    createdAt: Date.now(),
  };
  await db.transaction('rw', db.messages, db.conversations, async () => {
    await db.messages.add(row);
    await db.conversations.update(conversationId, { updatedAt: Date.now() });
  });
  return row;
}

export async function replaceMessage(id: string, patch: Partial<MessageRow>): Promise<void> {
  await db.messages.update(id, patch);
}

export function messageRowToChatMessage(row: MessageRow): ChatMessage {
  return {
    role: row.role,
    content: row.content,
    tool_call_id: row.tool_call_id,
    tool_calls: row.tool_calls,
  };
}
