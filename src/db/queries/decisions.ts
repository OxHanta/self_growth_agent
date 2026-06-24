import { db } from '../client';
import { decisions } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function logDecision(
  category: string,
  question: string,
  contextGiven: string | undefined,
  adviceGiven: string
) {
  const [d] = await db
    .insert(decisions)
    .values({ category, question, contextGiven, adviceGiven })
    .returning();
  return d;
}

export async function getRecentDecisions(limit = 5) {
  return db.select().from(decisions).orderBy(desc(decisions.createdAt)).limit(limit);
}

export async function updateDecisionOutcome(id: number, outcome: string) {
  const [d] = await db
    .update(decisions)
    .set({ outcome })
    .where(eq(decisions.id, id))
    .returning();
  return d;
}
