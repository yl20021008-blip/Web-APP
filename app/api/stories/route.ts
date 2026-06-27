import { ok, fail, readJson } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanMeaning(text: string | null): string {
  if (!text) return "关键词";
  return text.replace(/\s+/g, " ").slice(0, 28);
}

function buildStory(selected: Array<{ id: number; word: string; annotation: string | null }>) {
  const linesEn = selected.map((w, i) => {
    const connector = ["At first", "Soon after that", "During the discussion", "Near the end"][i % 4];
    return `${connector}, I noticed **${w.word}**, a clue that helped me remember ${cleanMeaning(w.annotation)}.`;
  });
  const linesZh = selected.map((w, i) => {
    const connector = ["一开始", "随后", "讨论过程中", "接近尾声时"][i % 4];
    return `${connector}，我注意到 **${w.word}**，它帮助我记住“${cleanMeaning(w.annotation)}”。`;
  });

  return {
    titleEn: `A Memory Route with ${selected.length} Words`,
    titleZh: `${selected.length}个词的记忆路线`,
    storyEn: linesEn.join("\n"),
    storyZh: linesZh.join("\n"),
    memoryTip: "按故事顺序回忆单词，再回到中文释义检查。"
  };
}

export async function GET() {
  try {
    const session = await requireSession();
    const rows = await query(
      `
      SELECT id, group_number, title_en, title_zh, story_en, story_zh, memory_tip, word_count, created_at
      FROM story_groups
      WHERE user_id = $1
      ORDER BY group_number DESC
      LIMIT 20
      `,
      [session.userId]
    );
    return ok(rows.rows);
  } catch {
    return fail("未登录", 401);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await readJson<{ size?: number }>(request);
    const size = Math.min(Math.max(Number(body.size || 30), 5), 30);

    const selected = await query<{ id: number; word: string; annotation: string | null }>(
      `
      SELECT w.id, w.word, w.annotation
      FROM learning_status ls
      JOIN words w ON w.id = ls.word_id
      WHERE ls.user_id = $1
        AND ls.status <> 'new'
        AND NOT EXISTS (
          SELECT 1 FROM story_group_items sgi
          WHERE sgi.user_id = $1 AND sgi.word_id = w.id
        )
      ORDER BY ls.first_learned_at ASC NULLS LAST, ls.last_review_at ASC NULLS LAST, w.id ASC
      LIMIT $2
      `,
      [session.userId, size]
    );

    if (selected.rows.length < 5) {
      return fail("已学单词不足，至少需要5个已学词才能生成故事。", 400);
    }

    const numberRow = await query<{ next_no: string }>(
      `SELECT COALESCE(MAX(group_number), 0) + 1 AS next_no FROM story_groups WHERE user_id = $1`,
      [session.userId]
    );
    const groupNumber = Number(numberRow.rows[0].next_no || 1);
    const story = buildStory(selected.rows);

    const inserted = await query<{ id: number }>(
      `
      INSERT INTO story_groups(
        user_id, group_number, title_en, title_zh, story_en, story_zh,
        memory_tip, style, provider, word_count, created_at
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, 'web_memory_route', 'nextjs_local', $8, NOW())
      RETURNING id
      `,
      [
        session.userId,
        groupNumber,
        story.titleEn,
        story.titleZh,
        story.storyEn,
        story.storyZh,
        story.memoryTip,
        selected.rows.length
      ]
    );

    const storyGroupId = inserted.rows[0].id;

    for (let i = 0; i < selected.rows.length; i++) {
      const word = selected.rows[i];
      await query(
        `
        INSERT INTO story_group_items(user_id, story_group_id, word_id, position, sentence_en, sentence_zh)
        VALUES($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        `,
        [
          session.userId,
          storyGroupId,
          word.id,
          i + 1,
          `Remember ${word.word} through this route.`,
          `通过这条路线记住 ${word.word}。`
        ]
      );
    }

    return ok({ id: storyGroupId, groupNumber, ...story, wordCount: selected.rows.length });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "生成故事失败", 400);
  }
}
