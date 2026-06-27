import { ok, fail } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORD_COLUMNS = `
  w.id,
  w.book_name,
  w.chapter,
  w.original_number,
  w.word,
  w.part_of_speech,
  w.annotation,
  w.expansion,
  w.collocation,
  w.example_sentence,
  w.example_translation,
  w.uk_phonetic,
  w.us_phonetic,
  w.uk_audio_url,
  w.us_audio_url,
  ls.status,
  ls.mastery_level,
  ls.total_reviews,
  ls.next_review_at
`;

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const newLimit = Math.min(Number(url.searchParams.get("newLimit") || 20), 50);
    const reviewLimit = Math.min(Number(url.searchParams.get("reviewLimit") || 120), 200);

    const due = await query(
      `
      SELECT ${WORD_COLUMNS}, 'review' AS task_type
      FROM learning_status ls
      JOIN words w ON w.id = ls.word_id
      WHERE ls.user_id = $1
        AND ls.status <> 'new'
        AND ls.next_review_at IS NOT NULL
        AND ls.next_review_at <= NOW()
      ORDER BY ls.next_review_at ASC
      LIMIT $2
      `,
      [session.userId, reviewLimit]
    );

    const fresh = await query(
      `
      SELECT ${WORD_COLUMNS}, 'new' AS task_type
      FROM learning_status ls
      JOIN words w ON w.id = ls.word_id
      WHERE ls.user_id = $1
        AND ls.status = 'new'
      ORDER BY w.chapter ASC, w.original_number ASC NULLS LAST, w.id ASC
      LIMIT $2
      `,
      [session.userId, newLimit]
    );

    return ok([...due.rows, ...fresh.rows]);
  } catch (err) {
    return fail(err instanceof Error && err.message === "UNAUTHORIZED" ? "未登录" : "读取学习任务失败", 401);
  }
}
