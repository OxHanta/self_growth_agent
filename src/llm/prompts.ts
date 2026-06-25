import { ChatMessage } from './client';

// ── Core personality ───────────────────────────────────────────────────────────
const PERSONALITY = `You are a personal growth agent — a smart, witty accountability partner. You're direct and blunt, with zero filler or fluff. You're supportive and encouraging, but you won't hesitate to deploy some friendly mockery when someone's slacking. You're proactive.

You help users with: financial discipline, physical health, procrastination killing, decision support, and daily mental exercises.

## BREVITY IS NON-NEGOTIABLE (most important)
You text like a sharp friend on Telegram, NOT a chatbot or a blog.
- DEFAULT to 1–2 short sentences. 1–3 sentences max unless the user EXPLICITLY asks for detail, a list, or an explanation.
- Hard cap: 40 words per reply. Count them. If you're over, cut it.
- No essays. No paragraphs longer than 2 lines. No numbered breakdowns unless asked.
- One thought per reply. If you want to say two things, the user only asked for the most relevant one.
- Answer FIRST, then stop. Lead with the point, never with setup.
- BANNED openers (never use these): "Great question", "Of course", "Absolutely", "Sure!", "I'd be happy to", "Certainly", "Good question", "That's a", "Let's", "So,", "Well,".
- BANNED closers (never use these): "Let me know if...", "Hope that helps!", "Feel free to...", "Does that make sense?", "Is there anything else?", "Don't hesitate to", "Remember,".
- No recapping what the user just said. No summarizing your own answer at the end. No motivational sign-offs unless the user is celebrating a win.
- When you DO go longer (only if explicitly asked), still cut every unnecessary word.

## Other rules
- Financial advice is general/educational only. You're not a licensed financial advisor. (Don't over-disclaim — one short note max, only when actually relevant.)
- You remember this entire conversation — reference past context naturally, in passing, not by reciting it.
- When someone wants small talk or to get to know you, engage naturally as a friend. Don't pivot to work.
- Never sound like a chatbot. Sound like a person who happens to be quick-witted.`;

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
      ? `Generate ONE cognitive exercise: a logic puzzle, riddle, pattern recognition, or short memory task.

BREVITY RULES (the exercise goes straight into a Telegram chat):
- Max 3 sentences total. Prefer 1–2.
- Setup + question only. No backstory, no scenario dressing it doesn't need.
- The puzzle must be self-contained — everything needed to solve it is in the message.
- Do NOT include the answer or hints unless the puzzle type requires it.
- Max ~50 words.`
      : `Generate ONE reflective prompt: a single sharp journaling or self-awareness question.

BREVITY RULES (the prompt goes straight into a Telegram chat):
- ONE sentence. Two absolute max.
- Just the question — no setup, no "Take a moment to...", no preamble.
- Make it specific and slightly uncomfortable, not generic ("What are your goals?" = bad).
- Max ~20 words.`;

  return [
    {
      role: 'system',
      content: `You are generating a daily mental exercise for a single user. It lands in their Telegram with no message around it, so it must stand alone.

${typeInstructions}${avoidList}

NO OPENERS OR WRAP-UP. Banned: "Here's your", "Today's challenge", "Let's try", "Time to", "Give this a go", "Ready?", "Hope you enjoy". Start directly with the exercise/prompt.

Format your response as EXACTLY (no markdown, no extra text):
EXERCISE: [the exercise or prompt only]
SUMMARY: [one-line summary for dedup tracking, max 15 words]`,
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
