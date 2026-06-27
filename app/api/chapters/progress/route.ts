import { ok, fail } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();

    const rows = await query(
      `
      SELECT
        COALESCE(w.chapter, '未分章节') AS chapter,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ls.status <> 'new')::int AS learned,
        COUNT(*) FILTER (WHERE ls.status = 'mastered')::int AS mastered,
        COUNT(*) FILTER (
          WHERE ls.status <> 'new'
            AND ls.next_review_at IS NOT NULL
            AND ls.next_review_at <= NOW()
        )::int AS due,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE ls.status <> 'new') / GREATEST(COUNT(*), 1),
          1
        )::float AS learned_percent
      FROM words w
      JOIN learning_status ls ON ls.word_id = w.id AND ls.user_id = $1
      GROUP BY COALESCE(w.chapter, '未分章节')
      ORDER BY chapter ASC
      `,
      [session.userId]
    );

    return ok(rows.rows);
  } catch {
    return fail("未登录", 401);
  }
}
