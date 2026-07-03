import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Basic認証(Supabase Auth導入までの暫定ガード)。
 * ローカル開発では常にスキップ。本番は環境変数未設定なら401(フェイルクローズ)。
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "development") return NextResponse.next();

  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !password) return unauthorized();

  const expected = `Basic ${btoa(`${user}:${password}`)}`;
  if (request.headers.get("authorization") === expected) {
    return NextResponse.next();
  }
  return unauthorized();
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="playsfa", charset="UTF-8"' },
  });
}

export const config = {
  // api/cron はBasic認証の対象外(CRON_SECRETで保護)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
