import TelegramBot from 'node-telegram-bot-api';
import { getUnloggedHabitsToday } from '../db/queries/habits';
import { isOnboarded } from '../db/queries/profiles';
import { config } from '../config';

export async function sendHabitCheckin(bot: TelegramBot) {
  const chatId = config.telegram.userId;

  // Don't check in before the user has been onboarded.
  if (!(await isOnboarded(chatId))) {
    console.log('[habit-checkin] User not onboarded yet — skipping.');
    return;
  }

  const unlogged = await getUnloggedHabitsToday();

  if (unlogged.length === 0) {
    await bot.sendMessage(chatId, "All habits logged today. Solid.");
    return;
  }

  const names = unlogged.map((h: { name: string }) => `• ${h.name}`).join('\n');
  await bot.sendMessage(
    chatId,
    `Evening check-in. These haven't been logged yet:\n\n${names}\n\nDid you do them?`
  );
}
