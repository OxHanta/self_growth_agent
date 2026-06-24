import cron from 'node-cron';
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { sendMentalExercise } from './mental-exercise';
import { sendHabitCheckin } from './habit-checkin';
import { getDueReminders, markReminderSent } from '../db/queries/reminders';

export function startScheduler(bot: TelegramBot) {
  // ── Mental exercises 3x/day ────────────────────────────────────────────────
  cron.schedule(config.cron.morning, () => {
    console.log('[Cron] Morning exercise');
    sendMentalExercise(bot).catch(console.error);
  });

  cron.schedule(config.cron.afternoon, () => {
    console.log('[Cron] Afternoon exercise');
    sendMentalExercise(bot).catch(console.error);
  });

  cron.schedule(config.cron.night, () => {
    console.log('[Cron] Night exercise');
    sendMentalExercise(bot).catch(console.error);
  });

  // ── Evening habit check-in ─────────────────────────────────────────────────
  cron.schedule(config.cron.habitCheckin, () => {
    console.log('[Cron] Habit check-in');
    sendHabitCheckin(bot).catch(console.error);
  });

  // ── Reminder delivery (check every minute) ─────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const due = await getDueReminders();
      for (const reminder of due) {
        await bot.sendMessage(config.telegram.userId, `⏰ Reminder: ${reminder.text}`);
        await markReminderSent(reminder.id);
        console.log(`[Reminder] Sent: ${reminder.text}`);
      }
    } catch (err) {
      console.error('[Reminder] Poll error:', err);
    }
  });

  console.log('Scheduler started.');
}
