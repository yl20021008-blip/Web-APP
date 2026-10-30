"use client";
import { targetPattern } from "@/lib/word-match";
import type { Source } from "@/lib/story-rag";
import { useEffect, useRef, useState } from "react";
type Story = { id: number; title_en: string; title_zh: string; story_en: string; story_zh: string; memory_tip: string; provider: string; model: string | null; created_at: string; word_count: number; references?: Source[]; target_words: string[] };
async function request(options?: RequestInit) {
  const response = await fetch('/api/stories', { ...options, headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
  let body;
  try { body = await response.json(); } catch { throw new Error(`服务响应异常（HTTP ${response.status}），请稍后重试。`); }
  if (!response.ok || !body.ok) throw new Error(body.error || '读取失败');
  return body.data;
}
function StoryText({ text, words }: { text: string; words: string[] }) {
  const clean = text.replace(/\*\*/g, '');
  const escaped = [...words].filter(Boolean).map(targetPattern);
  if (!escaped.length) return <div className="story-text">{clean}</div>;
  const re = new RegExp(`(?<![a-zA-Z])(${escaped.join('|')})(?![a-zA-Z])`, 'gi');
  return <div className="story-text">{clean.split(re).map((part,i) => i % 2 ? <mark key={i}>{part}</mark> : part)}</div>;
}
export default function StoryPanel({ wordIds, onContinue }: { wordIds?: number[]; onContinue?: () => void }) {
  const [stories,setStories] = useState<Story[]>([]);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [latest,setLatest] = useState<number | null>(null);
  const latestCard = useRef<HTMLElement | null>(null);
  async function load() { setStories(await request()); }
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (latest) latestCard.current?.scrollIntoView({ behavior:'smooth', block:'start' }); }, [latest,stories]);
  async function generate(storyId?: number) {
    setBusy(true); setError(''); setNotice('正在生成新故事，请稍候…');
    try {
      const result = await request({ method:'POST', body:JSON.stringify({size:10, ...(wordIds ? {wordIds} : {}), ...(storyId ? {storyId} : {})}) });
      setNotice('AI故事已生成并保存。'); setLatest(result.id); await load();
    } catch (e) { setError(e instanceof Error ? e.message : '生成失败'); setNotice(''); }
    finally { setBusy(false); }
  }
  return <section className="grid">
    <div className="card"><h2>AI故事记忆</h2><p>把最近学过的5–10个词写进一个有情节的英文故事。旧故事中的词也可以再次使用。</p>
      <button className="primary" disabled={busy} onClick={() => generate()}>{busy ? '正在生成，请稍候…' : '生成新的AI故事'}</button>
      {notice && <p role="status">{notice}</p>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {onContinue && <button style={{marginLeft:8}} disabled={busy} onClick={onContinue}>继续回忆练习</button>}
      {loading && <p>正在读取历史故事…</p>}
      {!loading && !stories.length && !error && <p>还没有故事，点击上方按钮开始。</p>}
    </div>
    {stories.map(s => {
      const ai = s.provider === 'ai_chat_completions';
      return <article className="card story-card" key={s.id} ref={s.id === latest ? latestCard : undefined}>
        <p className="story-meta">{ai ? 'AI生成' : '历史模板'} · {new Date(s.created_at).toLocaleString()} · {s.word_count}个目标词{s.model ? ` · ${s.model}` : ''}{s.id === latest ? ' · 刚刚生成' : ''}</p>
        <h2>{s.title_en}</h2><p>{s.title_zh}</p>
        {!ai && <p>这是旧版模板记录。可点击下方按钮，用这些词重新生成AI故事。</p>}
        <StoryText text={s.story_en} words={s.target_words || []}/>
        <details style={{marginTop:16}}><summary>查看中文翻译</summary><StoryText text={s.story_zh} words={s.target_words || []}/></details>
        {!!s.references?.length && <details style={{marginTop:16}}><summary>本次检索参考（{s.references.length}条）</summary><p>以下资料提供词义和语境参考，不代表故事逐句经过验证。</p>{s.references.map(ref => <div key={ref.id}><strong>{ref.title}</strong><p>{ref.text}</p><small>{ref.source} · {ref.id}</small></div>)}</details>}
        {s.memory_tip && <p className="story-tip">记忆提示：{s.memory_tip}</p>}
        <button disabled={busy} onClick={() => generate(s.id)}>{ai ? '用这些词再写一个故事' : '将这些词改写为AI故事'}</button>
      </article>;
    })}
  </section>;
}
