"use client";

import { useState } from "react";
import { CheckboxPill } from "@/components/ui/checkbox-pill";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SERVICES } from "@/lib/status";

/**
 * 新規商談用のサービス選択+見込額入力。
 * 複数サービスを選ぶとサービスごとの見込額欄が出る
 * (name: amount_expected_{service})。
 */
export function ServiceAmountFields({
  defaultService = "baskestats",
}: {
  defaultService?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([defaultService]),
  );
  const toggle = (k: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const chosen = Object.keys(SERVICES).filter((k) => selected.has(k));

  return (
    <>
      <Field>
        <Label>サービス *</Label>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {Object.entries(SERVICES).map(([k, v]) => (
            <CheckboxPill
              key={k}
              name="service"
              value={k}
              checked={selected.has(k)}
              onChange={() => toggle(k)}
            >
              {v.label}
            </CheckboxPill>
          ))}
        </div>
        {/* 未選択のまま送信できないようにするネイティブ検証用ガード */}
        <input
          type="text"
          value={chosen.length ? "ok" : ""}
          required
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
        {chosen.length === 0 ? (
          <p className="text-xs font-medium text-critical-deep">
            サービスを1つ以上選択してください
          </p>
        ) : (
          <FieldHint>複数選ぶとサービスごとに商談を作成します</FieldHint>
        )}
      </Field>
      {chosen.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {chosen.map((k) => (
            <Field key={k}>
              <Label htmlFor={`deal-amount-${k}`}>
                見込額(年・税抜)
                {chosen.length > 1 &&
                  ` — ${SERVICES[k as keyof typeof SERVICES].label}`}
              </Label>
              <Input
                id={`deal-amount-${k}`}
                name={`amount_expected_${k}`}
                inputMode="numeric"
                placeholder="480,000"
              />
            </Field>
          ))}
        </div>
      )}
    </>
  );
}
