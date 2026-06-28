import { db } from '../client';
import { userProfiles } from '../schema';
import { eq } from 'drizzle-orm';

export interface UserProfile {
  userId: number;
  name: string | null;
  onboarded: boolean;
  goals: string[];
  focusAreas: string[];
  contextNotes: string | null;
  onboardedAt: Date | null;
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Get a user's profile, or null if they don't have one yet (first contact). */
export async function getProfile(userId: number): Promise<UserProfile | null> {
  try {
    const rows = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.userId,
      name: row.name ?? null,
      onboarded: row.onboarded,
      goals: parseList(row.goals),
      focusAreas: parseList(row.focusAreas),
      contextNotes: row.contextNotes ?? null,
      onboardedAt: row.onboardedAt ?? null,
    };
  } catch (err) {
    console.warn('[profile] getProfile failed:', (err as Error).message);
    return null;
  }
}

/** Create an empty profile for a new user (onboarding will fill it in). Safe to repeat. */
export async function ensureProfile(userId: number): Promise<UserProfile> {
  const existing = await getProfile(userId);
  if (existing) return existing;
  try {
    await db.insert(userProfiles).values({ userId });
  } catch (err) {
    // Race / unique constraint — re-fetch.
    const retry = await getProfile(userId);
    if (retry) return retry;
    console.warn('[profile] ensureProfile failed:', (err as Error).message);
  }
  return {
    userId,
    name: null,
    onboarded: false,
    goals: [],
    focusAreas: [],
    contextNotes: null,
    onboardedAt: null,
  };
}

export async function isOnboarded(userId: number): Promise<boolean> {
  const profile = await getProfile(userId);
  return Boolean(profile?.onboarded);
}

/** Patch a profile with newly learned fields (from the UPDATE_PROFILE action). */
export async function updateProfile(
  userId: number,
  fields: {
    name?: string;
    goals?: string[];
    focusAreas?: string[];
    contextNotes?: string;
  }
): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) {
    console.warn('[profile] updateProfile: no profile for user', userId);
    return;
  }
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.name !== undefined) set.name = fields.name.trim().slice(0, 100) || null;
  // Merge list fields rather than overwrite (accumulate during onboarding + after).
  if (fields.goals !== undefined) {
    const merged = Array.from(new Set([...fields.goals, ...profile.goals])).slice(0, 30);
    set.goals = JSON.stringify(merged);
  }
  if (fields.focusAreas !== undefined) {
    const merged = Array.from(new Set([...fields.focusAreas, ...profile.focusAreas])).slice(0, 20);
    set.focusAreas = JSON.stringify(merged);
  }
  if (fields.contextNotes !== undefined) {
    // Append notes rather than overwrite (cap length to avoid runaway growth).
    const combined = [profile.contextNotes, fields.contextNotes].filter(Boolean).join(' ');
    set.contextNotes = combined.slice(-2000);
  }
  try {
    await db.update(userProfiles).set(set).where(eq(userProfiles.userId, userId));
  } catch (err) {
    console.warn('[profile] updateProfile failed:', (err as Error).message);
  }
}

/** Mark onboarding complete. */
export async function markOnboarded(userId: number): Promise<void> {
  try {
    await db
      .update(userProfiles)
      .set({ onboarded: true, onboardedAt: new Date(), updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
    console.log(`[profile] User ${userId} onboarded.`);
  } catch (err) {
    console.warn('[profile] markOnboarded failed:', (err as Error).message);
  }
}
