import { db } from '../client';
import { conversationMessages } from '../schema';
import { eq, desc, asc } from 'drizzle-orm';

const HISTORY_LIMIT = 20;

export type ConversationRole = 'user' | 'assistant';

export async function getConversationHistory(userId: number): Promise<Array<{ role: ConversationRole; content: string }>> {
  // Fetch last N messages ordered oldest-first for correct LLM context
  const rows = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, userId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(HISTORY_LIMIT);

  return rows.reverse().map(r => ({
    role: r.role as ConversationRole,
    content: r.content,
  }));
}

export async function appendMessage(userId: number, role: ConversationRole, content: string) {
  await db.insert(conversationMessages).values({ userId, role, content });
}

export async function clearConversationHistory(userId: number) {
  const { sql } = await import('drizzle-orm');
  await db.delete(conversationMessages).where(eq(conversationMessages.userId, userId));
}
