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
      SELECT id, group_number, title_en, title_zh, story_en, story_zh, memory_tip, provider, style, word_count, created_at
      FROM story_groups
      WHERE user_id = $1
      ORDER BY group_number DESC
      LIMIT 20
      `,
      [session.userId]
    );
    return ok(rows.rows.map(row => {
      let tip = row.memory_tip;
      let targetWords: string[] = [];
      let model: string | null = null;
      try {
        const meta = JSON.parse(tip);
        if (meta.format === "ai_story_v2") { tip = meta.tip; targetWords = meta.words; model = meta.model; }
      } catch { /* Historical plain text tips remain readable. */ }
      return { ...row, memory_tip: tip, target_words: targetWords, model };
    }));
  } catch (error) {
    return serviceFailure(error);
  }
}

export async function POST(request: Request) {
  let client: import("pg").PoolClient | undefined;
  try {
    const session = await requireSession();
    const body = await readJson<{ size?: number; storyId?: number }>(request);
    const size = Number(body.size ?? 10);
    const storyId = body.storyId === undefined ? null : Number(body.storyId);
    if (storyId !== null && (!Number.isSafeInteger(storyId) || storyId < 1)) return fail("故事编号无效。", 400);
    if (!process.env.STORY_API_KEY?.trim() || !process.env.STORY_MODEL?.trim()) throw new StoryError("尚未配置故事 API，请检查 Vercel 的 STORY_API_KEY 和 STORY_MODEL，并重新部署。", 503);
    if (!Number.isInteger(size) || size < 5 || size > 10) return fail("每组请选择5至10个词。", 400);
    client = await getPool().connect();
    await client.query("BEGIN");
    // Serialize generation per learner across server instances.
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE NOWAIT", [session.userId]);
    const recent = await client.query("SELECT COUNT(*)::int AS count FROM story_groups WHERE user_id = $1 AND provider = 'ai_chat_completions' AND created_at > NOW() - INTERVAL '1 day'", [session.userId]);
    if (recent.rows[0].count >= 10) throw new StoryError("今天已生成10组故事，请明天再试。", 429);

    let targetWords: string[] | null = null;
    if (storyId !== null) {
      const old = await client.query("SELECT memory_tip FROM story_groups WHERE id = $1 AND user_id = $2", [storyId, session.userId]);
      if (!old.rows[0]) throw new StoryError("找不到该故事。", 404);
      try { const meta = JSON.parse(old.rows[0].memory_tip); if (meta.format === "ai_story_v2" && Array.isArray(meta.words)) targetWords = meta.words; } catch {}
      if (!targetWords) {
        const items = await client.query("SELECT w.word FROM story_group_items i JOIN words w ON w.id = i.word_id WHERE i.story_group_id = $1 AND i.user_id = $2 ORDER BY i.position", [storyId, session.userId]);
        targetWords = items.rows.map(r => String(r.word));
      }
      if (targetWords.length < 5) throw new StoryError("该旧故事没有足够的词汇记录，请使用顶部生成按钮。", 400);
    }
    const selected = await client.query<{ id: number; word: string; annotation: string | null }>(
      `SELECT w.id, w.word, w.annotation FROM learning_status ls
       JOIN words w ON w.id = ls.word_id
       WHERE ls.user_id = $1 AND ls.status <> 'new'
       AND ($2::text[] IS NULL OR w.word = ANY($2::text[]))
       ORDER BY ls.last_review_at DESC NULLS LAST, w.id ASC LIMIT $3`,
      [session.userId, targetWords, size]
    );

    if (selected.rows.length < 5) {
      throw new StoryError("至少需要5个已学词；旧故事用过的词现在也可再次生成。", 400);
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
        JSON.stringify({ format: "ai_story_v2", tip: story.memoryTip, words: selected.rows.map(w => w.word), model: process.env.STORY_MODEL }),
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
