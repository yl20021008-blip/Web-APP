import { ok } from "@/app/api/_helpers";
import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  return ok({ loggedOut: true });
}
