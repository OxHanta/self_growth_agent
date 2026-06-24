# Personal Growth Agent

Mill's personal AI accountability agent — runs on Telegram.

## Quick Start

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database
- Telegram bot (create via [@BotFather](https://t.me/BotFather))
- API keys: Groq, OpenRouter (optional), Gemini (optional)
- Google Cloud project with Sheets API enabled

### 2. Configure
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Google Sheets OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → enable **Google Sheets API**
3. Create OAuth 2.0 credentials (Desktop app) → download as `credentials.json`
4. Place `credentials.json` in the project root

### 4. Setup (DB + Sheets)
```bash
npm run setup
# Opens browser for Google OAuth on first run
# Creates all DB tables + provisions 3 Google Sheets
```

### 5. Run
```bash
npm run dev       # Development
npm start         # Production (after npm run build)
```

---

## Features

| Feature | How to use |
|---|---|
| Log a habit | "logged gym", "did my workout" |
| Skip a habit | "skipped gym today" |
| Check streaks | "habit status" / "how are my habits" |
| Add a task | "I need to call the bank" |
| List tasks | "tasks" / "what am I procrastinating on" |
| Mark done | "done 1" (after listing) |
| Set reminder | "remind me at 3pm to pay rent" |
| List reminders | "reminders" |
| Cancel reminder | "cancel reminder 1" |
| Advisory | "should I take this contract?" |
| Read sheet | "what's in my budget sheet?" |
| Log to sheet | "log $40 coffee in budget" |
| Mental exercises | Automatic — 3x daily |
| Habit check-in | Automatic — 8pm daily |

---

## Environment Variables

See [.env.example](.env.example) for full list.

---

## Deployment (Railway)

1. Create a Railway project
2. Add a PostgreSQL plugin
3. Set all env vars from `.env.example`
4. Upload `credentials.json` and `token.json` (run setup locally first)
5. Deploy — Railway keeps the process alive for proactive messaging
