import { Pool, QueryResult, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __ieltsPgPool: Pool | undefined;
}

function normalizeDatabaseUrl(url: string): string {
  if (url.startsWith("postgresql+psycopg2://")) {
    return "postgresql://" + url.slice("postgresql+psycopg2://".length);
  }
  if (url.startsWith("postgres+psycopg2://")) {
    return "postgres://" + url.slice("postgres+psycopg2://".length);
  }
  return url;
}

export function getPool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("Missing DATABASE_URL. Please set it in Vercel Environment Variables.");
  }

  if (!global.__ieltsPgPool) {
    const connectionString = normalizeDatabaseUrl(raw);
    const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

    global.__ieltsPgPool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 15000,
      ssl: isLocal ? undefined : { rejectUnauthorized: false }
    });
  }

  return global.__ieltsPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function ensureCoreDefaults(): Promise<void> {
  await query(`
    ALTER TABLE learning_status
    ALTER COLUMN total_reviews SET DEFAULT 0,
    ALTER COLUMN correct_count SET DEFAULT 0,
    ALTER COLUMN wrong_count SET DEFAULT 0,
    ALTER COLUMN fuzzy_count SET DEFAULT 0,
    ALTER COLUMN consecutive_correct SET DEFAULT 0,
    ALTER COLUMN difficult_flag SET DEFAULT 0
  `).catch(() => null);

  await query(`CREATE INDEX IF NOT EXISTS idx_learning_user_status_web ON learning_status(user_id, status)`).catch(() => null);
  await query(`CREATE INDEX IF NOT EXISTS idx_learning_user_due_web ON learning_status(user_id, status, next_review_at)`).catch(() => null);
  await query(`CREATE INDEX IF NOT EXISTS idx_words_chapter_number_web ON words(chapter, original_number, id)`).catch(() => null);
  await query(`CREATE INDEX IF NOT EXISTS idx_review_user_time_web ON review_logs(user_id, reviewed_at)`).catch(() => null);
}
