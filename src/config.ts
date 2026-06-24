import * as dotenv from 'dotenv';
dotenv.config();

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  telegram: {
    botToken: require_env('TELEGRAM_BOT_TOKEN'),
    // 0 = not set yet; message the bot with /myid to get your numeric ID
    userId: parseInt(process.env.TELEGRAM_USER_ID ?? '0', 10),
  },
  databaseUrl: require_env('DATABASE_URL'),
  llm: {
    groqApiKey: process.env.GROQ_API_KEY ?? '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  },
  google: {
    credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH ?? './credentials.json',
    tokenPath: process.env.GOOGLE_TOKEN_PATH ?? './token.json',
  },
  cron: {
    morning: process.env.CRON_MORNING ?? '0 7 * * *',
    afternoon: process.env.CRON_AFTERNOON ?? '0 13 * * *',
    night: process.env.CRON_NIGHT ?? '0 21 * * *',
    habitCheckin: process.env.CRON_HABIT_CHECKIN ?? '0 20 * * *',
  },
  sheets: {
    budgetId: process.env.SHEET_BUDGET_ID ?? '',
    workoutsId: process.env.SHEET_WORKOUTS_ID ?? '',
    habitsId: process.env.SHEET_HABITS_ID ?? '',
  },
};
