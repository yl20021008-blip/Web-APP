import { NextResponse } from "next/server";

export function ok(data: unknown = {}) {
  return NextResponse.json({ ok: true, data });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}

// Keep authentication failures distinct from unavailable backend services.
export function serviceFailure(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return fail("登录已过期，请重新登录。", 401);
  }
  console.error("API backend failure", error instanceof Error ? error.name : "UnknownError");
  return fail("服务暂时不可用，请稍后重试；若持续出现，请检查数据库连接配置。", 503);
}
