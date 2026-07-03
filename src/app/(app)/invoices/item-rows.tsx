"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Row = { key: number; description: string; amount: number | "" };

/** 請求書明細の編集行。名前を重複させて FormData.getAll で受ける */
export function ItemRows({
  initial,
}: {
  initial: { description: string; amount: number }[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.length > 0
      ? initial.map((it, i) => ({ key: i, ...it }))
      : [{ key: 0, description: "", amount: "" }],
  );
  const [nextKey, setNextKey] = useState(initial.length || 1);

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={row.key} className="flex items-end gap-3">
          <Field className="flex-1">
            {i === 0 && <Label>品目</Label>}
            <Input
              name="item_description"
              required
              defaultValue={row.description}
              placeholder="利用料 (2026-09-01〜2027-08-31)"
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
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setRows([...rows, { key: nextKey, description: "", amount: "" }]);
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
