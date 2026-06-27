import { db } from '../client';
import { agentPreferences } from '../schema';
import { eq, and } from 'drizzle-orm';

export interface Preference {
    key: string;
    rule: string;
}

/**
 * All currently-active user preferences, oldest first. Injected into the brain
 * prompt on every message so the agent never forgets a stated rule.
 */
export async function getActivePreferences(): Promise<Preference[]> {
    try {
        const rows = await db
            .select()
            .from(agentPreferences)
            .where(eq(agentPreferences.active, true));
        return rows.map(r => ({ key: r.key, rule: r.rule }));
    } catch (err) {
        console.warn('[preferences] getActivePreferences failed:', (err as Error).message);
        return [];
    }
}

/**
 * Create or reactivate a preference. If a row with this key exists (even if
 * previously deactivated), it's restored + its rule text updated.
 */
export async function setPreference(key: string, rule: string): Promise<void> {
    key = key.trim().toLowerCase();
    rule = rule.trim();
    if (!key || !rule) return;
    try {
        // upsert by unique key
        const existing = await db
            .select()
            .from(agentPreferences)
            .where(eq(agentPreferences.key, key))
            .limit(1);
        if (existing.length > 0) {
            await db
                .update(agentPreferences)
                .set({ rule, active: true, updatedAt: new Date() })
                .where(eq(agentPreferences.id, existing[0].id));
        } else {
            await db.insert(agentPreferences).values({ key, rule });
        }
    } catch (err) {
        console.warn('[preferences] setPreference failed:', (err as Error).message);
    }
}

/**
 * Deactivate a preference by key (kept in history, but no longer enforced).
 */
export async function removePreference(key: string): Promise<boolean> {
    key = key.trim().toLowerCase();
    try {
        const existing = await db
            .select()
            .from(agentPreferences)
            .where(eq(agentPreferences.key, key))
            .limit(1);
        if (existing.length === 0) return false;
        await db
            .update(agentPreferences)
            .set({ active: false, updatedAt: new Date() })
            .where(eq(agentPreferences.id, existing[0].id));
        return true;
    } catch (err) {
        console.warn('[preferences] removePreference failed:', (err as Error).message);
        return false;
    }
}

/**
 * Helper for tests/debugging: list ALL preferences including inactive ones.
 */
export async function getAllPreferences() {
    try {
        return await db.select().from(agentPreferences);
    } catch {
        return [];
    }
}
