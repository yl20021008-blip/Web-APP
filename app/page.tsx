"use client";

import { useEffect, useState } from "react";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
type PageKey = "dashboard" | "flow" | "study" | "review" | "weak" | "summary" | "chapters" | "story" | "stats" | "wordbook" | "admin";

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
  wrong_count?: number;
  fuzzy_count?: number;
  next_review_at: string | null;
  task_type: "new" | "review";
};

type AnswerResponse = {
  wordId: number;
  result: string;
  newLevel: number;
  status: string;
  nextReviewAt: string;
  intervalLabel?: string;
};

type StudySessionStats = {
  answered: number;
  forgot: number;
  fuzzy: number;
  correct: number;
  mastered: number;
  recycled: number;
};

const navItems: Array<[PageKey, string, string]> = [
  ["dashboard", "🏠", "首页"],
  ["flow", "⚡", "一键"],
  ["study", "🧠", "新词"],
  ["review", "🗓️", "复习"],
  ["weak", "🎯", "薄弱"],
  ["summary", "✅", "总结"],
  ["chapters", "📚", "章节"],
  ["story", "📖", "故事"],
  ["wordbook", "🔎", "词库"]
];

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

function todayKey(name: string) {
  return `ielts_${name}_${new Date().toISOString().slice(0, 10)}`;
}

function incToday(name: string, delta = 1) {
  const key = todayKey(name);
  const next = Number(localStorage.getItem(key) || 0) + delta;
  localStorage.setItem(key, String(next));
  return next;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<PageKey>("dashboard");
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
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => null);
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
          <p>v2.9 一键学习流 · 智能混合队列 · 错词回炉 · 每日总结</p>
        </div>
        <div className="status-pill">
          {session ? `当前学习者：${session.displayName}` : loading ? "正在检查登录状态…" : "未登录"}
        </div>
      </header>

      {message ? <div className="notice success" style={{ marginBottom: 16 }}>{message}</div> : null}

      {!session ? (
        <LoginBox onLogin={(s) => { setSession(s); setMessage("登录成功，学习状态已同步。"); }} />
      ) : (
        <>
          {active === "dashboard" && <Dashboard onMessage={setMessage} go={setActive} />}
          {active === "flow" && <Study mode="smart" onMessage={setMessage} />}
          {active === "study" && <Study mode="today" onMessage={setMessage} />}
          {active === "review" && <ReviewPlan />}
          {active === "weak" && <Study mode="weak" onMessage={setMessage} />}
          {active === "summary" && <DailySummary go={setActive} />}
          {active === "chapters" && <Chapters />}
          {active === "story" && <Stories onMessage={setMessage} />}
          {active === "stats" && <Stats />}
          {active === "wordbook" && <Wordbook />}
          {active === "admin" && <AdminPanel />}
          <div style={{ marginTop: 18 }}>
            <button className="ghost" onClick={logout}>退出登录</button>
            <button className="ghost" style={{ marginLeft: 8 }} onClick={() => setActive("admin")}>管理概览</button>
          </div>
        </>
      )}

      {session ? (
        <nav className="bottom-nav">
          {navItems.map(([key, icon, label]) => (
            <button key={key} className={`nav-btn ${active === key ? "active" : ""}`} onClick={() => setActive(key)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
      ) : null}
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
      <div className="form-row"><label>学习者名称</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如 YangLin" /></div>
      <div className="form-row"><label>PIN</label><input value={pin} onChange={(e) => setPin(e.target.value)} type="password" placeholder="4位以上" /></div>
      {error ? <div className="notice error">{error}</div> : null}
      <button className="primary" onClick={submit} disabled={busy}>{busy ? "正在登录…" : "进入学习"}</button>
    </section>
  );
}

function Dashboard({ onMessage, go }: { onMessage: (m: string) => void; go: (p: PageKey) => void }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [goal, setGoal] = useState(30);

  async function load() {
    try {
      setMetrics(await api<Metrics>("/api/dashboard"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(todayKey("daily_goal"));
    if (saved) setGoal(Number(saved));
    load();
  }, []);

  function saveGoal(value: number) {
    setGoal(value);
    localStorage.setItem(todayKey("daily_goal"), String(value));
    onMessage(`今日目标已设置为 ${value} 个。`);
  }

  const learnedToday = Number(localStorage.getItem(todayKey("answered")) || 0);
  const progress = Math.min(100, Math.round((learnedToday / Math.max(goal, 1)) * 100));

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
          <div className="metric" key={String(label)}><div className="label">{label}</div><div className="value">{value}</div></div>
        ))}
      </div>

      <div className="card hero-card">
        <h2>一键开始今天的学习</h2>
        <p style={{ color: "var(--muted)" }}>
          系统会自动混合：到期复习、薄弱词、新词。忘记的词会在本组后面自动回炉。
        </p>
        <div className="button-row">
          {[10, 20, 30, 50].map((v) => <button key={v} className={goal === v ? "primary" : ""} onClick={() => saveGoal(v)}>{v} 个</button>)}
        </div>
        <div className="progress-wrap" style={{ marginTop: 18 }}>
          <div className="progress-label">今日已完成 {learnedToday} / {goal}</div>
          <div className="progress"><div style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="button-row" style={{ marginTop: 18 }}>
          <button className="primary big-cta" onClick={() => go("flow")}>⚡ 开始今天的学习</button>
          <button onClick={() => go("summary")}>查看今日总结</button>
        </div>
      </div>
    </section>
  );
}

