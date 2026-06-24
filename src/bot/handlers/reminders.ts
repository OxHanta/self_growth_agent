import TelegramBot from 'node-telegram-bot-api';
import {
  createReminder,
  getPendingReminders,
  cancelReminder,
} from '../../db/queries/reminders';
import { chat } from '../../llm/client';
import { buildReminderParsePrompt } from '../../llm/prompts';

export async function handleReminderSet(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';

  const messages = buildReminderParsePrompt(text);
  let parsed: { text?: string; iso_time?: string; error?: string };

  try {
    const raw = await chat(messages);
    parsed = JSON.parse(raw.replace(/```json?/g, '').replace(/```/g, '').trim());
  } catch {
    await bot.sendMessage(chatId, "Couldn't parse that time. Try: \"remind me at 3pm to call the bank\".");
    return;
  }

  if (parsed.error || !parsed.iso_time || !parsed.text) {
    await bot.sendMessage(chatId, `Couldn't parse: ${parsed.error ?? 'unknown reason'}. Be more specific with the time.`);
    return;
  }

  const scheduledTime = new Date(parsed.iso_time);
  if (isNaN(scheduledTime.getTime()) || scheduledTime <= new Date()) {
    await bot.sendMessage(chatId, "That time is in the past. Give me a future time.");
    return;
  }

  const reminder = await createReminder(parsed.text, scheduledTime);
  await bot.sendMessage(
    chatId,
    `⏰ Set: "${reminder.text}" — ${scheduledTime.toLocaleString()}.`
  );
}

export async function handleReminderList(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';

  // Cancel
  const cancelMatch = text.match(/cancel\s+(?:reminder\s+)?(\d+)/i);
  if (cancelMatch) {
    const reminders = await getPendingReminders();
    const idx = parseInt(cancelMatch[1], 10) - 1;
    const r = reminders[idx];
    if (!r) {
      await bot.sendMessage(chatId, `No reminder at position ${cancelMatch[1]}.`);
      return;
    }
    await cancelReminder(r.id);
    await bot.sendMessage(chatId, `Cancelled: "${r.text}".`);
    return;
  }

  const reminders = await getPendingReminders();
  if (reminders.length === 0) {
    await bot.sendMessage(chatId, "No active reminders.");
    return;
  }

  const lines = reminders.map(
    (r, i) => `${i + 1}. "${r.text}" — ${new Date(r.scheduledTime).toLocaleString()}`
  );
  await bot.sendMessage(
    chatId,
    `*Active Reminders*\n\n${lines.join('\n')}\n\nTo cancel: "cancel reminder [number]"`,
    { parse_mode: 'Markdown' }
  );
}
