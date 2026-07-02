import { Button } from "@/components/ui/button";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { DEAL_STAGES, SERVICES } from "@/lib/status";

type DealDefaults = {
  id?: string;
  customer_id?: string;
  service?: string;
  stage?: string;
  title?: string | null;
  amount_expected?: number | null;
  trial_start?: string | null;
  trial_end?: string | null;
  competitor?: string | null;
  competitor_expiry?: string | null;
  expected_billing_start?: string | null;
  lost_reason?: string | null;
  note?: string | null;
};

export function DealForm({
  action,
  customers,
  deal,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  customers: { id: string; name: string }[];
  deal?: DealDefaults;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {deal?.id && <input type="hidden" name="id" value={deal.id} />}
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="deal-customer">顧客 *</Label>
          <Select
            id="deal-customer"
            name="customer_id"
            required
            defaultValue={deal?.customer_id ?? ""}
          >
            <option value="" disabled>選択してください</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="deal-service">サービス *</Label>
          <Select
            id="deal-service"
            name="service"
            required
            defaultValue={deal?.service ?? "baskestats"}
          >
            {Object.entries(SERVICES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="deal-stage">ステージ *</Label>
          <Select
            id="deal-stage"
            name="stage"
            required
            defaultValue={deal?.stage ?? "lead"}
          >
            {Object.entries(DEAL_STAGES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="deal-amount">見込額(年・税抜)</Label>
          <Input
            id="deal-amount"
            name="amount_expected"
            inputMode="numeric"
            placeholder="480,000"
            defaultValue={deal?.amount_expected ?? ""}
          />
        </Field>
      </div>
      <Field>
        <Label htmlFor="deal-title">タイトル</Label>
        <Input
          id="deal-title"
          name="title"
          placeholder="新チーム発足に伴う導入検討"
          defaultValue={deal?.title ?? ""}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="deal-trial-start">トライアル開始</Label>
          <Input
            id="deal-trial-start"
            name="trial_start"
            type="date"
            defaultValue={deal?.trial_start ?? ""}
          />
        </Field>
        <Field>
          <Label htmlFor="deal-trial-end">トライアル終了</Label>
          <Input
            id="deal-trial-end"
            name="trial_end"
            type="date"
            defaultValue={deal?.trial_end ?? ""}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="deal-competitor">競合</Label>
          <Input
            id="deal-competitor"
            name="competitor"
            placeholder="A社"
            defaultValue={deal?.competitor ?? ""}
          />
        </Field>
        <Field>
          <Label htmlFor="deal-competitor-expiry">競合の契約期限</Label>
          <Input
            id="deal-competitor-expiry"
            name="competitor_expiry"
            type="date"
            defaultValue={deal?.competitor_expiry ?? ""}
          />
          <FieldHint>課金開始月の根拠になります</FieldHint>
        </Field>
      </div>
      <Field>
        <Label htmlFor="deal-billing-start">課金開始予定</Label>
        <Input
          id="deal-billing-start"
          name="expected_billing_start"
          type="date"
          defaultValue={deal?.expected_billing_start ?? ""}
        />
      </Field>
      <Field>
        <Label htmlFor="deal-lost-reason">失注理由</Label>
        <Input
          id="deal-lost-reason"
          name="lost_reason"
          placeholder="失注時のみ"
          defaultValue={deal?.lost_reason ?? ""}
        />
      </Field>
      <Field>
        <Label htmlFor="deal-note">メモ</Label>
        <Textarea id="deal-note" name="note" defaultValue={deal?.note ?? ""} />
      </Field>
      <div className="flex justify-end pt-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
