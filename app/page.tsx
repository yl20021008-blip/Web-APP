"use client";

import { useEffect, useMemo, useState } from "react";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

type Session = { userId: number; displayName: string };

type Metrics = {
  totalWords: number;
  dueReviews: number;
  newWords: number;
  learnedWords: number;
  totalUsers: number;
};

type WordTask = {
  id: number;
  word: string;
  part_of_speech: string | null;
  annotation: string | null;
  chapter: string | null;
  example_sentence: string | null;
  example_translation: string | null;
  uk_phonetic: string | null;
  us_phonetic: string | null;
  uk_audio_url: string | null;
  us_audio_url: string | null;
  status: string;
  mastery_level: number;
  total_reviews: number;
  next_review_at: string | null;
  task_type: "new" | "review";
};

type Story = {
  id: number;
  group_number: number;
  title_en: string;
  title_zh: string;
  story_en: string;
  story_zh: string;
  memory_tip: string | null;
  word_count: number;
  created_at: string;
};

const navItems = [
  ["dashboard", "🏠", "首页"],
  ["study", "🧠", "学习"],
  ["review", "🗓️", "复习"],
  ["story", "📖", "故事"],
  ["stats", "📊", "统计"],
  ["wordbook", "📚", "词库"]
] as const;

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });
  const payload = (await res.json()) as ApiResponse<T>;
  if (!payload.ok) throw new Error(payload.error || "请求失败");
  return payload.data;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<(typeof navItems)[number][0]>("dashboard");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refreshSession() {
    try {
      const me = await api<Session>("/api/me");
      setSession(me);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSession();
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setSession(null);
    setActive("dashboard");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>IELTS Vocabulary Planner</h1>
          <p>v2.0 Web App · Next.js + Supabase · 低饱和科研风学习端</p>
        </div>
        <div className="status-pill">
          {session ? `当前学习者：${session.displayName}` : loading ? "正在检查登录状态…" : "未登录"}
        </div>
      </header>

      {message ? (
        <div className="notice success" style={{ marginBottom: 16 }}>{message}</div>
      ) : null}

      {!session ? (
        <LoginBox onLogin={(s) => { setSession(s); setMessage("登录成功，学习状态已同步。"); }} />
      ) : (
        <>
          {active === "dashboard" && <Dashboard onMessage={setMessage} />}
          {active === "study" && <Study onMessage={setMessage} />}
          {active === "review" && <ReviewPlan />}
          {active === "story" && <Stories onMessage={setMessage} />}
          {active === "stats" && <Stats />}
          {active === "wordbook" && <Wordbook />}
        </>
      )}

      {session ? (
        <div style={{ marginTop: 18 }}>
          <button className="ghost" onClick={logout}>退出登录</button>
        </div>
      ) : null}

      <nav className="bottom-nav">
        {navItems.map(([key, icon, label]) => (
          <button
            key={key}
            className={`nav-btn ${active === key ? "active" : ""}`}
            onClick={() => setActive(key)}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}

function LoginBox({ onLogin }: { onLogin: (session: Session) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const session = await api<Session>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ displayName, pin })
      });
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card login-box">
      <h2>登录 / 创建学习者</h2>
      <p style={{ color: "var(--muted)" }}>第一次使用会自动创建账号。PIN 至少 4 位。</p>
      <div className="form-row">
        <label>学习者名称</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如 YangLin" />
      </div>
      <div className="form-row">
        <label>PIN</label>
        <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" placeholder="4位以上" />
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      <button className="primary" onClick={submit} disabled={busy}>
        {busy ? "正在登录…" : "进入学习"}
      </button>
    </section>
  );
}

