import { config } from './config';
import { createBot } from './bot/index';
import { startScheduler } from './scheduler/index';

async function main() {
  console.log('Starting Personal Growth Agent...');

  const bot = createBot();
  startScheduler(bot);

  if (config.telegram.userId === 0) {
    console.log('⚠️  TELEGRAM_USER_ID is not set. Message the bot with /myid to get your numeric ID, update .env, then restart.');
  } else {
    console.log(`Bot running. Authorized user: ${config.telegram.userId}`);
  }
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
