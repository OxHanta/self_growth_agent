import { db } from '../client';
import { sheetConfig } from '../schema';
import { eq } from 'drizzle-orm';

export async function getAllSheets() {
  return db.select().from(sheetConfig);
}

export async function getSheetByName(friendlyName: string) {
  const results = await db
    .select()
    .from(sheetConfig)
    .where(eq(sheetConfig.friendlyName, friendlyName))
    .limit(1);
  return results[0] ?? null;
}

export async function upsertSheet(
  friendlyName: string,
  sheetId: string,
  tabName: string,
  purpose: 'read' | 'write' | 'both' = 'both'
) {
  const existing = await getSheetByName(friendlyName);
  if (existing) {
    const [s] = await db
      .update(sheetConfig)
      .set({ sheetId, tabName, purpose })
      .where(eq(sheetConfig.id, existing.id))
      .returning();
    return s;
  }
  const [s] = await db.insert(sheetConfig).values({ friendlyName, sheetId, tabName, purpose }).returning();
  return s;
}
