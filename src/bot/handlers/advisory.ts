import TelegramBot from 'node-telegram-bot-api';
import { chat } from '../../llm/client';
import { buildAdvisoryMessages } from '../../llm/prompts';
import { logDecision, getRecentDecisions } from '../../db/queries/decisions';

function detectCategory(text: string): string {
  if (/invest|stock|crypto|portfolio|etf|bond|asset/i.test(text)) return 'investment';
  if (/business|startup|client|revenue|product|market/i.test(text)) return 'business';
  if (/relationship|career|move|travel|health decision/i.test(text)) return 'life';
  return 'general';
}

export async function handleAdvisory(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';

  // Show typing indicator
  await bot.sendChatAction(chatId, 'typing');

  const recentDecisions = await getRecentDecisions(5);
  const messages = buildAdvisoryMessages(text, recentDecisions);
  const advice = await chat(messages);

  // Log this decision
  const category = detectCategory(text);
  await logDecision(category, text, undefined, advice);

  await bot.sendMessage(chatId, advice, { parse_mode: 'Markdown' });
}
