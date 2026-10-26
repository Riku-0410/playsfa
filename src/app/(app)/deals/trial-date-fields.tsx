"use client";

import { useRef, useState } from "react";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useTrialStage } from "./use-trial-stage";

/** ステージがトライアル中なら開始・終了を必須にする。ステージは同じフォームの select[name=stage] を見る */
export function TrialDateFields({
  trialStart,
  trialEnd,
}: {
  trialStart?: string | null;
  trialEnd?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const required = useTrialStage(ref);
  const [start, setStart] = useState(trialStart ?? "");

  return (
    <div ref={ref} className="grid grid-cols-2 gap-4">
      <Field>
        <Label htmlFor="deal-trial-start">トライアル開始{required && " *"}</Label>
        <Input
          id="deal-trial-start"
          name="trial_start"
          type="date"
          required={required}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        {required && <FieldHint>トライアル中は開始・終了とも必須です</FieldHint>}
      </Field>
      <Field>
        <Label htmlFor="deal-trial-end">トライアル終了{required && " *"}</Label>
        <Input
          id="deal-trial-end"
          name="trial_end"
          type="date"
          required={required}
          min={start || undefined}
          defaultValue={trialEnd ?? ""}
        />
      </Field>
    </div>
  );
}
