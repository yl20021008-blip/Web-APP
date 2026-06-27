import { ok, fail } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();

    const today = await query(
      `
      SELECT
        COUNT(*)::int AS reviewed_today,
        COUNT(*) FILTER (WHERE result IN ('正确', '熟练'))::int AS remembered_today,
        COUNT(*) FILTER (WHERE result = '忘记')::int AS forgot_today,
        COUNT(*) FILTER (WHERE result = '模糊')::int AS fuzzy_today
      FROM review_logs
      WHERE user_id = $1
        AND reviewed_at >= CURRENT_DATE
        AND reviewed_at < CURRENT_DATE + INTERVAL '1 day'
      `,
      [session.userId]
    );

    const tomorrow = await query(
      `
      SELECT COUNT(*)::int AS due_tomorrow
      FROM learning_status
      WHERE user_id = $1
        AND status <> 'new'
        AND next_review_at >= CURRENT_DATE + INTERVAL '1 day'
        AND next_review_at < CURRENT_DATE + INTERVAL '2 day'
      `,
      [session.userId]
    );

    const weak = await query(
      `
      SELECT w.word, w.annotation, w.chapter, ls.wrong_count, ls.fuzzy_count, ls.mastery_level
      FROM learning_status ls
      JOIN words w ON w.id = ls.word_id
      WHERE ls.user_id = $1
        AND ls.status <> 'new'
        AND (
          COALESCE(ls.difficult_flag, 0) = 1
          OR COALESCE(ls.wrong_count, 0) > 0
          OR COALESCE(ls.fuzzy_count, 0) > 0
          OR ls.mastery_level <= 2
        )
      ORDER BY
        COALESCE(ls.difficult_flag, 0) DESC,
        (COALESCE(ls.wrong_count, 0) + COALESCE(ls.fuzzy_count, 0)) DESC,
        ls.mastery_level ASC
      LIMIT 8
      `,
      [session.userId]
    );

    return ok({
      today: today.rows[0],
      tomorrow: tomorrow.rows[0],
      weak: weak.rows
    });
  } catch {
    return fail("未登录", 401);
  }
}
