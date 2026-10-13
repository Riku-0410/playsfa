"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatJPY } from "@/lib/format";

type Meta = {
  contract_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
};
type Row = Meta & { key: number; description: string; amount: string };

const EMPTY_ROW = (key: number): Row => ({
  key,
  description: "",
  amount: "",
  contract_id: null,
  period_start: null,
  period_end: null,
});

const parseAmount = (v: string) => Number(v.replace(/[,，]/g, ""));

/**
 * 請求書明細の編集行。名前を重複させて FormData.getAll で受ける。
 * 行が持つ契約ID・期間は hidden で往復させ、保存で失われないようにする。
 * 利用料行の金額が契約の請求額と違うときは、契約にも反映するかをチェックボックスで聞く。
 */
export function ItemRows({
  initial,
  contractAmounts = {},
}: {
  initial: (Meta & { description: string; amount: number })[];
  /** 契約ID → 契約の請求額/回 */
  contractAmounts?: Record<string, number>;
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.length > 0
      ? initial.map((it, i) => ({ ...it, key: i, amount: String(it.amount) }))
      : [EMPTY_ROW(0)],
  );
  const [nextKey, setNextKey] = useState(initial.length || 1);

  const setAmount = (key: number, amount: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));

  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const contractAmount =
          row.contract_id && row.period_start
            ? contractAmounts[row.contract_id]
            : undefined;
        const amount = parseAmount(row.amount);
        const differs =
          contractAmount !== undefined && amount > 0 && amount !== contractAmount;
        return (
          <div key={row.key} className="space-y-1.5">
            <div className="flex items-end gap-3">
              <input type="hidden" name="item_contract_id" value={row.contract_id ?? ""} />
              <input type="hidden" name="item_period_start" value={row.period_start ?? ""} />
              <input type="hidden" name="item_period_end" value={row.period_end ?? ""} />
              <Field className="flex-1">
                {i === 0 && <Label>品目</Label>}
                <Input
                  name="item_description"
                  required
                  defaultValue={row.description}
                  placeholder="playcut 利用料 (2026-09-01〜2027-08-31)"
                />
              </Field>
              <Field className="w-40 shrink-0">
                {i === 0 && <Label>金額(税抜)</Label>}
                <Input
                  name="item_amount"
                  inputMode="numeric"
                  required
                  defaultValue={row.amount}
                  placeholder="480,000"
                  onChange={(e) => setAmount(row.key, e.target.value)}
                />
              </Field>
              <Button
                variant="ghost"
                size="sm"
                className="mb-1 shrink-0"
                disabled={rows.length === 1}
                onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
              >
                削除
              </Button>
            </div>
            {differs && (
              <label className="flex items-center gap-2 text-xs text-ink-secondary">
                <input
                  type="checkbox"
                  name="sync_contract_row"
                  value={i}
                  className="size-4 accent-night"
                />
                契約の請求額(現在 {formatJPY(contractAmount)}/回)もこの金額に変更する
              </label>
            )}
          </div>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setRows([...rows, EMPTY_ROW(nextKey)]);
          setNextKey(nextKey + 1);
        }}
      >
        + 明細を追加
      </Button>
      <p className="text-xs text-ink-muted">
        小計・消費税・合計は明細から自動で再計算されます
      </p>
    </div>
  );
}
