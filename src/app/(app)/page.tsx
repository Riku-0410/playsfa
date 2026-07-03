import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { addDaysJST, monthBoundsJST, todayJST } from "@/lib/dates";
import { formatJPY } from "@/lib/format";
import { INVOICE_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = createAdminClient();
  const today = todayJST();
  const { start: monthStart, end: monthEnd } = monthBoundsJST();
  const soon = addDaysJST(14);
  const [ty, tm, td] = today.split("-").map(Number);

  const [monthInvoices, unpaid, toIssue, trials, activeContracts] =
    await Promise.all([
      db
        .from("invoices")
        .select("total")
        .gte("issue_date", monthStart)
        .lte("issue_date", monthEnd)
        .neq("status", "void"),
      db
        .from("invoices")
        .select("id, total, due_date, invoice_number, status, customers(name)")
        .in("status", ["issued", "sent", "overdue"])
        .order("due_date"),
      db
        .from("invoices")
        .select("id, total, issue_date, customers(name)")
        .eq("status", "scheduled")
        .lte("issue_date", today)
        .order("issue_date"),
      db
        .from("deals")
        .select("id, trial_end, service, customers(name)")
        .eq("stage", "trial")
        .not("trial_end", "is", null)
        .lte("trial_end", soon)
        .order("trial_end"),
      db
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  const monthTotal = (monthInvoices.data ?? []).reduce((a, r) => a + r.total, 0);
  const unpaidRows = unpaid.data ?? [];
  const unpaidTotal = unpaidRows.reduce((a, r) => a + r.total, 0);
  const overdueRows = unpaidRows.filter(
    (r) => r.status === "overdue" || r.due_date < today,
  );
  const toIssueRows = toIssue.data ?? [];
  const trialRows = trials.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="ダッシュボード"
        description={`${ty}年${tm}月${td}日`}
        actions={
          <Link href="/deals/new">
            <Button>商談を追加 →</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="今月の請求" value={formatJPY(monthTotal)} />
        <StatCard label="未回収" value={formatJPY(unpaidTotal)} />
        <StatCard label="期限超過" value={`${overdueRows.length}件`} />
        <StatCard
          label="課金中の契約"
          value={`${activeContracts.count ?? 0}件`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>発行待ちの請求書</CardTitle>
            <Link href="/invoices">
              <Button variant="outline" size="sm">請求一覧 →</Button>
            </Link>
          </CardHeader>
          {toIssueRows.length === 0 ? (
            <EmptyState title="今日発行すべき請求書はありません" />
          ) : (
            <CardBody className="px-2 pt-2">
              <Table>
                <thead>
                  <tr>
                    <TH>顧客</TH>
                    <TH>発行予定日</TH>
                    <TH numeric>金額</TH>
                  </tr>
                </thead>
                <tbody>
                  {toIssueRows.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-semibold">{r.customers?.name}</TD>
                      <TD className="text-ink-secondary">{r.issue_date}</TD>
                      <TD numeric className="font-semibold">
                        {formatJPY(r.total)}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>トライアル終了間近</CardTitle>
            <Link href="/deals?stage=trial">
              <Button variant="outline" size="sm">商談一覧 →</Button>
            </Link>
          </CardHeader>
          {trialRows.length === 0 ? (
            <EmptyState title="14日以内に終了するトライアルはありません" />
          ) : (
            <CardBody className="px-2 pt-2">
              <Table>
                <thead>
                  <tr>
                    <TH>顧客</TH>
                    <TH>サービス</TH>
                    <TH>終了日</TH>
                  </tr>
                </thead>
                <tbody>
                  {trialRows.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-semibold">
                        <Link href={`/deals/${r.id}`} className="hover:underline">
                          {r.customers?.name}
                        </Link>
                      </TD>
                      <TD>
                        <Badge variant={SERVICES[r.service].badge} dot>
                          {SERVICES[r.service].label}
                        </Badge>
                      </TD>
                      <TD className="font-semibold text-critical-deep">
                        {r.trial_end}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          )}
        </Card>
      </div>

      {overdueRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-critical-deep">期限超過の未入金</CardTitle>
          </CardHeader>
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>請求番号</TH>
                  <TH>顧客</TH>
                  <TH>支払期限</TH>
                  <TH numeric>金額</TH>
                  <TH>ステータス</TH>
                </tr>
              </thead>
              <tbody>
                {overdueRows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-semibold">{r.invoice_number ?? "—"}</TD>
                    <TD>{r.customers?.name}</TD>
                    <TD className="font-semibold text-critical-deep">
                      {r.due_date}
                    </TD>
                    <TD numeric className="font-semibold">
                      {formatJPY(r.total)}
                    </TD>
                    <TD>
                      <Badge variant={INVOICE_STATUSES[r.status].badge} dot>
                        {INVOICE_STATUSES[r.status].label}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
