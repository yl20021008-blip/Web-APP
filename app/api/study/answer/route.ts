import { ok, fail, readJson } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { calculateReview } from "@/lib/learning";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await readJson<{ wordId?: number; result?: string }>(request);
    const wordId = Number(body.wordId);
    const result = String(body.result || "");

    if (!wordId) return fail("缺少 wordId", 400);
    if (!["忘记", "模糊", "正确", "熟练"].includes(result)) return fail("未知结果", 400);

    const current = await query<{
      id: number;
      mastery_level: number;
      first_learned_at: string | null;
      total_reviews: number;
      correct_count: number;
      wrong_count: number;
      fuzzy_count: number;
      consecutive_correct: number;
      difficult_flag: number;
    }>(
      `SELECT *
       FROM learning_status
       WHERE user_id = $1 AND word_id = $2`,
      [session.userId, wordId]
    );

    const row = current.rows[0];
    if (!row) return fail("找不到该单词学习状态", 404);

    const decision = calculateReview(Number(row.mastery_level || 0), result);
    const correctDelta = result === "正确" || result === "熟练" ? 1 : 0;
    const wrongDelta = result === "忘记" ? 1 : 0;
    const fuzzyDelta = result === "模糊" ? 1 : 0;
    const wrongCount = Number(row.wrong_count || 0) + wrongDelta;
    const fuzzyCount = Number(row.fuzzy_count || 0) + fuzzyDelta;
    const difficultFlag = wrongCount >= 3 || fuzzyCount >= 3 ? 1 : Number(row.difficult_flag || 0);

    await query(
      `
      UPDATE learning_status
      SET
        status = $1,
        mastery_level = $2,
        first_learned_at = COALESCE(first_learned_at, NOW()),
        last_review_at = NOW(),
        next_review_at = $3,
        total_reviews = COALESCE(total_reviews, 0) + 1,
        correct_count = COALESCE(correct_count, 0) + $4,
        wrong_count = COALESCE(wrong_count, 0) + $5,
        fuzzy_count = COALESCE(fuzzy_count, 0) + $6,
        consecutive_correct = CASE WHEN $7::int = 1 THEN COALESCE(consecutive_correct, 0) + 1 ELSE 0 END,
        difficult_flag = $8
      WHERE id = $9
      `,
      [
        decision.status,
        decision.newLevel,
        decision.nextReviewAt,
        correctDelta,
        wrongDelta,
        fuzzyDelta,
        decision.increaseCorrect ? 1 : 0,
        difficultFlag,
        row.id
      ]
    );

    await query(
      `
      INSERT INTO review_logs(
        user_id, word_id, reviewed_at, result, question_type,
        old_level, new_level, next_review_at
      )
      VALUES($1, $2, NOW(), $3, 'english_to_chinese', $4, $5, $6)
      `,
      [session.userId, wordId, result, Number(row.mastery_level || 0), decision.newLevel, decision.nextReviewAt]
    );

    return ok({
      wordId,
      result,
      newLevel: decision.newLevel,
      status: decision.status,
      nextReviewAt: decision.nextReviewAt.toISOString(),
      intervalLabel: decision.intervalLabel
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "提交失败", 400);
  }
}
