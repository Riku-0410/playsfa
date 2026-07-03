import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardInset, CardTitle } from "@/components/ui/card";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SearchSelect } from "@/components/ui/search-select";
import { todayJST } from "@/lib/dates";
import { SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createContract } from "../actions";
import { FeeRows } from "../fee-rows";

export const dynamic = "force-dynamic";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ deal?: string; customer?: string }>;
}) {
  const { deal: dealId, customer: customerId } = await searchParams;
  const db = createAdminClient();

  const [customersRes, dealRes] = await Promise.all([
    db.from("customers").select("id, name").order("name"),
    dealId
      ? db
          .from("deals")
          .select("id, customer_id, service, amount_expected, competitor_expiry, expected_billing_start, customers(name)")
          .eq("id", dealId)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const customers = customersRes.data ?? [];
  const deal = dealRes.data;
  const today = todayJST();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="契約を登録"
        description={
          deal
            ? `商談「${deal.customers?.name}」から作成`
            : undefined
        }
      />

      <CardInset className="p-4 text-xs text-ink-secondary">
        登録と同時に、契約期間分の請求書が「予定」として自動生成されます。
        年払いは1本、半期払いは2本。支払期限は発行日の30日後。
      </CardInset>

      <Card>
        <CardHeader>
          <CardTitle>契約条件</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={createContract} className="space-y-4">
            {deal && <input type="hidden" name="deal_id" value={deal.id} />}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="ct-customer">顧客 *</Label>
                <SearchSelect
                  id="ct-customer"
                  name="customer_id"
                  required
                  defaultValue={deal?.customer_id ?? customerId}
                  options={customers.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field>
                <Label htmlFor="ct-service">サービス *</Label>
                <Select
                  id="ct-service"
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
                <Label htmlFor="ct-cycle">支払いサイクル *</Label>
                <Select id="ct-cycle" name="billing_cycle" required defaultValue="annual">
                  <option value="annual">年払い(請求1本)</option>
                  <option value="semiannual">半期払い(請求2本)</option>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="ct-amount">請求額/回(税抜) *</Label>
                <Input
                  id="ct-amount"
                  name="amount_per_billing"
                  inputMode="numeric"
                  required
                  placeholder="480,000"
                  defaultValue={deal?.amount_expected ?? ""}
                />
                <FieldHint>年払いなら年額、半期払いなら半年分</FieldHint>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="ct-agreement">契約合意日 *</Label>
                <Input
                  id="ct-agreement"
                  name="agreement_date"
                  type="date"
                  required
                  defaultValue={today}
                />
              </Field>
              <Field>
                <Label htmlFor="ct-billing-start">課金開始日 *</Label>
                <Input
                  id="ct-billing-start"
                  name="billing_start_date"
                  type="date"
                  required
                  defaultValue={
                    deal?.expected_billing_start ?? deal?.competitor_expiry ?? ""
                  }
                />
                <FieldHint>
                  競合の契約が切れる月。ここを起点に請求が走ります
                </FieldHint>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="ct-plan">プラン名</Label>
                <Input id="ct-plan" name="plan_name" placeholder="スタンダード" />
              </Field>
              <Field>
                <Label htmlFor="ct-tax">税率(%)</Label>
                <Input
                  id="ct-tax"
                  name="tax_rate"
                  inputMode="numeric"
                  defaultValue="10"
                />
              </Field>
            </div>
            <div className="border-t border-line pt-4">
              <FeeRows />
            </div>
            <Field>
              <Label htmlFor="ct-note">メモ</Label>
              <Textarea id="ct-note" name="note" />
            </Field>
            <div className="flex justify-end pt-2">
              <Button type="submit">契約を登録して請求を生成 →</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
