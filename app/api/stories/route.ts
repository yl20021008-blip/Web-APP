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
  const scenes = [
    "At the entrance of a quiet research library",
    "Beside a large map covered with field notes",
    "During a short seminar with other students",
    "In a laboratory where data were being checked",
    "On the way back, while summarising the argument",
    "At night, when the memory route became clear"
  ];

  const zhScenes = [
    "在一座安静的研究图书馆入口",
    "在一张写满田野笔记的大地图旁",
    "在一次和同学的小型研讨中",
    "在一间正在核对数据的实验室里",
    "回程路上，当我整理论证时",
    "夜晚，当整条记忆路线变清晰时"
  ];

  const grouped: Array<Array<{ id: number; word: string; annotation: string | null }>> = [];
  for (let i = 0; i < selected.length; i += 6) grouped.push(selected.slice(i, i + 6));

  const storyEn = grouped.map((group, idx) => {
    const words = group.map((w) => `**${w.word}**`).join(", ");
    return `${scenes[idx % scenes.length]}, I connected ${words} into one scene so that each term had a clear place in my memory.`;
  }).join("\n\n");

  const storyZh = grouped.map((group, idx) => {
    const words = group.map((w) => `**${w.word}**（${cleanMeaning(w.annotation)}）`).join("、");
    return `${zhScenes[idx % zhScenes.length]}，我把 ${words} 串成一个场景，让每个词都在记忆中有一个明确位置。`;
  }).join("\n\n");

  const quiz = selected.slice(0, 8).map((w, idx) => `${idx + 1}. ${w.word} → ${cleanMeaning(w.annotation)}`).join("\n");

  return {
    titleEn: `A Research Memory Route with ${selected.length} Words`,
    titleZh: `${selected.length}个词的科研场景记忆路线`,
    storyEn: `${storyEn}\n\nQuick self-test:\n${quiz}`,
    storyZh: `${storyZh}\n\n快速自测：\n${quiz}`,
    memoryTip: "先按场景顺序复述故事，再遮住中文释义回忆每个英文词。"
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
