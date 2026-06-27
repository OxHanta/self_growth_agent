import { db } from '../client';
import { mentalExercisesSent } from '../schema';
import { desc, gte } from 'drizzle-orm';

export type ExerciseType = 'cognitive' | 'reflective' | 'physical';
export type ExerciseDifficulty = 'easy' | 'medium' | 'hard';

export interface ExerciseRecord {
  exerciseType: ExerciseType;
  contentSummary: string;
  fullContent: string;
  difficulty: ExerciseDifficulty | null;
  sentAt: Date;
}

export async function logExerciseSent(
  exerciseType: ExerciseType,
  contentSummary: string,
  fullContent: string,
  difficulty?: ExerciseDifficulty
) {
  const [e] = await db
    .insert(mentalExercisesSent)
    .values({ exerciseType, contentSummary, fullContent, difficulty: difficulty ?? null })
    .returning();
  return e;
}

/** Returns exercises sent within the last N days to avoid repeats */
export async function getRecentExercises(days = 30): Promise<ExerciseRecord[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = await db
    .select()
    .from(mentalExercisesSent)
    .where(gte(mentalExercisesSent.sentAt, cutoff))
    .orderBy(desc(mentalExercisesSent.sentAt));
  return rows.map(r => ({
    exerciseType: r.exerciseType as ExerciseType,
    contentSummary: r.contentSummary,
    fullContent: r.fullContent,
    difficulty: (r.difficulty as ExerciseDifficulty | null) ?? null,
    sentAt: r.sentAt,
  }));
}
