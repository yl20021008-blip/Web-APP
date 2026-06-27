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
  ls.wrong_count,
  ls.fuzzy_count,
  ls.correct_count,
  ls.difficult_flag,
  ls.next_review_at
`;

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const mode = String(url.searchParams.get("mode") || "mixed");
    const limit = Math.min(Number(url.searchParams.get("limit") || 30), 80);

    if (mode === "output") {
      // v3.0.1 hotfix:
      // Do not depend on learning_status.reviewed_at because older databases may not have this column.
      // Prefer learned / reviewed words. If the learner has few learned words, fall back to new words.
      const learned = await query(
        `
        SELECT ${WORD_COLUMNS}, 'output' AS task_type
        FROM learning_status ls
        JOIN words w ON w.id = ls.word_id
        WHERE ls.user_id = $1
          AND ls.status <> 'new'
        ORDER BY
          COALESCE(ls.total_reviews, 0) DESC,
          COALESCE(ls.mastery_level, 0) ASC,
          w.chapter ASC,
          w.original_number ASC NULLS LAST,
          w.id ASC
        LIMIT $2
        `,
        [session.userId, limit]
      );

      if (learned.rows.length > 0) return ok(learned.rows);

      const fresh = await query(
        `
        SELECT ${WORD_COLUMNS}, 'output' AS task_type
        FROM learning_status ls
        JOIN words w ON w.id = ls.word_id
        WHERE ls.user_id = $1
        ORDER BY
          w.chapter ASC,
          w.original_number ASC NULLS LAST,
          w.id ASC
        LIMIT $2
        `,
        [session.userId, limit]
      );

      return ok(fresh.rows);
    }

    if (mode === "weak") {
      const rows = await query(
        `
        SELECT ${WORD_COLUMNS}, 'weak' AS task_type
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
          ls.mastery_level ASC,
          w.id ASC
        LIMIT $2
        `,
        [session.userId, limit]
      );
      return ok(rows.rows);
    }

    const rows = await query(
      `
      SELECT ${WORD_COLUMNS}, 'training' AS task_type
      FROM learning_status ls
      JOIN words w ON w.id = ls.word_id
      WHERE ls.user_id = $1
      ORDER BY
        CASE
          WHEN ls.next_review_at IS NOT NULL AND ls.next_review_at <= NOW() THEN 0
          WHEN COALESCE(ls.wrong_count, 0) + COALESCE(ls.fuzzy_count, 0) > 0 THEN 1
          WHEN ls.status = 'new' THEN 3
          ELSE 2
        END,
        ls.mastery_level ASC,
        w.chapter ASC,
        w.original_number ASC NULLS LAST,
        w.id ASC
      LIMIT $2
      `,
      [session.userId, limit]
    );

    return ok(rows.rows);
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") return fail("未登录", 401);
    console.error("training words error:", err);
    return fail(err instanceof Error ? `训练词读取失败：${err.message}` : "训练词读取失败", 500);
  }
}
