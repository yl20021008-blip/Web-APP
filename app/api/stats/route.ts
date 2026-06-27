import { ok, fail } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();

    const totals = await query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status='new')::int AS new_words,
        COUNT(*) FILTER (WHERE status<>'new')::int AS learned_words,
        COUNT(*) FILTER (WHERE status='mastered')::int AS mastered_words,
        COUNT(*) FILTER (WHERE difficult_flag=1)::int AS difficult_words,
        COALESCE(SUM(total_reviews), 0)::int AS total_reviews
      FROM learning_status
      WHERE user_id = $1
      `,
      [session.userId]
    );

    const recent = await query(
      `
      SELECT DATE(reviewed_at) AS day, COUNT(*)::int AS count
      FROM review_logs
      WHERE user_id = $1
        AND reviewed_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(reviewed_at)
      ORDER BY day ASC
      `,
      [session.userId]
    );

    const difficult = await query(
      `
      SELECT w.word, w.annotation, w.chapter, ls.wrong_count, ls.fuzzy_count, ls.mastery_level
      FROM learning_status ls
      JOIN words w ON w.id = ls.word_id
      WHERE ls.user_id = $1 AND ls.difficult_flag = 1
      ORDER BY (ls.wrong_count + ls.fuzzy_count) DESC, ls.mastery_level ASC
      LIMIT 50
      `,
      [session.userId]
    );

    return ok({ totals: totals.rows[0], recent: recent.rows, difficult: difficult.rows });
  } catch {
    return fail("未登录", 401);
  }
}
