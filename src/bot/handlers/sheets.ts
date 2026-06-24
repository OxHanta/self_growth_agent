import TelegramBot from 'node-telegram-bot-api';
import { readSheet, appendToSheet } from '../../sheets/client';
import { getAllSheets, getSheetByName } from '../../db/queries/sheets';

export async function handleSheetRead(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';

  const sheets = await getAllSheets();
  if (sheets.length === 0) {
    await bot.sendMessage(chatId, "No sheets configured yet. Run setup or tell me which sheet to add.");
    return;
  }

  // Try to match a sheet name from the message
  const match = sheets.find(s => text.toLowerCase().includes(s.friendlyName.toLowerCase()));
  if (!match) {
    const names = sheets.map(s => `"${s.friendlyName}"`).join(', ');
    await bot.sendMessage(chatId, `Which sheet? I know: ${names}.`);
    return;
  }

  await bot.sendChatAction(chatId, 'typing');
  try {
    const data = await readSheet(match.sheetId, match.tabName);
    if (!data || data.length === 0) {
      await bot.sendMessage(chatId, `"${match.friendlyName}" is empty.`);
      return;
    }

    const preview = data.slice(0, 10).map(row => row.join(' | ')).join('\n');
    const extra = data.length > 10 ? `\n\n…and ${data.length - 10} more rows.` : '';
    await bot.sendMessage(chatId, `*${match.friendlyName}* (${match.tabName}):\n\`\`\`\n${preview}\n\`\`\`${extra}`, {
      parse_mode: 'Markdown',
    });
  } catch (e) {
    await bot.sendMessage(chatId, `Failed to read "${match.friendlyName}": ${(e as Error).message}`);
  }
}

export async function handleSheetWrite(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';

  const sheets = await getAllSheets().then(s => s.filter(s => s.purpose !== 'read'));
  if (sheets.length === 0) {
    await bot.sendMessage(chatId, "No writable sheets configured.");
    return;
  }

  const match = sheets.find(s => text.toLowerCase().includes(s.friendlyName.toLowerCase()));
  if (!match) {
    const names = sheets.map(s => `"${s.friendlyName}"`).join(', ');
    await bot.sendMessage(chatId, `Which sheet? Writable ones: ${names}.`);
    return;
  }

  // Extract the entry — everything after "log" or "add" keyword
  const entryMatch = text.match(/(?:log|add|write|append|record)\s+(.+?)(?:\s+(?:in|to|into)\s+.+)?$/i);
  const entry = entryMatch ? entryMatch[1].trim() : text;
  const row = [new Date().toISOString(), entry];

  await bot.sendChatAction(chatId, 'typing');
  try {
    await appendToSheet(match.sheetId, match.tabName, row);
    await bot.sendMessage(chatId, `✅ Logged to "${match.friendlyName}": ${entry}`);
  } catch (e) {
    await bot.sendMessage(chatId, `Failed to write: ${(e as Error).message}`);
  }
}
