import { db } from '../client';
import { reminders } from '../schema';
import { eq, lte, and } from 'drizzle-orm';

export async function createReminder(text: string, scheduledTime: Date) {
  const [r] = await db.insert(reminders).values({ text, scheduledTime }).returning();
  return r;
}

export async function getPendingReminders() {
  return db.select().from(reminders).where(eq(reminders.status, 'pending'));
}

export async function getDueReminders() {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, 'pending'), lte(reminders.scheduledTime, new Date())));
}

export async function markReminderSent(id: number) {
  const [r] = await db
    .update(reminders)
    .set({ status: 'sent' })
    .where(eq(reminders.id, id))
    .returning();
  return r;
}

export async function cancelReminder(id: number) {
  const [r] = await db
    .update(reminders)
    .set({ status: 'cancelled' })
    .where(eq(reminders.id, id))
    .returning();
  return r;
}
