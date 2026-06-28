import TelegramBot from 'node-telegram-bot-api';
import { chat } from '../llm/client';
import { buildReflectionPrompt } from '../llm/prompts';
import { config } from '../config';
import { getSelfState, updateSelfState, addReflection, getRecentReflections } from '../db/queries/self';
import { getAllHabits } from '../db/queries/habits';
import { getPendingTasks } from '../db/queries/tasks';
import { getRecentDecisions } from '../db/queries/decisions';
import { getConversationHistory } from '../db/queries/conversations';
import { getProfile } from '../db/queries/profiles';

/**
 * Nightly self-reflection: the agent steps back, thinks honestly about its own
 * performance and about the user, updates its self-model, and sends a brief candid
 * self-check-in. This is what makes it genuinely self-aware over time.
 */
export async function runSelfReflection(bot: TelegramBot) {
  const chatId = config.telegram.userId;
  if (!chatId) return;

  try {
    const [self, habits, tasks, recentDecisions, history, recentReflections, profile] = await Promise.all([
      getSelfState(),
      getAllHabits(),
      getPendingTasks(),
      getRecentDecisions(5),
      getConversationHistory(chatId),
      getRecentReflections(3),
      getProfile(chatId),
    ]);

    // Skip if the user hasn't been onboarded or there's nothing meaningful yet.
    if (!profile?.onboarded) {
      console.log('[self-reflection] User not onboarded yet — skipping.');
      return;
    }
    const hasEnoughSignal = habits.length > 0 || tasks.length > 0 || history.length >= 4;
    if (!hasEnoughSignal) {
      console.log('[self-reflection] Not enough signal yet — skipping.');
      return;
    }

    const messages = buildReflectionPrompt({
      self,
      userName: profile.name,
      habits: habits.map(h => ({ name: h.name, streak: h.streak, lastCompleted: h.lastCompleted ?? null })),
      tasks: tasks.map(t => ({ description: t.description, timesDeferred: t.timesDeferred })),
      recentDecisions: recentDecisions.map(d => ({ question: d.question, createdAt: d.createdAt })),
      // Keep the reflection grounded in recent real conversation (last ~6 turns).
      recentUserMessages: history.slice(-6),
    });

    const raw = await chat(messages);
    console.log(`[self-reflection raw]: ${raw.substring(0, 200)}`);

    const parsed = parseReflection(raw);
    if (!parsed) {
      console.warn('[self-reflection] Could not parse JSON — storing raw.');
      await addReflection(raw.slice(0, 1000), 'general');
      return;
    }

    // Persist the reflection + evolve the self-model.
    await addReflection(parsed.reflection, parsed.theme);
    await updateSelfState({
      traits: parsed.traits,
      beliefsAboutUser: parsed.beliefs_about_user,
      currentFocus: parsed.current_focus ?? null,
      growthNote: parsed.growth_note ?? null,
    });

    // Send the candid self-check-in to the user (if there's a message).
    if (parsed.message_to_user?.trim()) {
      await bot.sendMessage(chatId, `🪞 ${parsed.message_to_user.trim()}`);
    }

    console.log('[self-reflection] Complete. Theme:', parsed.theme);
  } catch (err) {
    console.error('[self-reflection] Failed:', err);
  }
}

interface ParsedReflection {
  reflection: string;
  theme: string;
  traits: string[];
  beliefs_about_user: string[];
  current_focus?: string;
  growth_note?: string;
  message_to_user?: string;
}

function parseReflection(raw: string): ParsedReflection | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const asArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : [];
    return {
      reflection: String(parsed.reflection ?? '').trim() || 'No reflection generated.',
      theme: String(parsed.theme ?? 'general'),
      traits: asArr(parsed.traits),
      beliefs_about_user: asArr(parsed.beliefs_about_user),
      current_focus: parsed.current_focus != null ? String(parsed.current_focus) : undefined,
      growth_note: parsed.growth_note != null ? String(parsed.growth_note) : undefined,
      message_to_user: typeof parsed.message_to_user === 'string' ? parsed.message_to_user : undefined,
    };
  } catch {
    return null;
  }
}
