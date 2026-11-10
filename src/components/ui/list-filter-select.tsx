"use client";

import { Select } from "@/components/ui/input";

/**
 * 一覧のセレクト型フィルタ。選んだ瞬間にGETフォームを送信する。
 * 渡された params(他のフィルタ・検索・ソート)は hidden で保持し、ページは1に戻る。
 */
export function ListFilterSelect({
  basePath,
  name,
  value,
  options,
  allLabel,
  label,
  params,
  className,
}: {
  basePath: string;
  /** URLパラメータ名 */
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  /** 未選択(絞り込みなし)の表示 */
  allLabel: string;
  /** aria-label */
  label: string;
  params?: Record<string, string | undefined>;
  className?: string;
}) {
  return (
    <form action={basePath} className={className}>
      {Object.entries(params ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <Select
        compact
        name={name}
        defaultValue={value ?? ""}
        aria-label={label}
        className="w-44"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </form>
  );
}
