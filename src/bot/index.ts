import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { isAuthorized } from './guard';
import { chat } from '../llm/client';
import { buildBrainPrompt } from '../llm/prompts';

// DB queries
import { getAllHabits, getHabitByName, createHabit, logHabitCompletion } from '../db/queries/habits';
import { createTask, getPendingTasks, completeTask } from '../db/queries/tasks';
import { createReminder, getPendingReminders, cancelReminder } from '../db/queries/reminders';
import { logDecision, getRecentDecisions } from '../db/queries/decisions';
import { getConversationHistory, appendMessage } from '../db/queries/conversations';
import { getSelfState, initSelfState, getRecentReflections } from '../db/queries/self';

// ── Action executor ────────────────────────────────────────────────────────────
async function executeAction(
  action: { type: string; data: Record<string, unknown> }
): Promise<void> {
  switch (action.type) {
    case 'HABIT_LOG': {
      const name = String(action.data.name ?? '').toLowerCase().trim();
      const skipped = Boolean(action.data.skipped);
      if (!name) break;

      let habit = await getHabitByName(name);
      if (!habit) {
        const category = /gym|workout|run|walk|sleep|eat|diet|water|steps|cycle|cycling/i.test(name)
          ? 'health'
          : /budget|save|invest|spend|expense/i.test(name)
            ? 'financial'
            : 'other';
        habit = await createHabit(name, category);
      }

      if (!skipped) {
        await logHabitCompletion(habit.id);
      }
      break;
    }

    case 'TASK_ADD': {
      const description = String(action.data.description ?? '').trim();
      if (description) await createTask(description);
      break;
    }

    case 'TASK_DONE': {
      const desc = String(action.data.description ?? '').trim().toLowerCase();
      const tasks = await getPendingTasks();
      const match = tasks.find(t => t.description.toLowerCase().includes(desc));
      if (match) await completeTask(match.id);
      break;
    }

    case 'REMINDER_SET': {
      const text = String(action.data.text ?? '').trim();
      const isoTime = String(action.data.iso_time ?? '');
      if (!text || !isoTime) break;
      const scheduledTime = new Date(isoTime);
      if (!isNaN(scheduledTime.getTime()) && scheduledTime > new Date()) {
        await createReminder(text, scheduledTime);
      }
      break;
    }

    case 'REMINDER_CANCEL': {
      const text = String(action.data.text ?? '').trim().toLowerCase();
      const reminders = await getPendingReminders();
      const match = reminders.find(r => r.text.toLowerCase().includes(text));
      if (match) await cancelReminder(match.id);
      break;
    }

    case 'LOG_DECISION': {
      const category = String(action.data.category ?? 'general');
      const question = String(action.data.question ?? '');
      const advice = String(action.data.advice ?? '');
      if (question && advice) await logDecision(category, question, undefined, advice);
      break;
    }

    default:
      break;
  }
}

