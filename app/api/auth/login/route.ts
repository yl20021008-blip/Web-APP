import { ok, fail, readJson, serviceFailure } from "@/app/api/_helpers";
import { ensureCoreDefaults } from "@/lib/db";
import { loginOrCreateUser, setSessionCookie } from "@/lib/auth";
import { ensureUserWordStatus } from "@/lib/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ displayName?: string; pin?: string }>(request);
    if (!body.displayName?.trim()) return fail("学习者名称不能为空。", 400);
    if (!body.pin || body.pin.trim().length < 4) return fail("PIN 至少需要4位。", 400);
    await ensureCoreDefaults();
    const session = await loginOrCreateUser(body.displayName || "", body.pin || "");
    await ensureUserWordStatus(session.userId);
    await setSessionCookie(session);
    return ok(session);
  } catch (err) {
    if (err instanceof Error && err.message === "PIN 不正确。") {
      return fail(err.message, 400);
    }
    return serviceFailure(err);
  }
}
