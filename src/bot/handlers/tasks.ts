import TelegramBot from 'node-telegram-bot-api';
import { createTask, getPendingTasks, deferTask, completeTask } from '../../db/queries/tasks';

export async function handleTaskAdd(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';

  // Strip intent keywords to get task description
  const description = text
    .replace(/^(i need to|i have to|remind me to|task:|avoiding|i'm avoiding|procrastinating on)/i, '')
    .trim();

  if (!description) {
    await bot.sendMessage(chatId, "What's the task you're putting off? Just tell me.");
    return;
  }

  const task = await createTask(description);
  await bot.sendMessage(
    chatId,
    `Logged: "${task.description}". I'll follow up. Don't let this sit.`
  );
}

export async function handleTaskList(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const tasks = await getPendingTasks();

  if (tasks.length === 0) {
    await bot.sendMessage(chatId, "No pending tasks. Either you're on top of things or you haven't told me yet.");
    return;
  }

  const lines = tasks.map(
    (t, i) =>
      `${i + 1}. *${t.description}*${t.timesDeferred > 0 ? ` — deferred ${t.timesDeferred}x` : ''}`
  );
  await bot.sendMessage(
    chatId,
    `*Pending Tasks*\n\n${lines.join('\n')}\n\nReply with "done [number]" to close one.`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleTaskDone(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';
  const match = text.match(/done\s+(\d+)/i);

  if (!match) {
    await bot.sendMessage(chatId, 'Which task? Reply with "done [number]" — use "tasks" to see the list.');
    return;
  }

  const tasks = await getPendingTasks();
  const idx = parseInt(match[1], 10) - 1;
  const task = tasks[idx];

  if (!task) {
    await bot.sendMessage(chatId, `No task at position ${match[1]}.`);
    return;
  }

  await completeTask(task.id);
  await bot.sendMessage(chatId, `✅ Done: "${task.description}". Good.`);
}
