"use client";

import { useEffect, useRef, useState } from "react";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** ステージがトライアル中なら開始・終了を必須にする。ステージは同じフォームの select[name=stage] を見る */
export function TrialDateFields({
  trialStart,
  trialEnd,
}: {
  trialStart?: string | null;
  trialEnd?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [required, setRequired] = useState(false);
  const [start, setStart] = useState(trialStart ?? "");

  useEffect(() => {
    const stage = ref.current
      ?.closest("form")
      ?.querySelector<HTMLSelectElement | HTMLInputElement>('[name="stage"]');
    if (!stage) return;
    const sync = () => setRequired(stage.value === "trial");
    sync();
    stage.addEventListener("change", sync);
    return () => stage.removeEventListener("change", sync);
  }, []);

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
