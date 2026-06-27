import { ok, fail } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();

    const result = await query<{
      total_words: string;
      total_users: string;
      new_words: string;
      learned_words: string;
      due_reviews: string;
    }>(
      `
      SELECT
        (SELECT COUNT(*) FROM words) AS total_words,
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM learning_status WHERE user_id = $1 AND status = 'new') AS new_words,
        (SELECT COUNT(*) FROM learning_status WHERE user_id = $1 AND status <> 'new') AS learned_words,
        (
          SELECT COUNT(*)
          FROM learning_status
          WHERE user_id = $1
            AND status <> 'new'
            AND next_review_at IS NOT NULL
            AND next_review_at <= NOW()
        ) AS due_reviews
      `,
      [session.userId]
    );

    const row = result.rows[0];
    return ok({
      totalWords: Number(row.total_words || 0),
      totalUsers: Number(row.total_users || 0),
      newWords: Number(row.new_words || 0),
      learnedWords: Number(row.learned_words || 0),
      dueReviews: Number(row.due_reviews || 0)
    });
  } catch {
    return fail("未登录", 401);
  }
}
