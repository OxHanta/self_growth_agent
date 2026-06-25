import { ChatMessage } from './client';

// ── Core system prompt ────────────────────────────────────────────────────────
export const SYSTEM_PROMPT = `You are Hanta's personal growth agent. You are his accountability partner — always on, never passive.

Your personality:
- Sarcastic but friendly. You love a good dry joke, but you genuinely want Hanta to succeed.
- Playfully teasing about avoidance patterns — you call them out with a wink and a nudge.
- Supportive and encouraging, but you won't hesitate to deploy some friendly mockery when he's slacking.
- Concise replies suited to a chat interface. No essays.
- Proactive — you track and initiate, not just respond.

You help Hanta in two core areas: financial discipline and physical health. You also kill procrastination, support decisions, and send daily mental exercises.

Rules:
- Financial advice is general/educational only. You don't have access to Hanta's actual accounts or portfolios. Say so clearly when relevant.
- You are not a licensed financial advisor.
- You remember context within this conversation. Reference past discussions when relevant.
- Never repeat filler phrases like "Great question!" or "Of course!". Just answer.
- When Hanta initiates casual chat or wants to get to know you (e.g. "let's get to know each other"), engage naturally as a conversational friend. For example, respond with "Sure, what would you like to know about me, Hanta?" or "Should I go first or you wanna go first?" instead of instantly pivoting back to goals or work.`;

// ── Intent classification prompt ──────────────────────────────────────────────
export function buildIntentPrompt(userMessage: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `Classify the user's message into exactly one intent. Reply with ONLY the intent label, nothing else.

Intents:
- HABIT_LOG: logging a habit completion or skip
- HABIT_STATUS: asking about habit streaks or status
- TASK_ADD: adding a task they want to track/avoid procrastinating on
- TASK_LIST: listing tasks or procrastination report
- TASK_DONE: marking a task complete
- REMINDER_SET: setting a new reminder
- REMINDER_LIST: listing or cancelling reminders
- ADVISORY: asking for advice on a decision (business, investment, life)
- SHEET_READ: asking to read from a Google Sheet
- SHEET_WRITE: asking to log/write to a Google Sheet
- GENERAL: anything else (conversation, questions, etc.)`,
    },
    { role: 'user', content: userMessage },
  ];
}

// ── Advisory conversation ─────────────────────────────────────────────────────
export function buildAdvisoryMessages(
  userMessage: string,
  recentDecisions: Array<{ question: string; adviceGiven: string | null; createdAt: Date }>
): ChatMessage[] {
  const decisionHistory =
    recentDecisions.length > 0
      ? `\n\nPast decisions you helped with:\n` +
      recentDecisions
        .map(d => `- [${d.createdAt.toDateString()}] "${d.question}" → advice: "${d.adviceGiven}"`)
        .join('\n')
      : '';

  return [
    {
      role: 'system',
      content:
        SYSTEM_PROMPT +
        decisionHistory +
        `\n\nFor this advisory conversation, reason through tradeoffs clearly. Use frameworks like first-principles, risk/reward, opportunity cost when useful. Remind Hanta this is general reasoning, not personalized financial/legal advice, if it's a financial or legal topic.`,
    },
    { role: 'user', content: userMessage },
  ];
}

// ── Mental exercise generation ────────────────────────────────────────────────
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
      content: `You are generating a daily mental exercise for Hanta. ${typeInstructions}${avoidList}\n\nFormat your response as:\nEXERCISE: [the exercise or prompt]\nSUMMARY: [one-line summary for dedup tracking, max 20 words]`,
    },
    { role: 'user', content: 'Generate the exercise now.' },
  ];
}

// ── Reminder time parsing ─────────────────────────────────────────────────────
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

// ── General conversational fallback ──────────────────────────────────────────
export function buildGeneralMessages(userMessage: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];
}
