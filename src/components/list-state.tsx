"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** 状態(ページ・検索・ソート)を覚える一覧ページのパス */
const LIST_PATHS = ["/customers", "/deals", "/contracts", "/invoices"];

const storageKey = (path: string) => `liststate:${path}`;

/**
 * 一覧ページのクエリを sessionStorage に記録する。
 * サイドバーの一覧リンクが savedListHref で復元するため、詳細ページから
 * ナビ経由で一覧へ戻っても1ページ目にリセットされない。
 */
export function ListStateRecorder() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!LIST_PATHS.includes(pathname)) return;
    const qs = searchParams.toString();
    sessionStorage.setItem(storageKey(pathname), qs ? `?${qs}` : "");
  }, [pathname, searchParams]);
  return null;
}

/** 記録済みクエリ付きの一覧URL。未記録・一覧以外のパスはそのまま返す */
export function savedListHref(href: string): string {
  if (typeof window === "undefined" || !LIST_PATHS.includes(href)) return href;
  return href + (sessionStorage.getItem(storageKey(href)) ?? "");
}