// ── Convert LLM markdown to Telegram-safe HTML ────────────────────────────────
// Why: legacy Markdown parse_mode is brutal — stray `_`, `*`, or backticks either
// break the message ("Something broke on my end") or render as malformed formatting.
// HTML mode treats bare `*`/`_` as literal text, so we only convert the SAFE cases.
function toTelegramHtml(text: string): string {
  return text
    // 1. escape HTML entities first (so advice with <, >, & never breaks parsing)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 2. strip any stray code fences (e.g. leaked ```json wrappers)
    .replace(/```/g, '')
    // 3. inline code: `code`
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    // 4. bold: **text**
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    // NOTE: single `*` and `_` are left as literal text (HTML mode renders them plainly)
    .trim();
}

// ── Parse LLM JSON response ────────────────────────────────────────────────────
function parseBrainResponse(raw: string): { reply: string; action: { type: string; data: Record<string, unknown> } } {
  // Try to find a JSON object in the response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        reply: String(parsed.reply ?? raw),
        action: {
          type: String(parsed.action?.type ?? 'NONE'),
          data: (parsed.action?.data as Record<string, unknown>) ?? {},
        },
      };
    } catch {
      // JSON parse failed, fallback
    }
  }

  // LLM didn't return valid JSON — use raw text as reply, no action
  // Strip code fences if they exist
  const cleanReply = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return { reply: cleanReply, action: { type: 'NONE', data: {} } };
}

// ── Main bot factory ───────────────────────────────────────────────────────────
export function createBot(): TelegramBot {
  const bot = new TelegramBot(config.telegram.botToken, { polling: true });

  bot.on('message', async (msg) => {
    if (!msg.text) return;

    const userId = msg.from?.id;
    if (!userId) return;

    // /myid — always allowed
    if (msg.text.trim() === '/myid') {
      await bot.sendMessage(
        msg.chat.id,
        `Your Telegram user ID is: \`${userId}\`\n\nPaste that into your .env as TELEGRAM_USER_ID, then restart the bot.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (!isAuthorized(userId)) {
      console.log(`Blocked unauthorized user: ${userId}`);
      return;
    }

    const text = msg.text.trim();
    console.log(`[${new Date().toISOString()}] Message from user ${userId}: ${text}`);

    try {
      await bot.sendChatAction(msg.chat.id, 'typing');

      // Load persistent conversation history
      const history = await getConversationHistory(userId);

      // Load live context from DB (incl. the agent's self-model)
      const [habits, tasks, reminders, recentDecisions, self, recentReflections] = await Promise.all([
        getAllHabits(),
        getPendingTasks(),
        getPendingReminders(),
        getRecentDecisions(5),
        getSelfState(),
        getRecentReflections(3),
      ]);

      // Build the brain prompt (self-model shapes the agent's self-awareness)
      const messages = buildBrainPrompt(text, history, {
        habits: habits.map(h => ({ name: h.name, streak: h.streak, lastCompleted: h.lastCompleted ?? null })),
        tasks: tasks.map(t => ({ description: t.description, timesDeferred: t.timesDeferred })),
        reminders: reminders.map(r => ({ text: r.text, scheduledTime: r.scheduledTime })),
        recentDecisions: recentDecisions.map(d => ({ question: d.question, createdAt: d.createdAt })),
        self,
        recentReflections: recentReflections.map(r => ({ reflection: r.reflection, theme: r.theme, createdAt: r.createdAt })),
      });

      // Get LLM response
      const raw = await chat(messages);
      console.log(`[Brain raw]: ${raw.substring(0, 200)}`);

      // Parse the JSON action + reply
      const { reply, action } = parseBrainResponse(raw);

      // Execute any DB action silently
      if (action.type !== 'NONE') {
        await executeAction(action);
        console.log(`[Action executed]: ${action.type}`, action.data);
      }

      // Save both sides of the conversation to DB
      await appendMessage(userId, 'user', text);
      await appendMessage(userId, 'assistant', reply);

      // Send reply (HTML-safe so stray markdown never breaks the message)
      await bot.sendMessage(msg.chat.id, toTelegramHtml(reply), { parse_mode: 'HTML' });

    } catch (err: any) {
      console.error('Brain error:', err);
      let errMsg = err?.message || String(err);
      if (err && typeof err === 'object' && 'errors' in err && Array.isArray(err.errors)) {
        errMsg += '\n' + err.errors.map((e: any) => e?.message || String(e)).join('\n');
      }
      if (err?.cause) {
        const cause = err.cause;
        errMsg += `\nCause: ${cause.message || String(cause)}`;
        if (cause && typeof cause === 'object' && 'errors' in cause && Array.isArray(cause.errors)) {
          errMsg += '\n' + cause.errors.map((e: any) => e?.message || String(e)).join('\n');
        }
      }
      await bot.sendMessage(msg.chat.id, `Something broke on my end. Try again.\n\nError details:\n${toTelegramHtml(errMsg)}`, { parse_mode: 'HTML' });
    }
  });

  bot.on('polling_error', (err) => console.error('Polling error:', err));

  return bot;
}
