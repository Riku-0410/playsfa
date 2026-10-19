"use client";

import { useState } from "react";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import type { BillingCycle } from "@/lib/billing";

const PER_YEAR: Record<BillingCycle, number> = { annual: 1, semiannual: 2 };

/** 支払いサイクルと1回あたりの金額。サイクルを変えると年額が同じになるよう金額を換算して入れる */
export function BillingTermsFields({
  cycle: initialCycle,
  amount: initialAmount,
}: {
  cycle: BillingCycle;
  amount: number;
}) {
  const [cycle, setCycle] = useState(initialCycle);
  const [amount, setAmount] = useState(String(initialAmount));
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field>
        <Label htmlFor="cb-cycle">支払いサイクル</Label>
        <Select
          id="cb-cycle"
          name="billing_cycle"
          value={cycle}
          onChange={(e) => {
            const next = e.target.value as BillingCycle;
            const n = Number(amount.replace(/[,\s]/g, ""));
            if (n > 0) setAmount(String(Math.round((n * PER_YEAR[cycle]) / PER_YEAR[next])));
            setCycle(next);
          }}
        >
          <option value="annual">年払い(請求1本)</option>
          <option value="semiannual">半期払い(請求2本)</option>
        </Select>
      </Field>
      <Field>
        <Label htmlFor="cb-amount">請求額/回(税抜)</Label>
        <Input
          id="cb-amount"
          name="amount_per_billing"
          inputMode="numeric"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <FieldHint>サイクルを変えると年額が同じになるよう換算します</FieldHint>
      </Field>
    </div>
  );
}
