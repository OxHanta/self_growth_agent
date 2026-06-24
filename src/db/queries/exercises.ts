import { db } from '../client';
import { mentalExercisesSent } from '../schema';
import { desc, gte } from 'drizzle-orm';

export async function logExerciseSent(
  exerciseType: 'cognitive' | 'reflective',
  contentSummary: string,
  fullContent: string
) {
  const [e] = await db
    .insert(mentalExercisesSent)
    .values({ exerciseType, contentSummary, fullContent })
    .returning();
  return e;
}

/** Returns exercises sent within the last N days to avoid repeats */
export async function getRecentExercises(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return db
    .select()
    .from(mentalExercisesSent)
    .where(gte(mentalExercisesSent.sentAt, cutoff))
    .orderBy(desc(mentalExercisesSent.sentAt));
}
