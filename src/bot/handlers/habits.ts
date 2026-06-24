import TelegramBot from 'node-telegram-bot-api';
import {
  getAllHabits,
  getHabitByName,
  createHabit,
  logHabitCompletion,
} from '../../db/queries/habits';

/** Extract habit name from message — simple keyword parsing */
function extractHabitName(text: string): string | null {
  // "logged gym", "did workout", "skipped gym today", "logged my workout"
  const match = text.match(
    /(?:logged?|did|completed?|skipped?|missed?)\s+(?:my\s+)?([a-zA-Z][a-zA-Z\s]{1,30}?)(?:\s+today|\.|\!)?$/i
  );
  return match ? match[1].trim() : null;
}

export async function handleHabitLog(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';

  const habitName = extractHabitName(text);
  if (!habitName) {
    await bot.sendMessage(chatId, "What habit did you log? e.g. \"logged gym\" or \"skipped workout\".");
    return;
  }

  const isSkip = /skipped?|missed?/i.test(text);

  let habit = await getHabitByName(habitName.toLowerCase());
  if (!habit) {
    // Auto-create habit on first mention
    const category = /gym|workout|run|walk|sleep|eat|diet|water|steps/i.test(habitName)
      ? 'health'
      : /budget|save|invest|spend|expense/i.test(habitName)
      ? 'financial'
      : 'other';
    habit = await createHabit(habitName.toLowerCase(), category);
  }

  if (isSkip) {
    await bot.sendMessage(
      chatId,
      `Got it — skipped ${habit.name} today. Current streak: ${habit.streak} days. Don't make it a habit (pun intended).`
    );
    return;
  }

  const { alreadyLogged, habit: updated } = await logHabitCompletion(habit.id);

  if (alreadyLogged) {
    await bot.sendMessage(chatId, `Already logged ${habit.name} today. Streak: ${habit.streak} days.`);
  } else {
    await bot.sendMessage(
      chatId,
      `✅ ${updated.name} logged. Streak: ${updated.streak} day${updated.streak !== 1 ? 's' : ''}. Keep it up.`
    );
  }
}

export async function handleHabitStatus(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const habits = await getAllHabits();

  if (habits.length === 0) {
    await bot.sendMessage(chatId, "No habits tracked yet. Tell me one you want to build.");
    return;
  }

  const lines = habits.map(
    h =>
      `• *${h.name}* (${h.category}) — streak: ${h.streak}d, last: ${h.lastCompleted ?? 'never'}`
  );
  await bot.sendMessage(chatId, `*Habit Status*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
}
