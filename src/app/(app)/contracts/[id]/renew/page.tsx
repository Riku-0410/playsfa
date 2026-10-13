import Link from "next/link";
import { notFound } from "next/navigation";
import { SaveForm } from "@/components/save-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardInset, CardTitle } from "@/components/ui/card";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { contractEndDate, nextTermStart } from "@/lib/billing";
import { todayJST } from "@/lib/dates";
import { formatJPY } from "@/lib/format";
import { BILLING_CYCLES, INVOICE_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { renewContract } from "../../actions";

export const dynamic = "force-dynamic";

export default async function RenewContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: contract } = await db
    .from("contracts")
    .select("*, customers(name), contract_fees(description, amount, recurring)")
    .eq("id", id)
    .single();
  if (!contract) notFound();

  // 前期 = 直近12ヶ月の契約期間。請求書は自由に編集されるので、契約の金額ではなく実際の明細を見せる
  const termStart = nextTermStart(contract.billing_start_date, contract.term_months - 12);
  const { data: itemRows } = await db
    .from("invoice_items")
    .select(
      "id, description, amount, sort_order, invoices!inner(id, invoice_number, issue_date, period_start, period_end, status)",
    )
    .eq("contract_id", contract.id)
    .gte("invoices.period_start", termStart)
    .neq("invoices.status", "void");
  const byInvoice = new Map<string, NonNullable<typeof itemRows>>();
  for (const it of itemRows ?? []) {
    byInvoice.set(it.invoices.id, [...(byInvoice.get(it.invoices.id) ?? []), it]);
  }
  const prevInvoices = [...byInvoice.values()]
    .map((items) => ({
      ...items[0].invoices,
      items: items.sort((a, b) => a.sort_order - b.sort_order),
      subtotal: items.reduce((sum, it) => sum + it.amount, 0),
    }))
    .sort((a, b) => a.issue_date.localeCompare(b.issue_date));
  const prevTotal = prevInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);

  const endDate = contractEndDate(contract.billing_start_date, contract.term_months);
  const nextStart = nextTermStart(contract.billing_start_date, contract.term_months);
  const nextEnd = contractEndDate(nextStart, 12);
  const recurringFees = (contract.contract_fees ?? []).filter((f) => f.recurring);
  const canRenew = contract.status === "active" || contract.status === "ended";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`${contract.customers?.name} の契約を更新`}
        actions={
          <Badge variant={SERVICES[contract.service].badge} dot>
            {SERVICES[contract.service].label}
          </Badge>
        }
      />

      <CardInset className="space-y-1 p-4 text-sm">
        <p>
          現在の契約期間 {contract.billing_start_date} 〜 {endDate}
        </p>
        <p className="font-semibold">
          次期 {nextStart} 〜 {nextEnd}(12ヶ月)
        </p>
        <p className="text-xs text-ink-muted">
          契約はそのまま期間が12ヶ月延び、次期分の請求書が「予定」として生成されます。
          過去の請求書は変わりません。条件が変わった場合はここで直してください。
          新しい契約として登録し直す場合は、旧契約をダッシュボードか編集画面から「満了」にしてください。
        </p>
      </CardInset>

      <Card>
        <CardHeader>
          <CardTitle>前期の請求</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {prevInvoices.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {termStart} 以降の請求書はありません
            </p>
          ) : (
            <>
              {prevInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-inner border border-line/60 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/invoices/${inv.id}/edit`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {inv.invoice_number ?? "(未採番)"}
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        {inv.period_start} 〜 {inv.period_end}
                      </span>
                    </Link>
                    <Badge variant={INVOICE_STATUSES[inv.status].badge} dot>
                      {INVOICE_STATUSES[inv.status].label}
                    </Badge>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {inv.items.map((it) => (
                      <li key={it.id} className="flex justify-between gap-4">
                        <span className="text-ink-secondary">{it.description}</span>
                        <span className="shrink-0 tabular-nums">{formatJPY(it.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="flex justify-between px-4 text-sm font-semibold">
                <span>前期の合計(税抜)</span>
                <span className="tabular-nums">{formatJPY(prevTotal)}</span>
              </p>
            </>
          )}
        </CardBody>
      </Card>

      {!canRenew ? (
        <Card>
          <CardBody className="text-sm text-ink-secondary">
            {contract.status === "churned"
              ? "解約済みの契約は更新できません。条件を変えて再開する場合は新しい契約を登録してください。"
              : "課金開始前の契約は更新できません。"}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>次期の契約条件</CardTitle>
          </CardHeader>
          <CardBody>
            <SaveForm
              action={renewContract}
              fallback="/contracts"
              backOnSuccess={false}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={contract.id} />
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <Label htmlFor="cr-cycle">支払いサイクル *</Label>
                  <Select
                    id="cr-cycle"
                    name="billing_cycle"
                    required
                    defaultValue={contract.billing_cycle}
                  >
                    <option value="annual">年払い(請求1本)</option>
                    <option value="semiannual">半期払い(請求2本)</option>
                  </Select>
                </Field>
                <Field>
                  <Label htmlFor="cr-amount">請求額/回(税抜) *</Label>
                  <Input
                    id="cr-amount"
                    name="amount_per_billing"
                    inputMode="numeric"
                    required
                    defaultValue={contract.amount_per_billing}
                  />
                  <FieldHint>
                    現在 {BILLING_CYCLES[contract.billing_cycle]}{" "}
                    {formatJPY(contract.amount_per_billing)}/回
                  </FieldHint>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <Label htmlFor="cr-agreement">更新合意日 *</Label>
                  <Input
                    id="cr-agreement"
                    name="agreement_date"
                    type="date"
                    required
                    defaultValue={todayJST()}
                  />
                </Field>
              </div>
              <div className="border-t border-line pt-4 text-sm">
                <p className="text-xs font-bold text-ink-secondary">
                  次期の初回請求に載る費用
                </p>
                {recurringFees.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-muted">
                    毎年かかる費用はありません(初期費用は載りません)
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {recurringFees.map((f) => (
                      <li key={f.description} className="flex justify-between">
                        <span>{f.description}</span>
                        <span className="font-semibold tabular-nums">
                          {formatJPY(f.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit">更新して次期の請求を生成 →</Button>
              </div>
            </SaveForm>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
