import { query } from "@/lib/db";

export async function ensureUserWordStatus(userId: number): Promise<number> {
  const result = await query(
    `
    INSERT INTO learning_status (
      user_id, word_id, status, mastery_level,
      total_reviews, correct_count, wrong_count, fuzzy_count,
      consecutive_correct, difficult_flag
    )
    SELECT
      $1, w.id, 'new', 0,
      0, 0, 0, 0,
      0, 0
    FROM words w
    LEFT JOIN learning_status ls
      ON ls.user_id = $1 AND ls.word_id = w.id
    WHERE ls.word_id IS NULL
    ON CONFLICT (user_id, word_id) DO NOTHING
    `,
    [userId]
  );

  return result.rowCount || 0;
}

export function calculateReview(currentLevel: number, result: string): {
  newLevel: number;
  nextReviewAt: Date;
  status: string;
  increaseCorrect: boolean;
} {
  const now = new Date();
  const level = Math.max(0, Math.min(Number(currentLevel || 0), 6));

  if (result === "忘记") {
    return {
      newLevel: 0,
      nextReviewAt: new Date(now.getTime() + 10 * 60 * 1000),
      status: "learning",
      increaseCorrect: false
    };
  }

  if (result === "模糊") {
    return {
      newLevel: Math.max(1, level),
      nextReviewAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      status: "reviewing",
      increaseCorrect: false
    };
  }

  const nextLevel = result === "熟练" ? Math.min(level + 2, 6) : Math.min(level + 1, 6);
  const intervals: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30, 6: 60 };
  const days = intervals[nextLevel] || 1;

  return {
    newLevel: nextLevel,
    nextReviewAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
    status: nextLevel >= 5 ? "mastered" : "reviewing",
    increaseCorrect: true
  };
}
