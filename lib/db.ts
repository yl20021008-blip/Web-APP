import { Pool, QueryResult, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __ieltsPgPool: Pool | undefined;
}

function normalizeDatabaseUrl(url: string): string {
  let normalized = url.trim();

  if (normalized.startsWith("postgresql+psycopg2://")) {
    normalized = "postgresql://" + normalized.slice("postgresql+psycopg2://".length);
  }

  if (normalized.startsWith("postgres+psycopg2://")) {
    normalized = "postgres://" + normalized.slice("postgres+psycopg2://".length);
  }

  /*
   * v2.0.1 SSL hotfix:
   *
   * Supabase pooler URLs often include ?sslmode=require.
   * In node-postgres, ssl-related query parameters can override the explicit
   * ssl config object. On Vercel this may cause:
   *
   *   self-signed certificate in certificate chain
   *
   * We remove sslmode from the connection string and set ssl manually below.
   */
  try {
    const parsed = new URL(normalized);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("sslcert");
    parsed.searchParams.delete("sslkey");
    parsed.searchParams.delete("sslrootcert");
    return parsed.toString();
  } catch {
    return normalized.replace(/[?&]sslmode=[^&]+/i, "");
  }
}

function isLocalConnection(url: string): boolean {
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("::1")
  );
}

export function getPool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("Missing DATABASE_URL. Please set it in Vercel Environment Variables.");
  }

  if (!global.__ieltsPgPool) {
    const connectionString = normalizeDatabaseUrl(raw);
    const isLocal = isLocalConnection(connectionString);

    global.__ieltsPgPool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 15000,
      ssl: isLocal
        ? false
        : {
            rejectUnauthorized: false
          }
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
