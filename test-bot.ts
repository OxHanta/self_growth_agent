import { config } from './src/config';
import { getConversationHistory, appendMessage } from './src/db/queries/conversations';
import { getAllHabits } from './src/db/queries/habits';
import { getPendingTasks } from './src/db/queries/tasks';
import { getPendingReminders } from './src/db/queries/reminders';
import { getRecentDecisions } from './src/db/queries/decisions';
import { buildBrainPrompt } from './src/llm/prompts';
import { chat } from './src/llm/client';

async function test() {
  const userId = config.telegram.userId;
  console.log("Testing user:", userId);
  try {
    const history = await getConversationHistory(userId);
    console.log("History length:", history.length);

    const [habits, tasks, reminders, recentDecisions] = await Promise.all([
      getAllHabits(),
      getPendingTasks(),
      getPendingReminders(),
      getRecentDecisions(5),
    ]);

    const messages = buildBrainPrompt('Hello Agent', history, {
      habits: habits.map(h => ({ name: h.name, streak: h.streak, lastCompleted: h.lastCompleted ?? null })),
      tasks: tasks.map(t => ({ description: t.description, timesDeferred: t.timesDeferred })),
      reminders: reminders.map(r => ({ text: r.text, scheduledTime: r.scheduledTime })),
      recentDecisions: recentDecisions.map(d => ({ question: d.question, createdAt: d.createdAt })),
    });

    console.log("Prompt ready. Calling chat...");
    const raw = await chat(messages);
    console.log("Raw reply:", raw);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test().then(() => process.exit(0));
