import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { SaveForm } from "@/components/save-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { formatJPY } from "@/lib/format";
import { contractIdsOf } from "@/lib/invoices";
import { INVOICE_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteInvoice,
  markSent,
  restoreInvoice,
  splitInvoice,
  unpayInvoice,
  unsendInvoice,
  updateInvoice,
  voidInvoice,
} from "../../actions";
import { ItemRows } from "../../item-rows";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: invoice } = await db
    .from("invoices")
    .select(
      "*, invoice_items(description, amount, sort_order, contract_id, period_start, period_end, contracts(service, amount_per_billing)), customers(name)",
    )
    .eq("id", id)
    .single();
  if (!invoice) notFound();

  const items = [...invoice.invoice_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const st = INVOICE_STATUSES[invoice.status];
  const paid = invoice.status === "paid";
  // 載っている契約(サービス)。まとめ請求なら複数
  const contracts = contractIdsOf(items).map((cid) => {
    const c = items.find((it) => it.contract_id === cid)?.contracts;
    return { id: cid, service: c?.service };
  });
  const unsent = invoice.status === "unsent";
  const mergeable = unsent && contracts.length >= 2;
  // 利用料行の金額を変えたとき「契約の請求額にも反映するか」を聞くための現在値
  const contractAmounts = Object.fromEntries(
    items
      .filter((it) => it.contract_id && it.contracts)
      .map((it) => [it.contract_id!, it.contracts!.amount_per_billing]),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`請求書 ${invoice.invoice_number ?? "(送付時に採番)"}`}
        description={`${invoice.customers?.name} ・ ${formatJPY(invoice.total)}`}
        actions={
          <>
            {contracts.map((c) =>
              c.service ? (
                <Badge key={c.id} variant={SERVICES[c.service].badge} dot>
                  {SERVICES[c.service].label}
                </Badge>
              ) : null,
            )}
            <Badge variant={st.badge} dot>{st.label}</Badge>
            <Link href={`/invoices/${invoice.id}/print`}>
              <Button variant="outline" size="sm">表示</Button>
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>ステータス操作</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {unsent && (
            <ConfirmForm
              action={markSent}
              message={`合計 ${formatJPY(invoice.total)}(税込)で送付済にします${invoice.invoice_number ? "" : "(請求番号が付きます)"}。仮の金額のままになっていませんか？`}
            >
              <input type="hidden" name="id" value={invoice.id} />
              <Button variant="dark" size="sm" type="submit">送付済にする</Button>
            </ConfirmForm>
          )}
          {["sent", "overdue"].includes(invoice.status) && (
            <ConfirmForm
              action={unsendInvoice}
              message="送付を取り消して「未送付」に戻しますか？(請求番号はそのまま)"
            >
              <input type="hidden" name="id" value={invoice.id} />
              <Button variant="outline" size="sm" type="submit">送付を取り消す</Button>
            </ConfirmForm>
          )}
          {paid && (
            <ConfirmForm
              action={unpayInvoice}
              message="入金を取り消します。入金レコードも削除されます。よろしいですか？"
            >
              <input type="hidden" name="id" value={invoice.id} />
              <Button variant="outline" size="sm" type="submit">入金を取り消す</Button>
            </ConfirmForm>
          )}
          {["unsent", "sent", "overdue"].includes(invoice.status) && (
            <ConfirmForm
              action={voidInvoice}
              message="この請求書を無効にします(解約時など)。よろしいですか？"
            >
              <input type="hidden" name="id" value={invoice.id} />
              <Button variant="ghost" size="sm" type="submit">無効にする</Button>
            </ConfirmForm>
          )}
          {invoice.status === "void" && (
            <ConfirmForm action={restoreInvoice} message="無効を取り消して「未送付」に戻しますか？">
              <input type="hidden" name="id" value={invoice.id} />
              <Button variant="outline" size="sm" type="submit">未送付に戻す</Button>
            </ConfirmForm>
          )}
          {mergeable && (
            <ConfirmForm
              action={splitInvoice}
              message="この請求書を契約ごとに分けます。よろしいですか？"
            >
              <input type="hidden" name="id" value={invoice.id} />
              <Button variant="outline" size="sm" type="submit">契約ごとに分ける</Button>
            </ConfirmForm>
          )}
        </CardBody>
      </Card>

      <Card className={paid ? "opacity-60" : undefined}>
        <CardHeader>
          <CardTitle>内容を編集</CardTitle>
        </CardHeader>
        <CardBody>
          {paid ? (
            <p className="text-sm text-ink-muted">
              入金済みの請求書は編集できません。先に「入金を取り消す」を実行してください。
            </p>
          ) : (
            <SaveForm action={updateInvoice} fallback="/invoices" className="space-y-4">
              <input type="hidden" name="id" value={invoice.id} />
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <Label htmlFor="ie-issue">発行日</Label>
                  <Input
                    id="ie-issue"
                    name="issue_date"
                    type="date"
                    required
                    disabled={!unsent}
                    defaultValue={invoice.issue_date}
                  />
                  {unsent ? (
                    <FieldHint>請求書に印字される日付</FieldHint>
                  ) : (
                    <FieldHint>送付済みのため変更不可</FieldHint>
                  )}
                </Field>
                <Field>
                  <Label htmlFor="ie-due">支払期限</Label>
                  <Input
                    id="ie-due"
                    name="due_date"
                    type="date"
                    required
                    defaultValue={invoice.due_date}
                  />
                </Field>
              </div>
              <div className="border-t border-line pt-4">
                <ItemRows initial={items} contractAmounts={contractAmounts} />
              </div>
              <Field>
                <Label htmlFor="ie-note">備考(請求書に印字)</Label>
                <Textarea
                  id="ie-note"
                  name="note"
                  defaultValue={invoice.note ?? ""}
                />
              </Field>
              <div className="flex justify-end pt-2">
                <Button type="submit">保存する</Button>
              </div>
            </SaveForm>
          )}
        </CardBody>
      </Card>

      <Card className="border border-critical/30">
        <CardBody className="flex items-center justify-between gap-4 py-5">
          <p className="text-xs text-ink-muted">
            請求書を削除します。入金済みの場合は削除できません。
          </p>
          <ConfirmForm
            action={deleteInvoice}
            message="この請求書を削除しますか？"
          >
            <input type="hidden" name="id" value={invoice.id} />
            <Button variant="danger" size="sm" type="submit">請求書を削除</Button>
          </ConfirmForm>
        </CardBody>
      </Card>
    </div>
  );
}
