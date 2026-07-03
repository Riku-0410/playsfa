"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

/** 初期費用・年間費用の可変行。名前を重複させて FormData.getAll で受ける */
export function FeeRows() {
  const [keys, setKeys] = useState<number[]>([]);
  const [nextKey, setNextKey] = useState(0);

  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <div key={key} className="flex items-end gap-3">
          <Field className="flex-1">
            <Label htmlFor={`fee-desc-${key}`}>費用名</Label>
            <Input
              id={`fee-desc-${key}`}
              name="fee_description"
              required
              placeholder="初期費用"
            />
          </Field>
          <Field className="w-36 shrink-0">
            <Label htmlFor={`fee-amount-${key}`}>金額(税抜)</Label>
            <Input
              id={`fee-amount-${key}`}
              name="fee_amount"
              inputMode="numeric"
              required
              placeholder="100,000"
            />
          </Field>
          <Field className="w-40 shrink-0">
            <Label htmlFor={`fee-type-${key}`}>かかり方</Label>
            <Select id={`fee-type-${key}`} name="fee_type" defaultValue="once">
              <option value="once">初年度のみ</option>
              <option value="recurring">毎年(更新後も)</option>
            </Select>
          </Field>
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 shrink-0"
            onClick={() => setKeys(keys.filter((k) => k !== key))}
          >
            削除
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setKeys([...keys, nextKey]);
          setNextKey(nextKey + 1);
        }}
      >
        + 費用を追加(初期費用など)
      </Button>
      <p className="text-xs text-ink-muted">
        追加した費用は初回の請求書に明細行として載ります
      </p>
    </div>
  );
}
