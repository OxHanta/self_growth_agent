import TelegramBot from 'node-telegram-bot-api';
import { chat } from '../llm/client';
import { buildExercisePrompt } from '../llm/prompts';
import { logExerciseSent, getRecentExercises } from '../db/queries/exercises';
import { config } from '../config';

export async function sendMentalExercise(bot: TelegramBot) {
  const chatId = config.telegram.userId;

  // Alternate between cognitive and reflective
  const recentExercises = await getRecentExercises(30);
  const lastType = recentExercises[0]?.exerciseType ?? 'reflective';
  const nextType: 'cognitive' | 'reflective' = lastType === 'cognitive' ? 'reflective' : 'cognitive';

  const summaries = recentExercises.map((e: { contentSummary: string }) => e.contentSummary);

  try {
    const messages = buildExercisePrompt(nextType, summaries);
    const raw = await chat(messages);

    // Parse EXERCISE: / SUMMARY: format
    const exerciseMatch = raw.match(/EXERCISE:\s*(.+?)(?:\n|SUMMARY:)/s);
    const summaryMatch = raw.match(/SUMMARY:\s*(.+)/s);

    const exerciseContent = exerciseMatch?.[1]?.trim() ?? raw.trim();
    const summary = summaryMatch?.[1]?.trim() ?? exerciseContent.slice(0, 80);

    await logExerciseSent(nextType, summary, exerciseContent);

    const label = nextType === 'cognitive' ? '🧩 Brain workout' : '💭 Reflect';
    await bot.sendMessage(chatId, `${label}\n\n${exerciseContent}`);
  } catch (err) {
    console.error('Failed to send mental exercise:', err);
  }
}
