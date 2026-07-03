import { Input } from "@/components/ui/input";

/**
 * 一覧の検索ボックス。GETフォームで q を送り、渡された params
 * (フィルタ・ソート)は hidden で保持する。ページは1に戻る。
 */
export function ListSearch({
  basePath,
  q,
  placeholder = "検索…",
  params,
}: {
  basePath: string;
  q?: string;
  placeholder?: string;
  /** 検索後も保持するクエリ(フィルタ・ソート等) */
  params?: Record<string, string | undefined>;
}) {
  return (
    <form action={basePath} role="search" className="flex items-center gap-2">
      {Object.entries(params ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <Input
        type="search"
        name="q"
        defaultValue={q ?? ""}
        placeholder={placeholder}
        aria-label="一覧を検索"
        className="h-9 w-56"
      />
    </form>
  );
}
