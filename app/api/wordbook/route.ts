import { ok, fail } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || 40), 10), 100);
    const search = String(url.searchParams.get("search") || "").trim();
    const chapter = String(url.searchParams.get("chapter") || "").trim();
    const offset = (page - 1) * pageSize;

    const conditions = [`ls.user_id = $1`];
    const params: unknown[] = [session.userId];
    let idx = 2;

    if (search) {
      conditions.push(`(w.word ILIKE $${idx} OR w.annotation ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (chapter) {
      conditions.push(`w.chapter = $${idx}`);
      params.push(chapter);
      idx++;
    }

    params.push(pageSize, offset);
    const sql = `
      SELECT
        w.id, w.word, w.part_of_speech, w.annotation, w.chapter,
        w.example_sentence, w.example_translation, w.uk_phonetic, w.us_phonetic,
        ls.status, ls.mastery_level, ls.total_reviews, ls.next_review_at
      FROM words w
      JOIN learning_status ls ON ls.word_id = w.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY w.chapter ASC, w.original_number ASC NULLS LAST, w.id ASC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const rows = await query(sql, params);

    const chapters = await query(
      `SELECT DISTINCT chapter FROM words WHERE chapter IS NOT NULL ORDER BY chapter ASC LIMIT 200`
    );

    return ok({ rows: rows.rows, chapters: chapters.rows.map((r) => r.chapter), page, pageSize });
  } catch {
    return fail("未登录", 401);
  }
}
