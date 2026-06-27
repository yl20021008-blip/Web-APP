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

function dedupeRows(rows: any[]) {
  const seen = new Set<number>();
  const result: any[] = [];
  for (const row of rows) {
    if (!seen.has(Number(row.id))) {
      seen.add(Number(row.id));
      result.push(row);
    }
  }
  return result;
}

function interleaveSmart(due: any[], weak: any[], fresh: any[], target: number) {
  // v2.9 smart flow: prefer due review, then weak words, then new words.
  // Pattern: review, review, weak, review, new, weak, review, new
  const pattern = ["due", "due", "weak", "due", "new", "weak", "due", "new"];
  const buckets: Record<string, any[]> = { due: [...due], weak: [...weak], new: [...fresh] };
  const result: any[] = [];

  let i = 0;
  while (result.length < target && (buckets.due.length || buckets.weak.length || buckets.new.length)) {
    const key = pattern[i % pattern.length];
    if (buckets[key].length) {
      result.push(buckets[key].shift());
    } else if (buckets.due.length) {
      result.push(buckets.due.shift());
    } else if (buckets.weak.length) {
      result.push(buckets.weak.shift());
    } else if (buckets.new.length) {
      result.push(buckets.new.shift());
    }
    i++;
  }

  return dedupeRows(result).slice(0, target);
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const mode = String(url.searchParams.get("mode") || "today");
    const newLimit = Math.min(Number(url.searchParams.get("newLimit") || 20), 80);
    const reviewLimit = Math.min(Number(url.searchParams.get("reviewLimit") || 120), 240);
    const target = Math.min(Number(url.searchParams.get("target") || 30), 80);

    if (mode === "weak") {
      const weak = await query(
        `
        SELECT ${WORD_COLUMNS}, 'review' AS task_type
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
          ls.next_review_at ASC NULLS LAST
        LIMIT $2
        `,
        [session.userId, reviewLimit]
      );
      return ok(weak.rows);
    }

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

    if (mode === "smart") {
      const weak = await query(
        `
        SELECT ${WORD_COLUMNS}, 'review' AS task_type
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
          ls.next_review_at ASC NULLS LAST
        LIMIT $2
        `,
        [session.userId, Math.max(20, target)]
      );

      return ok(interleaveSmart(due.rows, weak.rows, fresh.rows, target));
    }

    return ok([...due.rows, ...fresh.rows]);
  } catch (err) {
    return fail(err instanceof Error && err.message === "UNAUTHORIZED" ? "未登录" : "读取学习任务失败", 401);
  }
}
