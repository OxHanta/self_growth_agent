import { config } from './config';
import { createBot } from './bot/index';
import { startScheduler } from './scheduler/index';
import { initSelfState } from './db/queries/self';

async function main() {
  console.log('Starting Personal Growth Agent...');

  // Ensure the self-model row exists (safe to call every boot; no-op if present).
  await initSelfState();

  const bot = createBot();
  startScheduler(bot);

  if (config.telegram.userId === 0) {
    console.log('TELEGRAM_USER_ID is not set. Message the bot with /myid to get your numeric ID, update .env, then restart.');
  } else {
    console.log(`Bot running. Authorized user: ${config.telegram.userId}`);
  }
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
