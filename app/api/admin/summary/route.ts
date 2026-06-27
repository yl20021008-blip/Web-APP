import { ok, fail } from "@/app/api/_helpers";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkPin(request: Request): boolean {
  const expected = process.env.ADMIN_PIN;
  const url = new URL(request.url);
  const pin = url.searchParams.get("pin");
  return Boolean(expected && pin && expected === pin);
}

export async function GET(request: Request) {
  if (!checkPin(request)) return fail("管理员 PIN 不正确。", 401);

  const overview = await query(
    `
    SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM words)::int AS words,
      (SELECT COUNT(*) FROM learning_status)::int AS status_rows,
      (SELECT COUNT(*) FROM review_logs)::int AS review_logs,
      (SELECT COUNT(*) FROM story_groups)::int AS stories
    `
  );

  const chapters = await query(
    `
    SELECT COALESCE(chapter, '未分章节') AS chapter, COUNT(*)::int AS count
    FROM words
    GROUP BY COALESCE(chapter, '未分章节')
    ORDER BY chapter ASC
    `
  );

  return ok({ overview: overview.rows[0], chapters: chapters.rows });
}
