import TelegramBot from 'node-telegram-bot-api';
import { chat } from '../../llm/client';
import { buildGeneralMessages } from '../../llm/prompts';

export async function handleGeneral(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';

  await bot.sendChatAction(chatId, 'typing');
  const messages = buildGeneralMessages(text);
  const reply = await chat(messages);
  await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
}
