import Link from "next/link";
import { cn } from "@/lib/cn";
import { listHref, type SortDir } from "@/lib/list-params";
import { TH } from "@/components/ui/table";

/**
 * クリックで昇順/降順をトグルするテーブルヘッダ。
 * ソート状態はURLパラメータ(sort/dir)で表現し、ページはリセットする。
 */
export function SortableTH({
  label,
  sortKey,
  basePath,
  params,
  sort,
  dir,
  numeric = false,
}: {
  label: string;
  sortKey: string;
  basePath: string;
  /** 保持するその他のクエリ(フィルタ等) */
  params?: Record<string, string | undefined>;
  sort: string;
  dir: SortDir;
  numeric?: boolean;
}) {
  const active = sort === sortKey;
  const nextDir: SortDir = active && dir === "asc" ? "desc" : "asc";
  const href = listHref(basePath, {
    ...params,
    sort: sortKey,
    dir: nextDir,
  });
  return (
    <TH
      numeric={numeric}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={href}
        className={cn(
          "group inline-flex items-center gap-1 hover:text-ink",
          active && "text-ink",
        )}
      >
        {label}
        <span
          aria-hidden
          className={cn(
            "text-[10px]",
            active ? "text-accent" : "text-ink-muted/0 group-hover:text-ink-muted",
          )}
        >
          {active ? (dir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </Link>
    </TH>
  );
}
