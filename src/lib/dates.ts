/**
 * JST基準の日付ユーティリティ。
 * VercelのサーバーはUTCなので new Date() 直のformatは9時間ズレる。
 * 「今日」を扱うときは必ずこちらを使う。
 */

/** JSTの今日 "yyyy-MM-dd" (sv-SEロケールはISO形式で出力される) */
export function todayJST(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
}

/**
 * 月の開始日と末日。引数なしならJSTの今月、"yyyy-MM" を渡せばその月。
 */
export function monthBoundsJST(ym?: string): { start: string; end: string } {
  const [y, m] = (ym ?? todayJST()).split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** JSTの今日 + n日 "yyyy-MM-dd" */
export function addDaysJST(days: number): string {
  const [y, m, d] = todayJST().split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** "yyyy-MM" に n か月足す(負も可) */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
