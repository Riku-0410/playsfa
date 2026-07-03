/** 一覧ページのページネーション・並び替えのURLパラメータ処理 */

export const PER_PAGE = 50;

export type SortDir = "asc" | "desc";

export type ListState = {
  page: number;
  /** URL上のソートキー(sorts のキー) */
  sortKey: string;
  /** Supabase .order() に渡す式。埋め込み列 "customers(name)" も可 */
  orderExpr: string;
  dir: SortDir;
  from: number;
  to: number;
};

/**
 * searchParams から page/sort/dir を解釈する。
 * sort はホワイトリスト(sorts のキー)以外を無視する。
 */
export function parseListParams(
  raw: { page?: string; sort?: string; dir?: string },
  opts: {
    sorts: Record<string, string>;
    defaultSort: string;
    defaultDir?: SortDir;
  },
): ListState {
  const page = Math.max(1, Math.floor(Number(raw.page)) || 1);
  const sortKey =
    raw.sort && raw.sort in opts.sorts ? raw.sort : opts.defaultSort;
  const dir: SortDir =
    raw.dir === "asc" || raw.dir === "desc"
      ? raw.dir
      : sortKey === opts.defaultSort
        ? (opts.defaultDir ?? "desc")
        : "asc";
  const from = (page - 1) * PER_PAGE;
  return {
    page,
    sortKey,
    orderExpr: opts.sorts[sortKey],
    dir,
    from,
    to: from + PER_PAGE - 1,
  };
}

/** 空値を除いてクエリ文字列を組み立てる。page=1 は省略してURLを綺麗に保つ */
export function listHref(
  basePath: string,
  params: Record<string, string | number | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || (k === "page" && String(v) === "1")) {
      continue;
    }
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}
