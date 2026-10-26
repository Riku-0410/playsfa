"use client";

import { useRef } from "react";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useTrialStage } from "./use-trial-stage";

/** 見込額(年・税抜)。ステージがトライアル中なら必須(KPIの積み上げ金額に使う) */
export function AmountField({
  id,
  name,
  label = "見込額(年・税抜)",
  defaultValue,
}: {
  id: string;
  name: string;
  label?: string;
  defaultValue?: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const required = useTrialStage(ref);
  return (
    <div ref={ref}>
      <Field>
        <Label htmlFor={id}>
          {label}
          {required && " *"}
        </Label>
        <Input
          id={id}
          name={name}
          inputMode="numeric"
          placeholder="480,000"
          required={required}
          defaultValue={defaultValue ?? ""}
        />
        {required && <FieldHint>トライアル中は見込額が必須です</FieldHint>}
      </Field>
    </div>
  );
}