function Dashboard({ onMessage }: { onMessage: (m: string) => void }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setMetrics(await api<Metrics>("/api/dashboard"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metricItems = [
    ["公共词库", metrics?.totalWords ?? "—"],
    ["今日到期", metrics?.dueReviews ?? "—"],
    ["待学新词", metrics?.newWords ?? "—"],
    ["我的已学", metrics?.learnedWords ?? "—"],
    ["学习者", metrics?.totalUsers ?? "—"]
  ];

  return (
    <section className="grid">
      {error ? <div className="notice error">{error}</div> : null}
      <div className="grid metrics">
        {metricItems.map(([label, value]) => (
          <div className="metric" key={String(label)}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>下一步</h2>
        <p>
          普通学习者主要使用底部导航：今日学习、复习计划、故事记忆、学习统计。
          公共词库仍由管理员在 Streamlit 后台统一维护，Web App 只负责流畅学习。
        </p>
        <div className="button-row">
          <button className="primary" onClick={() => onMessage("请点击底部“学习”进入今日学习。")}>开始学习</button>
          <button onClick={load}>刷新指标</button>
        </div>
      </div>
    </section>
  );
}

function Study({ onMessage }: { onMessage: (m: string) => void }) {
  const [queue, setQueue] = useState<WordTask[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const data = await api<WordTask[]>("/api/study/today");
      setQueue(data);
      setIndex(0);
      setShowAnswer(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const current = queue[index];

  function speak(word: string, lang: "en-GB" | "en-US") {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(word);
    u.lang = lang;
    u.rate = 0.82;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function answer(result: string) {
    if (!current) return;
    setBusy(true);
    try {
      await api("/api/study/answer", {
        method: "POST",
        body: JSON.stringify({ wordId: current.id, result })
      });
      setShowAnswer(false);
      if (index + 1 >= queue.length) {
        onMessage("本组学习完成，可以刷新获取下一组。");
        await load();
      } else {
        setIndex(index + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="notice error">{error}</div>;

  if (!current) {
    return (
      <section className="card">
        <h2>今日学习</h2>
        <p>当前没有可学习任务，或正在加载。</p>
        <button onClick={load}>刷新学习任务</button>
      </section>
    );
  }

  return (
    <section className="card word-card">
      <div className="notice" style={{ marginBottom: 18 }}>
        {current.task_type === "review" ? "到期复习" : "新词学习"} · {index + 1} / {queue.length} · 等级 {current.mastery_level}
      </div>

      <div className="word">{current.word}</div>
      <div className="pos">{current.part_of_speech || " "}</div>

      <div className="button-row audio-row">
        {current.uk_audio_url ? <audio controls src={current.uk_audio_url} /> : <button onClick={() => speak(current.word, "en-GB")}>🔊 英式读音</button>}
        {current.us_audio_url ? <audio controls src={current.us_audio_url} /> : <button onClick={() => speak(current.word, "en-US")}>🔊 美式读音</button>}
      </div>

      {(current.uk_phonetic || current.us_phonetic) ? (
        <p style={{ color: "var(--muted)" }}>
          {current.uk_phonetic ? `英 ${current.uk_phonetic}` : ""}　
          {current.us_phonetic ? `美 ${current.us_phonetic}` : ""}
        </p>
      ) : null}

      {showAnswer ? (
        <div className="meaning">
          <strong>{current.annotation || "暂无释义"}</strong>
          <div className="example">
            {current.example_sentence ? <p><strong>Example:</strong> {current.example_sentence}</p> : null}
            {current.example_translation ? <p><strong>翻译：</strong>{current.example_translation}</p> : null}
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--muted)" }}>先回忆中文释义，再点击显示答案。</p>
      )}

      <div className="button-row" style={{ justifyContent: "center", marginTop: 22 }}>
        <button onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? "隐藏答案" : "显示答案"}</button>
        <button className="danger" disabled={busy} onClick={() => answer("忘记")}>忘记</button>
        <button disabled={busy} onClick={() => answer("模糊")}>模糊</button>
        <button className="primary" disabled={busy} onClick={() => answer("正确")}>正确</button>
        <button className="primary" disabled={busy} onClick={() => answer("熟练")}>熟练</button>
      </div>
    </section>
  );
}

function ReviewPlan() {
  const [data, setData] = useState<{ upcoming: any[]; dueWords: any[] } | null>(null);

  useEffect(() => {
    api<{ upcoming: any[]; dueWords: any[] }>("/api/review/plan").then(setData).catch(() => setData({ upcoming: [], dueWords: [] }));
  }, []);

  return (
    <section className="grid">
      <div className="card">
        <h2>未来复习计划</h2>
        <table className="table">
          <thead><tr><th>日期</th><th>数量</th></tr></thead>
          <tbody>
            {(data?.upcoming || []).map((r, i) => (
              <tr key={i}><td>{String(r.review_date).slice(0, 10)}</td><td>{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>当前到期词</h2>
        <table className="table">
          <thead><tr><th>单词</th><th>释义</th><th>等级</th></tr></thead>
          <tbody>
            {(data?.dueWords || []).map((r, i) => (
              <tr key={i}><td>{r.word}</td><td>{r.annotation}</td><td>{r.mastery_level}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stats() {
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    api<any>("/api/stats").then(setData).catch(() => setData(null));
  }, []);

  const totals = data?.totals || {};
  return (
    <section className="grid">
      <div className="grid metrics">
        <div className="metric"><div className="label">待学</div><div className="value">{totals.new_words ?? "—"}</div></div>
        <div className="metric"><div className="label">已学</div><div className="value">{totals.learned_words ?? "—"}</div></div>
        <div className="metric"><div className="label">已掌握</div><div className="value">{totals.mastered_words ?? "—"}</div></div>
        <div className="metric"><div className="label">薄弱词</div><div className="value">{totals.difficult_words ?? "—"}</div></div>
        <div className="metric"><div className="label">总复习</div><div className="value">{totals.total_reviews ?? "—"}</div></div>
      </div>
      <div className="card">
        <h2>薄弱词</h2>
        <table className="table">
          <thead><tr><th>单词</th><th>释义</th><th>错/模糊</th></tr></thead>
          <tbody>
            {(data?.difficult || []).map((r: any, i: number) => (
              <tr key={i}><td>{r.word}</td><td>{r.annotation}</td><td>{r.wrong_count}/{r.fuzzy_count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Wordbook() {
  const [rows, setRows] = useState<any[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [chapter, setChapter] = useState("");
  const [page, setPage] = useState(1);

  async function load(nextPage = page) {
    const params = new URLSearchParams({ page: String(nextPage), pageSize: "40" });
    if (search) params.set("search", search);
    if (chapter) params.set("chapter", chapter);
    const data = await api<{ rows: any[]; chapters: string[] }>("/api/wordbook?" + params.toString());
    setRows(data.rows);
    setChapters(data.chapters);
    setPage(nextPage);
  }

  useEffect(() => {
    load(1).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="card">
      <h2>我的词库</h2>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
        <div className="form-row">
          <label>搜索</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="单词或释义" />
        </div>
        <div className="form-row">
          <label>章节</label>
          <select value={chapter} onChange={(e) => setChapter(e.target.value)}>
            <option value="">全部章节</option>
            {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="primary" onClick={() => load(1)}>筛选</button>
      </div>

      <table className="table">
        <thead><tr><th>单词</th><th>释义</th><th>章节</th><th>状态</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><strong>{r.word}</strong><br /><span style={{ color: "var(--muted)" }}>{r.part_of_speech}</span></td>
              <td>{r.annotation}</td>
              <td>{r.chapter}</td>
              <td>{r.status} · L{r.mastery_level}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="button-row" style={{ marginTop: 16 }}>
        <button disabled={page <= 1} onClick={() => load(page - 1)}>上一页</button>
        <button onClick={() => load(page + 1)}>下一页</button>
      </div>
    </section>
  );
}

function Stories({ onMessage }: { onMessage: (m: string) => void }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setStories(await api<Story[]>("/api/stories"));
  }

  useEffect(() => {
    load().catch(() => null);
  }, []);

  async function generate() {
    setBusy(true);
    try {
      await api("/api/stories", { method: "POST", body: JSON.stringify({ size: 30 }) });
      await load();
      onMessage("故事已生成。");
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <div className="card">
        <h2>故事记忆</h2>
        <p style={{ color: "var(--muted)" }}>从已学单词中生成记忆路线。至少需要5个已学词。</p>
        <button className="primary" disabled={busy} onClick={generate}>{busy ? "正在生成…" : "生成一组故事"}</button>
      </div>
      {stories.map((s) => (
        <div className="card" key={s.id}>
          <h2>{s.title_zh}</h2>
          <p style={{ color: "var(--muted)" }}>{s.title_en} · {s.word_count} words</p>
          <div className="story-text">{s.story_zh}</div>
          <details style={{ marginTop: 16 }}>
            <summary>English Story</summary>
            <div className="story-text">{s.story_en}</div>
          </details>
        </div>
      ))}
    </section>
  );
}
