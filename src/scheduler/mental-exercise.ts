import TelegramBot from 'node-telegram-bot-api';
import { chat } from '../llm/client';
import {
  buildExercisePrompt,
  buildExerciseCheckPrompt,
  ExerciseType,
  ExerciseDifficulty,
} from '../llm/prompts';
import { logExerciseSent, getRecentExercises, ExerciseRecord } from '../db/queries/exercises';
import { config } from '../config';

const ALL_TYPES: ExerciseType[] = ['cognitive', 'physical', 'reflective'];
const ALL_DIFFICULTIES: ExerciseDifficulty[] = ['easy', 'medium', 'hard'];
const MAX_ATTEMPTS = 3;
const QUALITY_THRESHOLD = 7; // out of 10

const LABELS: Record<ExerciseType, string> = {
  cognitive: '🧩 Brain workout',
  reflective: '💭 Reflect',
  physical: '💪 Move',
};

interface GeneratedExercise {
  exercise: string;
  summary: string;
  score: number;
  verified: boolean;
}

/**
 * Pick the least-recently-used item from a candidate list, given recent history.
 * Robust across restarts since it derives from DB, not in-memory state.
 */
function pickLeastRecent<T extends string>(candidates: T[], recent: { type: T }[]): T {
  const lastSeen = new Map<T, number>();
  recent.forEach((r, i) => {
    // i=0 is most recent; store the earliest (smallest i) index per type
    if (!lastSeen.has(r.type)) lastSeen.set(r.type, i);
  });
  // Prefer the type with the largest "index" (oldest / never seen)
  let best = candidates[0];
  let bestIdx = -1;
  for (const c of candidates) {
    const idx = lastSeen.has(c) ? lastSeen.get(c)! : 999;
    if (idx > bestIdx) {
      bestIdx = idx;
      best = c;
    }
  }
  return best;
}

/**
 * Generate an exercise and run it through the quality gate. Regenerates (up to
 * MAX_ATTEMPTS) if the LLM reviewer flags it as low-effort. Always returns the
 * best attempt so the user still gets something.
 */
async function generateVerified(
  type: ExerciseType,
  difficulty: ExerciseDifficulty,
  recentSummaries: string[]
): Promise<GeneratedExercise> {
  let best: GeneratedExercise | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const retryHint = best && !best.verified ? `Scored ${best.score}/10 — too low. Make it genuinely challenging and substantive.` : undefined;

    const messages = buildExercisePrompt(type, difficulty, recentSummaries, retryHint);
    const raw = await chat(messages);

    const exerciseMatch = raw.match(/EXERCISE:\s*(.+?)(?:\n\s*SUMMARY:|$)/s);
    const summaryMatch = raw.match(/SUMMARY:\s*(.+)/s);
    const exercise = exerciseMatch?.[1]?.trim() ?? raw.trim();
    const summary = summaryMatch?.[1]?.trim() ?? exercise.slice(0, 80);

    if (!exercise) continue;

    // ── Quality gate: a separate LLM call reviews the exercise ──
    let score = 5;
    let passed = true;
    try {
      const checkRaw = await chat(buildExerciseCheckPrompt(exercise, type, difficulty));
      const jsonMatch = checkRaw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = Number(parsed.score) || 5;
        passed = Boolean(parsed.pass) && score >= QUALITY_THRESHOLD;
        console.log(`[exercise] Attempt ${attempt + 1}: score ${score}/10, pass=${passed}`);
      }
    } catch (err) {
      // If the check itself fails, trust the generation but mark unverified.
      console.warn('[exercise] Quality check failed, accepting unverified:', (err as Error).message);
      score = 6;
      passed = false;
    }

    const candidate: GeneratedExercise = { exercise, summary, score, verified: passed };
    if (!best || candidate.score > best.score) best = candidate;

    if (passed) break; // good enough — ship it
  }

  return best ?? { exercise: '', summary: '', score: 0, verified: false };
}

export async function sendMentalExercise(bot: TelegramBot) {
  const chatId = config.telegram.userId;

  try {
    const recent = await getRecentExercises(30);
    const summaries = recent.map(e => e.contentSummary);

    // Rotate type + difficulty to keep it varied (least-recently-used).
    const nextType = pickLeastRecent(
      ALL_TYPES,
      recent.map(e => ({ type: e.exerciseType }))
    );
    const nextDifficulty = pickLeastRecent(
      ALL_DIFFICULTIES,
      recent
        .filter(e => e.difficulty)
        .map(e => ({ type: e.difficulty as ExerciseDifficulty }))
    );

    const result = await generateVerified(nextType, nextDifficulty, summaries);
    if (!result.exercise) {
      console.error('[exercise] Generation produced nothing usable.');
      return;
    }

    await logExerciseSent(nextType, result.summary, result.exercise, nextDifficulty);

    const label = LABELS[nextType];
    const note = result.verified ? '' : '\n\n(this one did not fully pass my quality check — flagging it)';
    await bot.sendMessage(chatId, `${label}\n\n${result.exercise}${note}`);
    console.log(`[exercise] Sent ${nextType}/${nextDifficulty} (score ${result.score}/10, verified=${result.verified})`);
  } catch (err) {
    console.error('Failed to send mental exercise:', err);
  }
}
