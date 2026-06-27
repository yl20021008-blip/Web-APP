import crypto from "crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import type { UserSession } from "@/lib/types";

const COOKIE_NAME = "ielts_vocab_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value === "change-this-to-a-long-random-secret") {
    throw new Error("Missing or unsafe AUTH_SECRET.");
  }
  return value;
}

function pinPepper(): string {
  return process.env.PIN_PEPPER || "ielts-vocabulary-app-v1.2";
}

function cleanName(displayName: string): string {
  return String(displayName || "").trim().replace(/\s+/g, " ");
}

export function hashPin(displayName: string, pin: string): string {
  const normalized = cleanName(displayName).toLowerCase();
  const raw = `${pinPepper()}|${normalized}|${String(pin || "").trim()}`;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createToken(session: UserSession): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId: session.userId,
      displayName: session.displayName,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
    }),
    "utf8"
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

export function verifyToken(token: string | undefined): UserSession | null {
  if (!token || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: Number(decoded.userId), displayName: String(decoded.displayName) };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifyToken(token);
}

export async function setSessionCookie(session: UserSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function requireSession(): Promise<UserSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function loginOrCreateUser(displayName: string, pin: string): Promise<UserSession> {
  const name = cleanName(displayName);
  const pinText = String(pin || "").trim();

  if (!name) throw new Error("学习者名称不能为空。");
  if (pinText.length < 4) throw new Error("PIN 至少需要4位。");

  const existing = await query<{ id: number; display_name: string; pin_hash: string }>(
    `SELECT id, display_name, pin_hash FROM users WHERE display_name = $1`,
    [name]
  );

  const pinHash = hashPin(name, pinText);

  if (existing.rows[0]) {
    const user = existing.rows[0];
    if (user.pin_hash !== pinHash) throw new Error("PIN 不正确。");
    return { userId: Number(user.id), displayName: String(user.display_name) };
  }

  const inserted = await query<{ id: number; display_name: string }>(
    `INSERT INTO users(display_name, pin_hash, created_at)
     VALUES ($1, $2, NOW())
     RETURNING id, display_name`,
    [name, pinHash]
  );

  return { userId: Number(inserted.rows[0].id), displayName: String(inserted.rows[0].display_name) };
}
