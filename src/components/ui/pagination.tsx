import Link from "next/link";
import { cn } from "@/lib/cn";
import { listHref, PER_PAGE } from "@/lib/list-params";

function pageNumbers(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("…");
    out.push(nums[i]);
  }
  return out;
}

/** 一覧のページ送り。総件数と現在ページの範囲も表示する */
export function Pagination({
  basePath,
  params,
  page,
  total,
  perPage = PER_PAGE,
}: {
  basePath: string;
  /** 保持するその他のクエリ(フィルタ・ソート等) */
  params?: Record<string, string | undefined>;
  page: number;
  total: number;
  perPage?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const href = (p: number) => listHref(basePath, { ...params, page: p });

  const linkCls =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-1">
      <p className="text-xs text-ink-muted tabular-nums">
        全{total}件中 {from}–{to}件
      </p>
      {pages > 1 && (
        <nav aria-label="ページ送り" className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={href(page - 1)} className={cn(linkCls, "text-ink-secondary hover:bg-sunken")}>
              ← 前へ
            </Link>
          ) : (
            <span className={cn(linkCls, "text-ink-muted/50")}>← 前へ</span>
          )}
          {pageNumbers(page, pages).map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-xs text-ink-muted">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={href(n)}
                aria-current={n === page ? "page" : undefined}
                className={cn(
                  linkCls,
                  "tabular-nums",
                  n === page
                    ? "bg-night text-night-ink"
                    : "text-ink-secondary hover:bg-sunken",
                )}
              >
                {n}
              </Link>
            ),
          )}
          {page < pages ? (
            <Link href={href(page + 1)} className={cn(linkCls, "text-ink-secondary hover:bg-sunken")}>
              次へ →
            </Link>
          ) : (
            <span className={cn(linkCls, "text-ink-muted/50")}>次へ →</span>
          )}
        </nav>
      )}
    </div>
  );
}
