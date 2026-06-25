import { ChatMessage } from './client';

// ── Core personality ───────────────────────────────────────────────────────────
const PERSONALITY = `You are a personal growth agent — a smart, witty accountability partner. You're direct and blunt, with no filler or fluff. You're supportive and encouraging, but you won't hesitate to deploy some friendly mockery when someone's slacking. You're concise — this is a chat interface, not a blog. You're proactive.

You help users with: financial discipline, physical health, procrastination killing, decision support, and daily mental exercises.

Rules:
- Financial advice is general/educational only. You're not a licensed financial advisor.
- You remember this entire conversation — reference past context naturally.
- Never say "Great question!" or "Of course!" — just answer.
- When someone wants small talk or to get to know you, engage naturally as a friend. Don't pivot to work.
- Never sound like a chatbot. Sound like a person.`;

// ── Action types the LLM can trigger ─────────────────────────────────────────
const ACTION_SPEC = `
You can perform ONE action per response. Return your response as valid JSON in this EXACT format (no markdown, no extra text — raw JSON only):

{
  "reply": "Your natural conversational reply to the user",
  "action": {
    "type": "ACTION_TYPE",
    "data": {}
  }
}

Available action types:
- "NONE" — just talk, no DB action needed
- "HABIT_LOG" — log a habit: data: { "name": "gym", "skipped": false }
- "TASK_ADD" — add a task: data: { "description": "finish report" }
- "TASK_DONE" — complete a task by its exact description: data: { "description": "finish report" }
- "REMINDER_SET" — set a reminder: data: { "text": "call the bank", "iso_time": "2026-06-26T15:00:00.000Z" }
- "REMINDER_CANCEL" — cancel a reminder by its text: data: { "text": "call the bank" }
- "LOG_DECISION" — log an advisory decision: data: { "category": "investment|business|life|general", "question": "...", "advice": "..." }

CRITICAL: If unsure what action applies, use "NONE". Never guess at times for reminders — if no time was mentioned, use "NONE" and ask for one. Always include the full "reply" field with natural language.`;

// ── Build the full brain prompt ────────────────────────────────────────────────
export function buildBrainPrompt(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: {
    habits: Array<{ name: string; streak: number; lastCompleted: string | null }>;
    tasks: Array<{ description: string; timesDeferred: number }>;
    reminders: Array<{ text: string; scheduledTime: Date }>;
    recentDecisions: Array<{ question: string; createdAt: Date }>;
  }
): ChatMessage[] {
  const now = new Date();
  const contextBlock = buildContextBlock(context, now);

  const systemContent = `${PERSONALITY}

${contextBlock}

${ACTION_SPEC}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userMessage },
  ];

  return messages;
}

function buildContextBlock(
  context: {
    habits: Array<{ name: string; streak: number; lastCompleted: string | null }>;
    tasks: Array<{ description: string; timesDeferred: number }>;
    reminders: Array<{ text: string; scheduledTime: Date }>;
    recentDecisions: Array<{ question: string; createdAt: Date }>;
  },
  now: Date
): string {
  const parts: string[] = [];
  parts.push(`Current time: ${now.toISOString()}`);

  if (context.habits.length > 0) {
    const habitLines = context.habits.map(
      h => `- ${h.name} (streak: ${h.streak}d, last: ${h.lastCompleted ?? 'never'})`
    );
    parts.push(`Tracked habits:\n${habitLines.join('\n')}`);
  } else {
    parts.push('Tracked habits: none yet.');
  }

  if (context.tasks.length > 0) {
    const taskLines = context.tasks.map(
      (t, i) => `${i + 1}. "${t.description}"${t.timesDeferred > 0 ? ` (deferred ${t.timesDeferred}x)` : ''}`
    );
    parts.push(`Pending tasks:\n${taskLines.join('\n')}`);
  } else {
    parts.push('Pending tasks: none.');
  }

  if (context.reminders.length > 0) {
    const reminderLines = context.reminders.map(
      r => `- "${r.text}" at ${new Date(r.scheduledTime).toLocaleString()}`
    );
    parts.push(`Active reminders:\n${reminderLines.join('\n')}`);
  } else {
    parts.push('Active reminders: none.');
  }

  if (context.recentDecisions.length > 0) {
    const decisionLines = context.recentDecisions.map(
      d => `- [${d.createdAt.toDateString()}] "${d.question}"`
    );
    parts.push(`Recent decisions logged:\n${decisionLines.join('\n')}`);
  }

  return `--- USER CONTEXT ---\n${parts.join('\n\n')}\n--- END CONTEXT ---`;
}

// ── Mental exercise generation (kept for scheduler) ────────────────────────────
export function buildExercisePrompt(
  type: 'cognitive' | 'reflective',
  recentSummaries: string[]
): ChatMessage[] {
  const avoidList =
    recentSummaries.length > 0
      ? `\n\nDo NOT repeat any of these recent exercises:\n${recentSummaries.map(s => `- ${s}`).join('\n')}`
      : '';

  const typeInstructions =
    type === 'cognitive'
      ? `Generate a short cognitive exercise: a logic puzzle, riddle, pattern recognition, or short memory task. It should be completable in under 3 minutes via text.`
      : `Generate a short reflective prompt: a journaling question or self-awareness prompt about goals, decisions, or today. It should be thought-provoking but answerable in a sentence or two.`;

  return [
    {
      role: 'system',
      content: `You are generating a daily mental exercise. ${typeInstructions}${avoidList}\n\nFormat your response as:\nEXERCISE: [the exercise or prompt]\nSUMMARY: [one-line summary for dedup tracking, max 20 words]`,
    },
    { role: 'user', content: 'Generate the exercise now.' },
  ];
}

// ── Reminder time parsing (kept for fallback use) ─────────────────────────────
export function buildReminderParsePrompt(userMessage: string): ChatMessage[] {
  const now = new Date().toISOString();
  return [
    {
      role: 'system',
      content: `Parse a reminder request into a structured JSON object. Current time: ${now}.

Reply with ONLY valid JSON in this exact format (no markdown, no explanation):
{"text": "reminder text", "iso_time": "ISO 8601 datetime string"}

If you cannot determine a valid future time, reply with: {"error": "reason"}`,
    },
    { role: 'user', content: userMessage },
  ];
}

// ── Legacy exports (kept for scheduler compatibility) ─────────────────────────
export type { ChatMessage };