function Study({ onMessage, mode }: { onMessage: (m: string) => void; mode: "today" | "weak" | "smart" }) {
  const [queue, setQueue] = useState<WordTask[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"question" | "answer" | "complete">("question");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedResult, setSavedResult] = useState<AnswerResponse | null>(null);
  const [stats, setStats] = useState<StudySessionStats>({ answered: 0, forgot: 0, fuzzy: 0, correct: 0, mastered: 0, recycled: 0 });

  async function load() {
    setError("");
    try {
      const target = Number(localStorage.getItem(todayKey("daily_goal")) || 30);
      const data = await api<WordTask[]>(`/api/study/today?mode=${mode}&target=${target}`);
      setQueue(data);
      setIndex(0);
      setPhase(data.length ? "question" : "complete");
      setSavedResult(null);
      setStats({ answered: 0, forgot: 0, fuzzy: 0, correct: 0, mastered: 0, recycled: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const current = queue[index];

  function speak(word: string, lang: "en-GB" | "en-US") {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(word);
    u.lang = lang;
    u.rate = 0.82;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  function updateLocalStats(result: string) {
    incToday("answered", 1);
    if (result === "忘记") incToday("forgot", 1);
    if (result === "模糊") incToday("fuzzy", 1);
    if (result === "正确") incToday("correct", 1);
    if (result === "熟练") incToday("mastered", 1);

    setStats((s) => ({
      answered: s.answered + 1,
      forgot: s.forgot + (result === "忘记" ? 1 : 0),
      fuzzy: s.fuzzy + (result === "模糊" ? 1 : 0),
      correct: s.correct + (result === "正确" ? 1 : 0),
      mastered: s.mastered + (result === "熟练" ? 1 : 0),
      recycled: s.recycled
    }));
  }

  function recycleForgotten(word: WordTask) {
    // Wrong-word recycle: reinsert forgotten words later in the same queue.
    setQueue((q) => {
      const copy = [...q];
      const insertAt = Math.min(index + 5, copy.length);
      copy.splice(insertAt, 0, { ...word, task_type: "review" });
      return copy;
    });
    setStats((s) => ({ ...s, recycled: s.recycled + 1 }));
  }

  async function answer(result: string) {
    if (!current || busy || phase === "answer") return;
    setBusy(true);
    setError("");

    try {
      const saved = await api<AnswerResponse>("/api/study/answer", {
        method: "POST",
        body: JSON.stringify({ wordId: current.id, result })
      });

      updateLocalStats(result);
      if (result === "忘记") recycleForgotten(current);
      setSavedResult(saved);
      setPhase("answer");
      onMessage(`已记录：${result}。下次复习：${saved.intervalLabel || "已安排"}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  async function goNext() {
    setSavedResult(null);
    if (index + 1 >= queue.length) {
      setPhase("complete");
    } else {
      setPhase("question");
      setIndex(index + 1);
    }
  }

  if (error) return <div className="notice error">{error}</div>;

  if (phase === "complete" || !current) {
    const accuracy = stats.answered ? Math.round(((stats.correct + stats.mastered) / stats.answered) * 100) : 0;
    return (
      <section className="card">
        <h2>{mode === "smart" ? "今日学习流完成" : mode === "weak" ? "薄弱词训练完成" : "本组学习完成"}</h2>
        <p style={{ color: "var(--muted)" }}>这是本轮学习反馈。忘记词已进行本组回炉。</p>
        <div className="grid metrics">
          <div className="metric"><div className="label">已完成</div><div className="value">{stats.answered}</div></div>
          <div className="metric"><div className="label">正确率</div><div className="value">{accuracy}%</div></div>
          <div className="metric"><div className="label">忘记</div><div className="value">{stats.forgot}</div></div>
          <div className="metric"><div className="label">模糊</div><div className="value">{stats.fuzzy}</div></div>
          <div className="metric"><div className="label">回炉</div><div className="value">{stats.recycled}</div></div>
        </div>
        <div className="button-row" style={{ marginTop: 18 }}>
          <button className="primary" onClick={load}>继续下一组</button>
          <button onClick={() => window.location.reload()}>回到首页</button>
        </div>
      </section>
    );
  }

  const isQuestion = phase === "question";

  return (
    <section className="card word-card compact-study">
      <div className="recall-phase">{isQuestion ? "① 先回忆，不看答案" : "② 答案已显示，确认后进入下一词"}</div>
      <div className="notice" style={{ marginBottom: 18 }}>
        {mode === "smart" ? "智能学习流" : mode === "weak" ? "薄弱词专项" : current.task_type === "review" ? "到期复习" : "新词学习"} · {index + 1} / {queue.length} · 当前等级 {current.mastery_level}
      </div>
      <div className="word">{current.word}</div>

      {isQuestion ? (
        <>
          <p className="hidden-hint">先回忆中文意思和一个例句，再选择真实记忆状态。</p>
          <div className="recall-actions">
            <button className="forgot" disabled={busy} onClick={() => answer("忘记")}>完全忘记</button>
            <button className="fuzzy" disabled={busy} onClick={() => answer("模糊")}>有点模糊</button>
            <button className="correct" disabled={busy} onClick={() => answer("正确")}>基本记得</button>
            <button className="mastered" disabled={busy} onClick={() => answer("熟练")}>非常熟练</button>
          </div>
          <p className="srs-tip">智能流会自动混合复习、薄弱词和新词。忘记的词会在本组后面再次出现。</p>
        </>
      ) : (
        <div className="answer-panel">
          <div className="pos">{current.part_of_speech || " "}</div>
          <div className="button-row audio-row">
            {current.uk_audio_url ? <audio controls src={current.uk_audio_url} /> : <button onClick={() => speak(current.word, "en-GB")}>🔊 英式读音</button>}
            {current.us_audio_url ? <audio controls src={current.us_audio_url} /> : <button onClick={() => speak(current.word, "en-US")}>🔊 美式读音</button>}
          </div>
          {(current.uk_phonetic || current.us_phonetic) ? <p style={{ color: "var(--muted)" }}>{current.uk_phonetic ? `英 ${current.uk_phonetic}` : ""}　{current.us_phonetic ? `美 ${current.us_phonetic}` : ""}</p> : null}
          <div className="meaning">
            <strong>{current.annotation || "暂无释义"}</strong>
            <div className="example">
              {current.example_sentence ? <p><strong>Example:</strong> {current.example_sentence}</p> : null}
              {current.example_translation ? <p><strong>翻译：</strong>{current.example_translation}</p> : null}
            </div>
          </div>
          {savedResult ? <div className="rating-saved">已记录：{savedResult.result} · 新等级 {savedResult.newLevel} · {savedResult.intervalLabel || "已安排复习"}</div> : null}
          <div className="button-row" style={{ justifyContent: "center", marginTop: 22 }}>
            <button className="primary" disabled={busy} onClick={goNext}>{index + 1 >= queue.length ? "查看本组反馈" : "下一词"}</button>
          </div>
        </div>
      )}
    </section>
  );
}

function DailySummary({ go }: { go: (p: PageKey) => void }) {
  const [data, setData] = useState<any | null>(null);
  const answered = Number(localStorage.getItem(todayKey("answered")) || 0);
  const forgot = Number(localStorage.getItem(todayKey("forgot")) || 0);
  const fuzzy = Number(localStorage.getItem(todayKey("fuzzy")) || 0);
  const correct = Number(localStorage.getItem(todayKey("correct")) || 0);
  const mastered = Number(localStorage.getItem(todayKey("mastered")) || 0);
  const accuracy = answered ? Math.round(((correct + mastered) / answered) * 100) : 0;

  useEffect(() => {
    api<any>("/api/daily/summary").then(setData).catch(() => setData(null));
  }, []);

  return (
    <section className="grid">
      <div className="card">
        <h2>今日学习总结</h2>
        <p style={{ color: "var(--muted)" }}>本地统计 + 数据库复习计划汇总。建议每天结束前看一次。</p>
        <div className="grid metrics">
          <div className="metric"><div className="label">今日完成</div><div className="value">{answered}</div></div>
          <div className="metric"><div className="label">正确率</div><div className="value">{accuracy}%</div></div>
          <div className="metric"><div className="label">忘记</div><div className="value">{forgot}</div></div>
          <div className="metric"><div className="label">模糊</div><div className="value">{fuzzy}</div></div>
          <div className="metric"><div className="label">明日复习</div><div className="value">{data?.tomorrow?.due_tomorrow ?? "—"}</div></div>
        </div>
        <div className="button-row" style={{ marginTop: 18 }}>
          <button className="primary" onClick={() => go("story")}>生成今日故事</button>
          <button onClick={() => go("weak")}>继续薄弱词</button>
        </div>
      </div>

      <div className="card">
        <h2>建议重点回看</h2>
        <table className="table"><thead><tr><th>单词</th><th>释义</th><th>错/模糊</th></tr></thead><tbody>{(data?.weak || []).map((r: any, i: number) => <tr key={i}><td>{r.word}</td><td>{r.annotation}</td><td>{r.wrong_count}/{r.fuzzy_count}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}

/* Reused sections from v2.8 */
function ReviewPlan() {
  const [data, setData] = useState<{ upcoming: any[]; dueWords: any[] } | null>(null);
  useEffect(() => { api<{ upcoming: any[]; dueWords: any[] }>("/api/review/plan").then(setData).catch(() => setData({ upcoming: [], dueWords: [] })); }, []);
  return (
    <section className="grid">
      <div className="card"><h2>未来复习计划</h2><table className="table"><thead><tr><th>日期</th><th>数量</th></tr></thead><tbody>{(data?.upcoming || []).map((r, i) => <tr key={i}><td>{String(r.review_date).slice(0, 10)}</td><td>{r.count}</td></tr>)}</tbody></table></div>
      <div className="card"><h2>当前到期词</h2><table className="table"><thead><tr><th>单词</th><th>释义</th><th>等级</th></tr></thead><tbody>{(data?.dueWords || []).map((r, i) => <tr key={i}><td>{r.word}</td><td>{r.annotation}</td><td>{r.mastery_level}</td></tr>)}</tbody></table></div>
    </section>
  );
}

function Chapters() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api<any[]>("/api/chapters/progress").then(setRows).catch(() => setRows([])); }, []);
  return (
    <section className="card">
      <h2>章节进度</h2>
      <p style={{ color: "var(--muted)" }}>按章节查看学习路径，避免 3632 个词看起来太散。</p>
      <table className="table"><thead><tr><th>章节</th><th>进度</th><th>已学</th><th>掌握</th><th>到期</th></tr></thead><tbody>{rows.map((r) => <tr key={r.chapter}><td><strong>{r.chapter}</strong></td><td><div className="progress"><div style={{ width: `${r.learned_percent}%` }} /></div>{r.learned_percent}%</td><td>{r.learned}/{r.total}</td><td>{r.mastered}</td><td>{r.due}</td></tr>)}</tbody></table>
    </section>
  );
}

function Stats() {
  const [data, setData] = useState<any | null>(null);
  useEffect(() => { api<any>("/api/stats").then(setData).catch(() => setData(null)); }, []);
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
      <div className="card"><h2>薄弱词 Top 50</h2><table className="table"><thead><tr><th>单词</th><th>释义</th><th>错/模糊</th></tr></thead><tbody>{(data?.difficult || []).map((r: any, i: number) => <tr key={i}><td>{r.word}</td><td>{r.annotation}</td><td>{r.wrong_count}/{r.fuzzy_count}</td></tr>)}</tbody></table></div>
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
    setRows(data.rows); setChapters(data.chapters); setPage(nextPage);
  }

  useEffect(() => { load(1).catch(() => null); }, []);

  return (
    <section className="card">
      <h2>我的词库</h2>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
        <div className="form-row"><label>搜索</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="单词或释义" /></div>
        <div className="form-row"><label>章节</label><select value={chapter} onChange={(e) => setChapter(e.target.value)}><option value="">全部章节</option>{chapters.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <button className="primary" onClick={() => load(1)}>筛选</button>
      </div>
      <table className="table"><thead><tr><th>单词</th><th>释义</th><th>章节</th><th>状态</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><strong>{r.word}</strong><br /><span style={{ color: "var(--muted)" }}>{r.part_of_speech}</span></td><td>{r.annotation}</td><td>{r.chapter}</td><td>{r.status} · L{r.mastery_level}</td></tr>)}</tbody></table>
      <div className="button-row" style={{ marginTop: 16 }}><button disabled={page <= 1} onClick={() => load(page - 1)}>上一页</button><button onClick={() => load(page + 1)}>下一页</button></div>
    </section>
  );
}

function Stories({ onMessage }: { onMessage: (m: string) => void }) {
  const [stories, setStories] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  async function load() { setStories(await api<any[]>("/api/stories")); }
  useEffect(() => { load().catch(() => null); }, []);
  async function generate() {
    setBusy(true);
    try { await api("/api/stories", { method: "POST", body: JSON.stringify({ size: 30 }) }); await load(); onMessage("故事已生成。"); }
    catch (err) { onMessage(err instanceof Error ? err.message : "生成失败"); }
    finally { setBusy(false); }
  }
  return (
    <section className="grid">
      <div className="card"><h2>AI式故事记忆</h2><p style={{ color: "var(--muted)" }}>按已学词生成科研场景记忆路线，包含中英故事和快速自测。</p><button className="primary" disabled={busy} onClick={generate}>{busy ? "正在生成…" : "生成一组故事"}</button></div>
      {stories.map((s) => <div className="card" key={s.id}><h2>{s.title_zh}</h2><p style={{ color: "var(--muted)" }}>{s.title_en} · {s.word_count} words</p><div className="story-text">{s.story_zh}</div><details style={{ marginTop: 16 }}><summary>English Story</summary><div className="story-text">{s.story_en}</div></details></div>)}
    </section>
  );
}

function AdminPanel() {
  const [pin, setPin] = useState("");
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try { setData(await api<any>(`/api/admin/summary?pin=${encodeURIComponent(pin)}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "读取失败"); }
  }
  return (
    <section className="card">
      <h2>Web 管理概览</h2>
      <p style={{ color: "var(--muted)" }}>公共词库导入和重置仍建议用 Streamlit 后台，避免误删。</p>
      <div className="grid" style={{ gridTemplateColumns: "1fr auto", alignItems: "end" }}>
        <div className="form-row"><label>管理员 PIN</label><input value={pin} type="password" onChange={(e) => setPin(e.target.value)} /></div>
        <button className="primary" onClick={load}>查看概览</button>
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      {data ? <>
        <div className="grid metrics" style={{ marginTop: 18 }}>{Object.entries(data.overview).map(([k, v]) => <div className="metric" key={k}><div className="label">{k}</div><div className="value">{String(v)}</div></div>)}</div>
        <h3>章节词数</h3>
        <table className="table"><thead><tr><th>章节</th><th>词数</th></tr></thead><tbody>{data.chapters.map((r: any) => <tr key={r.chapter}><td>{r.chapter}</td><td>{r.count}</td></tr>)}</tbody></table>
      </> : null}
    </section>
  );
}
