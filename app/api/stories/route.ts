import { serviceFailure, ok, fail, readJson } from "@/app/api/_helpers";
import { requireSession } from "@/lib/auth";
import { generateStory, StoryError } from "@/lib/story-ai";
import { getPool, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function POST(request: Request) {
  let client: import("pg").PoolClient | undefined;
  try {
    const session = await requireSession();
    const body = await readJson<{ size?: number }>(request);
    const size = Number(body.size ?? 10);
    if (!Number.isInteger(size) || size < 5 || size > 10) return fail("每组请选择5至10个词。", 400);
    client = await getPool().connect();
    await client.query("BEGIN");
    // Serialize generation per learner across server instances.
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE NOWAIT", [session.userId]);
    const recent = await client.query("SELECT COUNT(*)::int AS count FROM story_groups WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day'", [session.userId]);
    if (recent.rows[0].count >= 10) throw new StoryError("今天已生成10组故事，请明天再试。", 429);

    const selected = await client.query<{ id: number; word: string; annotation: string | null }>(
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
      throw new StoryError("至少需要5个尚未用于故事的已学词，请先继续学习。", 400);
    }

    const numberRow = await client.query<{ next_no: string }>(
      `SELECT COALESCE(MAX(group_number), 0) + 1 AS next_no FROM story_groups WHERE user_id = $1`,
      [session.userId]
    );
    const groupNumber = Number(numberRow.rows[0].next_no || 1);
    const story = await generateStory(selected.rows);

    const inserted = await client.query<{ id: number }>(
      `
      INSERT INTO story_groups(
        user_id, group_number, title_en, title_zh, story_en, story_zh,
        memory_tip, style, provider, word_count, created_at
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, 'web_memory_route', 'ai_chat_completions', $8, NOW())
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
      await client.query(
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

    await client.query("COMMIT");
    return ok({ id: storyGroupId, groupNumber, ...story, wordCount: selected.rows.length });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => null);
    if (err instanceof StoryError) return fail(err.message, err.status);
    if (typeof err === "object" && err !== null && "code" in err && err.code === "55P03") return fail("已有故事正在生成，请稍后查看。", 409);
    return serviceFailure(err);
  } finally {
    client?.release();
  }
}
