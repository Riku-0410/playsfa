import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatJPY } from "@/lib/format";
import { INVOICE_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmForm } from "@/components/confirm-form";
import {
  issueInvoice,
  markSent,
  registerPayment,
  unissueInvoice,
  unpayInvoice,
  unsendInvoice,
} from "./actions";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, string> = {
  scheduled: "予定",
  issued: "発行済",
  sent: "送付済",
  unpaid: "未入金",
  paid: "入金済",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; contract?: string }>;
}) {
  const { status, contract } = await searchParams;
  const db = createAdminClient();
  const today = format(new Date(), "yyyy-MM-dd");

  let query = db
    .from("invoices")
    .select(
      "id, invoice_number, period_start, period_end, issue_date, due_date, total, status, customers(id, name), contracts(service)",
    )
    .order("issue_date");
  if (status === "unpaid") {
    query = query.in("status", ["issued", "sent", "overdue"]);
  } else if (status && status in INVOICE_STATUSES) {
    query = query.eq("status", status as keyof typeof INVOICE_STATUSES);
  }
  if (contract) query = query.eq("contract_id", contract);
  const { data: invoices } = await query;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="請求"
        description={
          contract
            ? "この契約の請求書(自動生成されたスケジュール)"
            : `${invoices?.length ?? 0}件`
        }
        actions={
          contract ? (
            <Link href="/invoices">
              <Button variant="outline">すべての請求を見る</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/invoices"
          className={cn(
            "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
            !status
              ? "bg-night text-night-ink"
              : "bg-surface text-ink-secondary border border-line hover:bg-sunken",
          )}
        >
          すべて
        </Link>
        {Object.entries(FILTERS).map(([k, label]) => (
          <Link
            key={k}
            href={`/invoices?status=${k}`}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
              status === k
                ? "bg-night text-night-ink"
                : "bg-surface text-ink-secondary border border-line hover:bg-sunken",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card>
        {!invoices?.length ? (
          <EmptyState
            title="請求書がありません"
            description="契約を登録すると請求書が自動でスケジュールされます"
            action={
              <Link href="/contracts/new">
                <Button size="sm">契約を登録 →</Button>
              </Link>
            }
          />
        ) : (
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>請求番号</TH>
                  <TH>顧客</TH>
                  <TH>サービス</TH>
                  <TH>対象期間</TH>
                  <TH>発行日</TH>
                  <TH>支払期限</TH>
                  <TH numeric>金額(税込)</TH>
                  <TH>ステータス</TH>
                  <TH>アクション</TH>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const service = inv.contracts?.service;
                  const overdue =
                    ["issued", "sent"].includes(inv.status) &&
                    inv.due_date < today;
                  const st = overdue
                    ? INVOICE_STATUSES.overdue
                    : INVOICE_STATUSES[inv.status];
                  return (
                    <TR key={inv.id}>
                      <TD className="font-semibold">
                        {inv.invoice_number ?? "—"}
                      </TD>
                      <TD>
                        <Link
                          href={`/customers/${inv.customers?.id}`}
                          className="font-semibold hover:underline"
                        >
                          {inv.customers?.name}
                        </Link>
                      </TD>
                      <TD>
                        {service && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: SERVICES[service].seriesVar }}
                            />
                            {SERVICES[service].label}
                          </span>
                        )}
                      </TD>
                      <TD className="text-xs text-ink-secondary whitespace-nowrap">
                        {inv.period_start} 〜 {inv.period_end}
                      </TD>
                      <TD className="text-ink-secondary">{inv.issue_date}</TD>
                      <TD
                        className={cn(
                          "text-ink-secondary",
                          overdue && "font-semibold text-critical-deep",
                        )}
                      >
                        {inv.due_date}
                      </TD>
                      <TD numeric className="font-semibold">
                        {formatJPY(inv.total)}
                      </TD>
                      <TD>
                        <Badge variant={st.badge} dot>{st.label}</Badge>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          {inv.status === "scheduled" && (
                            <form action={issueInvoice}>
                              <input type="hidden" name="id" value={inv.id} />
                              <Button size="sm" type="submit">発行</Button>
                            </form>
                          )}
                          {inv.status === "issued" && (
                            <form action={markSent}>
                              <input type="hidden" name="id" value={inv.id} />
                              <Button size="sm" variant="dark" type="submit">
                                送付済に
                              </Button>
                            </form>
                          )}
                          {["issued", "sent", "overdue"].includes(inv.status) && (
                            <form action={registerPayment}>
                              <input type="hidden" name="id" value={inv.id} />
                              <Button size="sm" variant="outline" type="submit">
                                入金登録
                              </Button>
                            </form>
                          )}
                          {["issued", "overdue"].includes(inv.status) && (
                            <ConfirmForm
                              action={unissueInvoice}
                              message="発行を取り消して「予定」に戻します。よろしいですか？"
                            >
                              <input type="hidden" name="id" value={inv.id} />
                              <Button size="sm" variant="ghost" type="submit">
                                発行取消
                              </Button>
                            </ConfirmForm>
                          )}
                          {inv.status === "sent" && (
                            <ConfirmForm
                              action={unsendInvoice}
                              message="送付を取り消して「発行済」に戻しますか？"
                            >
                              <input type="hidden" name="id" value={inv.id} />
                              <Button size="sm" variant="ghost" type="submit">
                                送付取消
                              </Button>
                            </ConfirmForm>
                          )}
                          {inv.status === "paid" && (
                            <ConfirmForm
                              action={unpayInvoice}
                              message="入金を取り消します。入金レコードも削除されます。よろしいですか？"
                            >
                              <input type="hidden" name="id" value={inv.id} />
                              <Button size="sm" variant="ghost" type="submit">
                                入金取消
                              </Button>
                            </ConfirmForm>
                          )}
                          <Link href={`/invoices/${inv.id}/print`}>
                            <Button size="sm" variant="ghost">表示</Button>
                          </Link>
                          <Link href={`/invoices/${inv.id}/edit`}>
                            <Button size="sm" variant="ghost">編集</Button>
                          </Link>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
