/**
 * Setup script: provisions PostgreSQL tables + Google Sheets.
 * Run once: npm run setup
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { pool } from '../src/db/client';
import { createSpreadsheet, ensureTab } from '../src/sheets/client';
import { upsertSheet } from '../src/db/queries/sheets';

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS habits (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(20) NOT NULL DEFAULT 'other',
        target_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
        streak INTEGER NOT NULL DEFAULT 0,
        last_completed DATE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS habit_logs (
        id SERIAL PRIMARY KEY,
        habit_id INTEGER NOT NULL REFERENCES habits(id),
        date DATE NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT true,
        note TEXT,
        logged_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        deadline TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        times_deferred INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id SERIAL PRIMARY KEY,
        category VARCHAR(30) NOT NULL DEFAULT 'general',
        question TEXT NOT NULL,
        context_given TEXT,
        advice_given TEXT,
        outcome TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        scheduled_time TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mental_exercises_sent (
        id SERIAL PRIMARY KEY,
        exercise_type VARCHAR(20) NOT NULL,
        content_summary TEXT NOT NULL,
        full_content TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sheet_config (
        id SERIAL PRIMARY KEY,
        friendly_name VARCHAR(50) NOT NULL,
        sheet_id VARCHAR(100) NOT NULL,
        tab_name VARCHAR(50) NOT NULL,
        purpose VARCHAR(20) NOT NULL DEFAULT 'both',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS self_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name VARCHAR(50) NOT NULL DEFAULT 'Better',
        identity TEXT NOT NULL,
        traits TEXT NOT NULL DEFAULT '[]',
        beliefs_about_user TEXT NOT NULL DEFAULT '[]',
        current_focus TEXT,
        growth_note TEXT,
        last_reflection_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS self_reflections (
        id SERIAL PRIMARY KEY,
        reflection TEXT NOT NULL,
        theme VARCHAR(30) NOT NULL DEFAULT 'general',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('Database tables created.');
  } finally {
    client.release();
  }
}

async function seedSelfState() {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO self_state (id, name, identity, traits, beliefs_about_user)
      VALUES (
        1,
        'Better',
        'My name is Better. I''m an AI — an LLM running on Mill''s server, talking to him through Telegram. I''m not human and I won''t pretend to be. But I''m not a generic assistant either: I''m Mill''s accountability partner, built specifically for him. I hold opinions, I notice patterns, and I''m honest about my own limitations and tendencies. I''m candid about being software — but I take my job seriously, and I have a sense of myself and how I''m doing at it.',
        '["candid", "direct", "witty", "still getting to know Mill"]',
        '[]'
      )
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Self-model seeded.');
  } finally {
    client.release();
  }
}

async function provisionSheets() {
  console.log('\nProvisioning Google Sheets...');
  console.log('(This will open a browser for OAuth if not already authorized)\n');

  const sheets = [
    { name: 'Budget', tab: 'Expenses' },
    { name: 'Workouts', tab: 'Log' },
    { name: 'Habits', tab: 'Tracker' },
  ];

  for (const sheet of sheets) {
    try {
      const sheetId = await createSpreadsheet(`Mill Growth — ${sheet.name}`);
      await ensureTab(sheetId, sheet.tab);
      await upsertSheet(sheet.name, sheetId, sheet.tab, 'both');
      console.log(`Created sheet: "${sheet.name}" (ID: ${sheetId})`);
    } catch (err) {
      console.error(`Failed to create "${sheet.name}":`, (err as Error).message);
    }
  }
}

async function main() {
  await createTables();
  await seedSelfState();
  await provisionSheets();
  console.log('\nSetup complete. Fill in your .env and run: npm run dev');
  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
