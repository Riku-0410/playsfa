"use client";

import { useState } from "react";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { ACTIVITY_AUTHORS } from "@/lib/activity";

/** 契約登録・更新に添える活動メモ(任意)。書いたら記入者を必須にする */
export function ContractMemoFields() {
  const [memo, setMemo] = useState("");
  const hasMemo = memo.trim() !== "";
  return (
    <div className="space-y-3">
      <Field>
        <Label htmlFor="ct-memo">活動メモ</Label>
        <Textarea
          id="ct-memo"
          name="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="先方と年払い80,000円で最終確認済み"
        />
        <FieldHint>任意。契約の条件と一緒に顧客の活動ログに残ります</FieldHint>
      </Field>
      {hasMemo && (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-ink-secondary">記入者 *</legend>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_AUTHORS.map((author) => (
              <label
                key={author}
                className="inline-flex h-9 cursor-pointer select-none items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-secondary transition-colors hover:bg-sunken has-checked:border-night has-checked:bg-night has-checked:text-night-ink"
              >
                <input
                  type="radio"
                  name="author_name"
                  value={author}
                  required
                  className="sr-only"
                />
                {author}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
