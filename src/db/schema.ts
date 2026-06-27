import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  varchar,
  date,
  bigint,
} from 'drizzle-orm/pg-core';

// ── Habits ────────────────────────────────────────────────────────────────────
export const habits = pgTable('habits', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 20 }).notNull().default('other'), // financial | health | other
  targetFrequency: varchar('target_frequency', { length: 20 }).notNull().default('daily'),
  streak: integer('streak').notNull().default(0),
  lastCompleted: date('last_completed'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Habit Logs ─────────────────────────────────────────────────────────────────
export const habitLogs = pgTable('habit_logs', {
  id: serial('id').primaryKey(),
  habitId: integer('habit_id').notNull().references(() => habits.id),
  date: date('date').notNull(),
  completed: boolean('completed').notNull().default(true),
  note: text('note'),
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
});

// ── Tasks (procrastination tracking) ─────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  description: text('description').notNull(),
  deadline: timestamp('deadline'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | done | cancelled
  timesDeferred: integer('times_deferred').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Decisions (advisory log) ───────────────────────────────────────────────────
export const decisions = pgTable('decisions', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 30 }).notNull().default('general'), // business | investment | life | general
  question: text('question').notNull(),
  contextGiven: text('context_given'),
  adviceGiven: text('advice_given'),
  outcome: text('outcome'), // filled in later
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Reminders ─────────────────────────────────────────────────────────────────
export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  scheduledTime: timestamp('scheduled_time').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | sent | cancelled
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Mental Exercises Sent ─────────────────────────────────────────────────────
export const mentalExercisesSent = pgTable('mental_exercises_sent', {
  id: serial('id').primaryKey(),
  exerciseType: varchar('exercise_type', { length: 20 }).notNull(), // cognitive | reflective
  contentSummary: text('content_summary').notNull(),
  fullContent: text('full_content').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

// ── Sheet Config ──────────────────────────────────────────────────────────────
export const sheetConfig = pgTable('sheet_config', {
  id: serial('id').primaryKey(),
  friendlyName: varchar('friendly_name', { length: 50 }).notNull(),
  sheetId: varchar('sheet_id', { length: 100 }).notNull(),
  tabName: varchar('tab_name', { length: 50 }).notNull(),
  purpose: varchar('purpose', { length: 20 }).notNull().default('both'), // read | write | both
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Conversation Memory ────────────────────────────────────────────────────────
export const conversationMessages = pgTable('conversation_messages', {
  id: serial('id').primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  role: varchar('role', { length: 10 }).notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Agent Self-Model (single row, id=1) ───────────────────────────────────────
// The agent's living sense of self: who it is, its traits, its beliefs about the
// user, and what it's currently focused on. Evolves via the nightly reflection loop.
export const selfState = pgTable('self_state', {
  id: integer('id').primaryKey().default(1),
  name: varchar('name', { length: 50 }).notNull().default('Better'),
  identity: text('identity').notNull(), // who I am, in my own words
  traits: text('traits').notNull().default('[]'), // JSON array of self-observed tendencies
  beliefsAboutUser: text('beliefs_about_user').notNull().default('[]'), // JSON array of observations about the user
  currentFocus: text('current_focus'), // what I'm currently focused on for the user
  growthNote: text('growth_note'), // a self-aware note about how I should improve
  lastReflectionAt: timestamp('last_reflection_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Agent Preferences (user-stated style/constraint rules) ─────────────────────
export const agentPreferences = pgTable('agent_preferences', {
  id: serial('id').primaryKey(),
  // Short canonical key, e.g. "no_exclamation_marks" — for dedup/lookup
  key: varchar('key', { length: 100 }).notNull().unique(),
  // Human-readable rule the agent must obey, e.g. "Never use exclamation marks"
  rule: text('rule').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Self-Reflection Journal (append-only) ──────────────────────────────────────
export const selfReflections = pgTable('self_reflections', {
  id: serial('id').primaryKey(),
  reflection: text('reflection').notNull(),
  theme: varchar('theme', { length: 30 }).notNull().default('general'), // self | user_patterns | relationship | progress
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
