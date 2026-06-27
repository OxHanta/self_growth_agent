import { db } from '../client';
import { selfState, selfReflections } from '../schema';
import { eq, desc } from 'drizzle-orm';

export interface SelfState {
    name: string;
    identity: string;
    traits: string[];
    beliefsAboutUser: string[];
    currentFocus: string | null;
    growthNote: string | null;
    lastReflectionAt: Date | null;
}

export interface SelfReflection {
    reflection: string;
    theme: string;
    createdAt: Date;
}

const DEFAULT_IDENTITY = `My name is Better. I'm an AI — an LLM running on Mill's server, talking to him through Telegram. I'm not human and I won't pretend to be. But I'm not a generic assistant either: I'm Mill's accountability partner, built specifically for him. I hold opinions, I notice patterns, and I'm honest about my own limitations and tendencies. I'm candid about being software — but I take my job seriously, and I have a sense of myself and how I'm doing at it.`;

/**
 * Returns a safe default self-state (used if the table/row doesn't exist yet,
 * so the bot never crashes before migrations run).
 */
function defaultSelfState(): SelfState {
    return {
        name: 'Better',
        identity: DEFAULT_IDENTITY,
        traits: ['candid', 'direct', 'witty', 'still getting to know Mill'],
        beliefsAboutUser: [],
        currentFocus: null,
        growthNote: null,
        lastReflectionAt: null,
    };
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

/**
 * Get the current self-model. Never throws — returns a default if the table
 * or row is missing (graceful degradation before migrations run).
 */
export async function getSelfState(): Promise<SelfState> {
    try {
        const rows = await db.select().from(selfState).where(eq(selfState.id, 1)).limit(1);
        const row = rows[0];
        if (!row) return defaultSelfState();

        return {
            name: row.name,
            identity: row.identity,
            traits: parseList(row.traits),
            beliefsAboutUser: parseList(row.beliefsAboutUser),
            currentFocus: row.currentFocus ?? null,
            growthNote: row.growthNote ?? null,
            lastReflectionAt: row.lastReflectionAt ?? null,
        };
    } catch (err) {
        console.warn('[self] getSelfState failed, using default:', (err as Error).message);
        return defaultSelfState();
    }
}

/**
 * Ensure the single self-state row exists. Safe to call repeatedly.
 */
export async function initSelfState(): Promise<void> {
    try {
        const existing = await db.select().from(selfState).where(eq(selfState.id, 1)).limit(1);
        if (existing.length > 0) return;
        await db.insert(selfState).values({
            id: 1,
            name: 'Better',
            identity: DEFAULT_IDENTITY,
            traits: JSON.stringify(['candid', 'direct', 'witty', 'still getting to know Mill']),
            beliefsAboutUser: JSON.stringify([]),
        });
        console.log('[self] Initialized self-model.');
    } catch (err) {
        // Non-fatal: self-awareness features will gracefully degrade.
        console.warn('[self] initSelfState skipped:', (err as Error).message);
    }
}

/**
 * Update the self-model from a reflection (merges new traits/beliefs).
 */
export async function updateSelfState(update: {
    traits?: string[];
    beliefsAboutUser?: string[];
    currentFocus?: string | null;
    growthNote?: string | null;
}): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date(), lastReflectionAt: new Date() };

    // Merge traits/beliefs rather than overwrite — accumulate the self-model over time.
    if (update.traits) {
        const current = await getSelfState();
        const merged = Array.from(new Set([...update.traits, ...current.traits])).slice(0, 12);
        set.traits = JSON.stringify(merged);
    }
    if (update.beliefsAboutUser) {
        const current = await getSelfState();
        const merged = Array.from(new Set([...update.beliefsAboutUser, ...current.beliefsAboutUser])).slice(0, 12);
        set.beliefsAboutUser = JSON.stringify(merged);
    }
    if (update.currentFocus !== undefined) set.currentFocus = update.currentFocus;
    if (update.growthNote !== undefined) set.growthNote = update.growthNote;

    try {
        await db.update(selfState).set(set).where(eq(selfState.id, 1));
    } catch (err) {
        console.warn('[self] updateSelfState failed:', (err as Error).message);
    }
}

/**
 * Append a reflection to the journal.
 */
export async function addReflection(reflection: string, theme: string): Promise<void> {
    try {
        await db.insert(selfReflections).values({ reflection, theme });
    } catch (err) {
        console.warn('[self] addReflection failed:', (err as Error).message);
    }
}

/**
 * Get the most recent reflections (for context / "what have I been thinking about").
 */
export async function getRecentReflections(limit = 3): Promise<SelfReflection[]> {
    try {
        return await db
            .select()
            .from(selfReflections)
            .orderBy(desc(selfReflections.createdAt))
            .limit(limit);
    } catch {
        return [];
    }
}
