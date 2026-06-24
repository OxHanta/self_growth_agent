import { db } from '../client';
import { tasks } from '../schema';
import { eq } from 'drizzle-orm';

export async function createTask(description: string, deadline?: Date) {
  const [task] = await db
    .insert(tasks)
    .values({ description, deadline: deadline ?? null })
    .returning();
  return task;
}

export async function getPendingTasks() {
  return db.select().from(tasks).where(eq(tasks.status, 'pending'));
}

export async function deferTask(taskId: number) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return null;
  const [updated] = await db
    .update(tasks)
    .set({ timesDeferred: task.timesDeferred + 1, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();
  return updated;
}

export async function completeTask(taskId: number) {
  const [updated] = await db
    .update(tasks)
    .set({ status: 'done', updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();
  return updated;
}

export async function cancelTask(taskId: number) {
  const [updated] = await db
    .update(tasks)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();
  return updated;
}
