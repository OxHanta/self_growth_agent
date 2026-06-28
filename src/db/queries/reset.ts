import { pool } from '../client';

/**
 * FULL FACTORY RESET. Wipes everything so the agent starts completely fresh:
 * conversation history, self-model, user profile (re-triggers onboarding),
 * preferences, reflections, AND all operational data (habits, tasks, reminders,
 * decisions, exercise log). sheet_config is preserved (it's infrastructure that
 * would break the Google Sheets integration if wiped).
 *
 * After this runs, the next message triggers a fresh onboarding.
 */
export async function resetAllData(): Promise<void> {
    const client = await pool.connect();
    try {
        // TRUNCATE with RESTART IDENTITY resets SERIAL sequences; CASCADE drops dependent rows.
        await client.query(`
      TRUNCATE TABLE
        conversation_messages,
        self_reflections,
        self_state,
        agent_preferences,
        user_profiles,
        habit_logs,
        habits,
        tasks,
        decisions,
        reminders,
        mental_exercises_sent
      RESTART IDENTITY CASCADE;
    `);
        console.log('[reset] All agent data wiped (factory reset). sheet_config preserved.');
    } finally {
        client.release();
    }
}
