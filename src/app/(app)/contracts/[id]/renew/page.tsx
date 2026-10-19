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
import { successorOf } from "@/lib/contracts";
import { todayJST } from "@/lib/dates";
import { formatJPY, formatPerBilling } from "@/lib/format";
import { BILLING_CYCLES, INVOICE_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { renewContract } from "../../actions";
import { ContractMemoFields } from "../../contract-memo-fields";
import { FeeRows } from "../../fee-rows";

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
  const recurringFees = (contract.contract_fees ?? []).filter((f) => f.recurring);
  const successor = await successorOf(db, contract.id);
  const canRenew =
    !successor && (contract.status === "active" || contract.status === "ended");
  const today = todayJST();

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
        <p className="font-semibold">
          今の契約 {contract.billing_start_date} 〜 {endDate}
        </p>
        <p className="text-xs text-ink-muted">
          更新すると新しい契約(12ヶ月)として登録し、その期間分の請求書を「未送付」で作ります。
          今の契約は{endDate < today ? "すぐに" : `終了日(${endDate})を過ぎた翌朝に`}「満了」になります。
          今の契約の請求書は変わりません。
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

      {successor ? (
        <Card>
          <CardBody className="flex items-center justify-between gap-4 text-sm text-ink-secondary">
            <span>
              この契約は更新済みです(新しい契約は {successor.billing_start_date} から)
            </span>
            <Link href={`/contracts/${successor.id}/edit`}>
              <Button size="sm" variant="outline">新しい契約を見る →</Button>
            </Link>
          </CardBody>
        </Card>
      ) : !canRenew ? (
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
            <CardTitle>新しい契約の条件</CardTitle>
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
                    {formatPerBilling(contract.amount_per_billing)}。0円なら無償(請求書なし)
                  </FieldHint>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <Label htmlFor="cr-agreement">契約合意日 *</Label>
                  <Input
                    id="cr-agreement"
                    name="agreement_date"
                    type="date"
                    required
                    defaultValue={today}
                  />
                </Field>
                <Field>
                  <Label htmlFor="cr-start">課金開始日 *</Label>
                  <Input
                    id="cr-start"
                    name="billing_start_date"
                    type="date"
                    required
                    min={nextStart}
                    defaultValue={nextStart}
                  />
                  <FieldHint>
                    新しい契約がいつからか。今の契約の終了日({endDate})より後の日付
                  </FieldHint>
                </Field>
              </div>
              <div className="border-t border-line pt-4">
                <FeeRows initial={recurringFees} />
              </div>
              <div className="border-t border-line pt-4">
                <ContractMemoFields />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit">新しい契約を登録して請求を生成 →</Button>
              </div>
            </SaveForm>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
