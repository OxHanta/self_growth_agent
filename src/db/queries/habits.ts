import { db } from '../client';
import { habits, habitLogs } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getAllHabits() {
  return db.select().from(habits);
}

export async function getHabitByName(name: string) {
  const results = await db
    .select()
    .from(habits)
    .where(eq(habits.name, name))
    .limit(1);
  return results[0] ?? null;
}

export async function createHabit(
  name: string,
  category: 'financial' | 'health' | 'other' = 'other',
  targetFrequency: string = 'daily'
) {
  const [habit] = await db
    .insert(habits)
    .values({ name, category, targetFrequency })
    .returning();
  return habit;
}

export async function logHabitCompletion(habitId: number, note?: string) {
  const today = new Date().toISOString().split('T')[0];

  // Upsert: if already logged today, skip
  const existing = await db
    .select()
    .from(habitLogs)
    .where(eq(habitLogs.habitId, habitId))
    .orderBy(desc(habitLogs.loggedAt))
    .limit(1);

  if (existing[0]?.date === today) {
    return { alreadyLogged: true, habit: await db.select().from(habits).where(eq(habits.id, habitId)).limit(1).then(r => r[0]) };
  }

  await db.insert(habitLogs).values({ habitId, date: today, completed: true, note });

  // Recalculate streak
  const habit = await db.select().from(habits).where(eq(habits.id, habitId)).limit(1).then(r => r[0]);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];

  const newStreak = habit.lastCompleted === yStr || habit.lastCompleted === today
    ? (habit.streak || 0) + 1
    : 1;

  const [updated] = await db
    .update(habits)
    .set({ streak: newStreak, lastCompleted: today })
    .where(eq(habits.id, habitId))
    .returning();

  return { alreadyLogged: false, habit: updated };
}

export async function getUnloggedHabitsToday() {
  const today = new Date().toISOString().split('T')[0];
  const allHabits = await db.select().from(habits);

  const loggedToday = await db
    .select()
    .from(habitLogs)
    .where(eq(habitLogs.date, today));

  const loggedIds = new Set(loggedToday.map(l => l.habitId));
  return allHabits.filter(h => !loggedIds.has(h.id));
}
