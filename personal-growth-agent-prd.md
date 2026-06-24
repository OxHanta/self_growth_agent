# PRD: Personal Growth Agent ("Self/Better")

**Owner:** Mill
**Status:** Draft v1
**Build environment:** Google Antigravity (agentic IDE)
**Target interface:** Telegram bot

---

## 1. Problem Statement

Mill wants a personal AI agent, accessible via Telegram, that actively supports becoming a
better version of himself across two core dimensions in his 30s: **financial discipline** and
**physical health** — underpinned by daily habit structure, procrastination-killing, decision
support, and light cognitive/reflective exercise. The agent should feel like an ever-present
accountability partner, not a passive chatbot: it initiates check-ins, remembers context, and
can read/write structured personal data in Google Sheets when asked.

## 2. Goals

- Help Mill build and sustain better financial and health habits through daily structure and accountability.
- Reduce procrastination via reminders, check-ins, and gentle confrontation of avoidance patterns.
- Serve as a sounding board for business, investment, and everyday decisions (general advice, not data-driven financial planning).
- Deliver a daily mental exercise (cognitive puzzle or reflective prompt — agent's choice) to build a consistent mental-fitness habit.
- Allow Mill to set reminders conversationally.
- Allow the agent to read from and write to a Google Sheet on request, for personal data logging (habits, workouts, expenses, etc.).

## 3. Non-Goals (v1)

- **No real financial data integration for advisory.** The agent does not connect to bank accounts, real spending data, or portfolios to generate investment/financial advice. Financial advisory stays general and educational — Mill provides context conversationally if relevant, the agent doesn't pull it from Sheets automatically.
- No multi-user support — this is a single-user (Mill-only) agent.
- No mobile/web app UI — Telegram is the only interface in v1.
- No voice/audio input or output in v1.
- No spiritual guidance module (explicitly descoped in earlier discussion).

## 4. Users

Single user: Mill. The bot must be locked to his Telegram user ID only.

## 5. Core Features

### 5.1 Habit & Health Tracking
- Mill can log habits via chat (e.g. "logged my workout", "skipped gym today").
- Agent tracks streaks and current status per habit.
- Agent can proactively check in (e.g. evening: "Did you train today?") if a habit is due and unlogged.
- Habits are categorized loosely under **financial** and **health**, since those are the two stated improvement axes, plus a general/other bucket.

### 5.2 Procrastination & Task Support
- Mill can tell the agent about a task he's avoiding.
- Agent can set a reminder for it, follow up later, and track how many times a task has been deferred.
- Agent calls out repeated avoidance directly rather than being purely sympathetic — tone should be supportive but blunt, per Mill's stated preference for directness.
- All deferred tasks are treated equally — no urgency tiering or prioritization logic in v1.

### 5.3 Decision & Advisory Support
- Mill can ask for input on a business decision, investment question, or general life decision.
- Agent reasons through tradeoffs conversationally — general advice grounded in sound reasoning frameworks, not real-time market data or Mill's actual financial position.
- Agent should disclose, when relevant, that it's not a licensed financial advisor and that this is general information, not personalized financial advice.
- Past decisions and the advice given are logged so the agent can refer back ("last month you were weighing X, how did that go?").

### 5.4 Daily Mental Exercise
- Three times per day — morning, afternoon, and night (times configurable, see Section 7) — the agent sends an unprompted mental exercise.
- Agent alternates or freely chooses between:
  - **Cognitive/puzzle type:** logic puzzles, riddles, short memory or pattern exercises.
  - **Reflective/journaling type:** short prompts on goals, self-awareness, or the day ahead.
- Mill can respond inline; agent doesn't require a response to continue functioning, but can acknowledge if he does.
- No repeats within a rolling window (e.g. don't repeat the same exercise within 30 days) — requires a small log of exercises already sent.

### 5.5 Reminders
- Mill can set reminders conversationally: "remind me to pay rent on the 28th", "remind me in 2 hours to call the bank."
- Agent parses natural language into a concrete date/time and confirms back before saving.
- Agent sends the reminder via Telegram message at the scheduled time.
- Mill can list active reminders and cancel one.

### 5.6 Google Sheets Integration
- On request, the agent can:
  - **Read** data from a specified Google Sheet (e.g. "what's in my expenses sheet this month?").
  - **Write/append** new entries to a specified Google Sheet (e.g. "log this as a $40 expense in my budget sheet").
- This is on-demand only in v1 — the agent does not poll or sync Sheets automatically in the background.
- Mill specifies which sheet/tab via setup/config (see Section 7) rather than the agent guessing.
- Used for personal data logging — not for feeding financial advisory reasoning (see Non-Goals).

## 6. Tone & Interaction Style

- Direct, no filler, no excessive hedging — matches Mill's stated preference.
- Encouraging but blunt on procrastination and missed habits — calls out patterns rather than only validating feelings.
- Concise replies suited to a chat interface, not essay-length responses.
- Proactive: the agent initiates check-ins and the daily exercise rather than waiting to be prompted for everything.

## 7. Setup & Configuration

- Single authorized Telegram user ID, set at deployment.
- Google account connection (OAuth) authorized once to allow Sheets read/write access.
- Mill specifies which Google Sheet(s)/tab(s) are valid targets during setup (e.g. a "Budget" sheet, a "Workouts" sheet) — agent works within this known set rather than open-ended sheet discovery.
- The sheet(s) used will be newly created for this agent (not an existing external tracker) — the agent or build process should provision the sheet and tab structure as part of setup, matching the data model in Section 9.
- Configurable daily times for: morning/afternoon/night mental exercises, evening habit check-in.

## 8. Functional Requirements Summary

| # | Requirement |
|---|---|
| FR1 | Bot responds only to the authorized Telegram user; ignores all other senders. |
| FR2 | Bot can log a habit entry and report current streak on request. |
| FR3 | Bot proactively sends a check-in if a tracked habit is undone by its check-in time. |
| FR4 | Bot can create, list, and cancel reminders with natural-language time parsing. |
| FR5 | Bot sends a mental exercise (cognitive or reflective) at three configured times daily (morning, afternoon, night), without repeating recent exercises. |
| FR6 | Bot can hold an advisory conversation (business/investment/decision) using general reasoning only — no live financial data lookup. |
| FR7 | Bot logs decisions/advice given so it can reference them in future conversations. |
| FR8 | Bot can read specified ranges/tabs from an authorized Google Sheet on request. |
| FR9 | Bot can append a new row/entry to an authorized Google Sheet on request. |
| FR10 | Bot tracks and can report deferred-task counts for procrastination patterns. |

## 9. Data Model (high-level)

- **habits** — name, category (financial/health/other), target frequency, streak, last completed.
- **habit_logs** — habit reference, date, completed (bool), optional note.
- **tasks** — description, deadline, status, times deferred.
- **decisions** — category, question, context given, advice given, optional later outcome.
- **reminders** — text, scheduled time, status (pending/sent/cancelled).
- **mental_exercises_sent** — exercise type, content/summary, date sent (to prevent repeats).
- **sheet_config** — friendly name, Google Sheet ID, tab name, purpose (read/write/both).

## 10. Technical Notes for Build (Antigravity context)

- Telegram Bot API for messaging (webhook or polling).
- LLM backend: existing multi-provider fallback chain (Groq → OpenRouter free → Gemini free) already scaffolded in Phase 1; Antigravity's own model access (Gemini 3 Pro / Claude, depending on what's configured in the IDE) is for *building* the agent, not necessarily what powers it at runtime — these are separate concerns and shouldn't be conflated.
- Database: PostgreSQL for the data model above.
- Scheduler: cron-based jobs for the three daily mental exercises, habit check-ins, and reminder delivery.
- Google Sheets API (OAuth2) for read/append operations, scoped to the sheets Mill explicitly configures.
- Deployment target: persistent server (e.g. Railway), since proactive messaging requires an always-on process, not a serverless on-demand function.

## 11. Success Criteria

- Mill receives mental exercises consistently at all three configured daily times without manual prompting.
- Habit streaks are accurately tracked and referenced in conversation.
- Reminders fire reliably at the correct time.
- Mill can log and retrieve data from at least one Google Sheet without errors.
- Advisory conversations feel useful and direct, with no false impression of using real financial data.
