import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { isAuthorized } from './guard';
import { chat } from '../llm/client';
import { buildIntentPrompt } from '../llm/prompts';
import { handleHabitLog, handleHabitStatus } from './handlers/habits';
import { handleTaskAdd, handleTaskList, handleTaskDone } from './handlers/tasks';
import { handleReminderSet, handleReminderList } from './handlers/reminders';
import { handleAdvisory } from './handlers/advisory';
import { handleSheetRead, handleSheetWrite } from './handlers/sheets';
import { handleGeneral } from './handlers/general';

export function createBot(): TelegramBot {
  const bot = new TelegramBot(config.telegram.botToken, { polling: true });

  bot.on('message', async (msg) => {
    if (!msg.text) return;

    const userId = msg.from?.id;
    if (!userId) return;

    // /myid — always allowed so Mill can get his numeric ID on first run
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
    console.log(`[${new Date().toISOString()}] Message from Mill: ${text}`);

    try {
      // Classify intent
      const intentMessages = buildIntentPrompt(text);
      const intent = (await chat(intentMessages)).trim().toUpperCase();
      console.log(`Intent: ${intent}`);

      switch (intent) {
        case 'HABIT_LOG':
          await handleHabitLog(bot, msg);
          break;
        case 'HABIT_STATUS':
          await handleHabitStatus(bot, msg);
          break;
        case 'TASK_ADD':
          await handleTaskAdd(bot, msg);
          break;
        case 'TASK_LIST':
          await handleTaskList(bot, msg);
          break;
        case 'TASK_DONE':
          await handleTaskDone(bot, msg);
          break;
        case 'REMINDER_SET':
          await handleReminderSet(bot, msg);
          break;
        case 'REMINDER_LIST':
          await handleReminderList(bot, msg);
          break;
        case 'ADVISORY':
          await handleAdvisory(bot, msg);
          break;
        case 'SHEET_READ':
          await handleSheetRead(bot, msg);
          break;
        case 'SHEET_WRITE':
          await handleSheetWrite(bot, msg);
          break;
        default:
          await handleGeneral(bot, msg);
      }
    } catch (err) {
      console.error('Handler error:', err);
      await bot.sendMessage(msg.chat.id, "Something broke on my end. Try again.");
    }
  });

  bot.on('polling_error', (err) => console.error('Polling error:', err));

  return bot;
}
