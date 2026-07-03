import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-search";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SortableTH } from "@/components/ui/sortable-th";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatJPY } from "@/lib/format";
import { listHref, parseListParams, searchQuery } from "@/lib/list-params";
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

const SORTS = {
  number: "invoice_number",
  customer: "customers(name)",
  period: "period_start",
  issue: "issue_date",
  due: "due_date",
  total: "total",
  status: "status",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    contract?: string;
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { status, contract, q: rawQ, ...raw } = await searchParams;
  const q = searchQuery(rawQ);
  const { page, sortKey, orderExpr, dir, from, to } = parseListParams(raw, {
    sorts: SORTS,
    defaultSort: "issue",
    defaultDir: "asc",
  });
  const db = createAdminClient();
  const today = format(new Date(), "yyyy-MM-dd");

  let query = db
    .from("invoices")
    .select(
      "id, invoice_number, period_start, period_end, issue_date, due_date, total, status, customers!inner(id, name), contracts(service)",
      { count: "exact" },
    )
    .order(orderExpr, { ascending: dir === "asc" })
    .order("id")
    .range(from, to);
  if (status === "unpaid") {
    query = query.in("status", ["issued", "sent", "overdue"]);
  } else if (status && status in INVOICE_STATUSES) {
    query = query.eq("status", status as keyof typeof INVOICE_STATUSES);
  }
  if (contract) query = query.eq("contract_id", contract);
  if (q) query = query.ilike("customers.name", `%${q}%`);
  const { data: invoices, count } = await query;
  const total = count ?? 0;

  const keptParams = {
    status,
    contract,
    q: q ?? undefined,
    sort: raw.sort,
    dir: raw.dir,
  };
  const sortProps = {
    basePath: "/invoices",
    params: { status, contract, q: q ?? undefined },
    sort: sortKey,
    dir,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="請求"
        description={
          contract
            ? "この契約の請求書(自動生成されたスケジュール)"
            : `${total}件`
        }
        actions={
          contract ? (
            <Link href="/invoices">
              <Button variant="outline">すべての請求を見る</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
        <Link
          href={listHref("/invoices", {
            contract,
            q: q ?? undefined,
            sort: raw.sort,
            dir: raw.dir,
          })}
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
            href={listHref("/invoices", {
              status: k,
              contract,
              q: q ?? undefined,
              sort: raw.sort,
              dir: raw.dir,
            })}
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
        <ListSearch
          basePath="/invoices"
          q={rawQ}
          placeholder="顧客名で検索…"
          params={{ status, contract, sort: raw.sort, dir: raw.dir }}
        />
      </div>

      <Card>
        {!invoices?.length ? (
          q ? (
            <EmptyState
              title={`「${q}」に一致する請求書がありません`}
              description="検索語を変えるか、フィルタを解除してみてください"
            />
          ) : (
            <EmptyState
              title="請求書がありません"
              description="契約を登録すると請求書が自動でスケジュールされます"
              action={
                <Link href="/contracts/new">
                  <Button size="sm">契約を登録 →</Button>
                </Link>
              }
            />
          )
        ) : (
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <SortableTH label="請求番号" sortKey="number" {...sortProps} />
                  <SortableTH label="顧客" sortKey="customer" {...sortProps} />
                  <TH>サービス</TH>
                  <SortableTH label="対象期間" sortKey="period" {...sortProps} />
                  <SortableTH label="発行日" sortKey="issue" {...sortProps} />
                  <SortableTH label="支払期限" sortKey="due" {...sortProps} />
                  <SortableTH
                    label="金額(税込)"
                    sortKey="total"
                    numeric
                    {...sortProps}
                  />
                  <SortableTH label="ステータス" sortKey="status" {...sortProps} />
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
            <Pagination
              basePath="/invoices"
              params={keptParams}
              page={page}
              total={total}
            />
          </CardBody>
        )}
      </Card>
    </div>
  );
}
