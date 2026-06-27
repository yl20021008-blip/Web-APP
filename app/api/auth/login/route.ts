import { ok, fail, readJson } from "@/app/api/_helpers";
import { ensureCoreDefaults } from "@/lib/db";
import { loginOrCreateUser, setSessionCookie } from "@/lib/auth";
import { ensureUserWordStatus } from "@/lib/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureCoreDefaults();
    const body = await readJson<{ displayName?: string; pin?: string }>(request);
    const session = await loginOrCreateUser(body.displayName || "", body.pin || "");
    await ensureUserWordStatus(session.userId);
    await setSessionCookie(session);
    return ok(session);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "登录失败", 400);
  }
}
