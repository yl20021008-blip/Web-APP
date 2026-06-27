import { ok, fail } from "@/app/api/_helpers";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return fail("未登录", 401);
  return ok(session);
}
