import { ok, fail } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();

    const upcoming = await query(
      `
      SELECT
        DATE(next_review_at) AS review_date,
        COUNT(*)::int AS count
      FROM learning_status
      WHERE user_id = $1
        AND status <> 'new'
        AND next_review_at IS NOT NULL
      GROUP BY DATE(next_review_at)
      ORDER BY review_date ASC
      LIMIT 14
      `,
      [session.userId]
    );

    const dueWords = await query(
      `
      SELECT w.word, w.annotation, w.chapter, ls.mastery_level, ls.next_review_at
      FROM learning_status ls
      JOIN words w ON w.id = ls.word_id
      WHERE ls.user_id = $1
        AND ls.status <> 'new'
        AND ls.next_review_at IS NOT NULL
        AND ls.next_review_at <= NOW()
      ORDER BY ls.next_review_at ASC
      LIMIT 80
      `,
      [session.userId]
    );

    return ok({ upcoming: upcoming.rows, dueWords: dueWords.rows });
  } catch {
    return fail("未登录", 401);
  }
}
