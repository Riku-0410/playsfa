import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Meter } from "@/components/ui/meter";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { addDaysJST, monthBoundsJST, todayJST } from "@/lib/dates";
import { formatJPY } from "@/lib/format";
import { INVOICE_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveTrialTargets } from "./actions";

/** KPIカードの系列。チャートと同じ固定順・固定色 */
const SERVICE_KEYS = Object.keys(SERVICES) as (keyof typeof SERVICES)[];

/** 系列ドット+メーター+実績/目標+入力欄の1行。全社・担当者別で共通 */
function TargetRow({
  service,
  actual,
  target,
  inputName,
}: {
  service: keyof typeof SERVICES;
  actual: number;
  target: number | undefined;
  inputName: string;
}) {
  const meta = SERVICES[service];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="flex w-20 shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-secondary">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: meta.seriesVar }}
        />
        {meta.label}
      </span>
      <Meter
        value={actual}
        max={target ?? 0}
        color={meta.seriesVar}
        className="min-w-20 flex-1"
      />
      <span className="w-24 shrink-0 text-right text-xs text-ink-secondary tabular-nums">
        {target
          ? `${actual} / ${target}件(${Math.round((actual / target) * 100)}%)`
          : `${actual}件 / 目標未設定`}
      </span>
      <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-secondary">
        目標
        <Input
          type="number"
          name={inputName}
          min={0}
          step={1}
          defaultValue={target ?? ""}
          className="h-9 w-16 px-2.5 text-right"
        />
        件
      </label>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = createAdminClient();
  const today = todayJST();
  const { start: monthStart, end: monthEnd } = monthBoundsJST();
  const soon = addDaysJST(14);
  const [ty, tm, td] = today.split("-").map(Number);

  const [monthInvoices, unpaid, toIssue, trials, activeContracts, monthTrials, targetRes, ownerRes] =
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
      db
        .from("deals")
        .select("service, customers(owner_name)")
        .gte("trial_start", monthStart)
        .lte("trial_start", monthEnd),
      db
        .from("trial_targets")
        .select("service, owner_name, target_count")
        .eq("month", monthStart),
      db
        .from("customers")
        .select("owner_name")
        .not("owner_name", "is", null),
    ]);

  const monthTotal = (monthInvoices.data ?? []).reduce((a, r) => a + r.total, 0);
  const unpaidRows = unpaid.data ?? [];
  const unpaidTotal = unpaidRows.reduce((a, r) => a + r.total, 0);
  const overdueRows = unpaidRows.filter(
    (r) => r.status === "overdue" || r.due_date < today,
  );
  const toIssueRows = toIssue.data ?? [];
  const trialRows = trials.data ?? [];

  // KPI: 今月のトライアル目標達成率。キーは `${担当者}|${サービス}`(全社は担当者 = '')
  const targetOf = new Map<string, number>();
  for (const r of targetRes.data ?? []) {
    targetOf.set(`${r.owner_name}|${r.service}`, r.target_count);
  }
  const actualOf = new Map<string, number>();
  const bump = (key: string) => actualOf.set(key, (actualOf.get(key) ?? 0) + 1);
  let unassignedTrials = 0;
  for (const r of monthTrials.data ?? []) {
    bump(`|${r.service}`);
    const owner = r.customers?.owner_name;
    if (owner) bump(`${owner}|${r.service}`);
    else unassignedTrials += 1;
  }
  // 担当者一覧 = 顧客に設定済みの弊社担当者 ∪ 今月の目標を持つ担当者
  const reps = [
    ...new Set(
      [
        ...(ownerRes.data ?? []).map((r) => r.owner_name),
        ...(targetRes.data ?? []).map((r) => r.owner_name),
      ].filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b, "ja"));
  const kpiActual = SERVICE_KEYS.reduce((a, s) => a + (actualOf.get(`|${s}`) ?? 0), 0);
  const kpiTarget = SERVICE_KEYS.reduce((a, s) => a + (targetOf.get(`|${s}`) ?? 0), 0);
  const kpiPct = kpiTarget > 0 ? Math.round((kpiActual / kpiTarget) * 100) : null;

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

      <Card>
        <CardHeader>
          <CardTitle>今月のトライアル目標達成率</CardTitle>
          <p className="text-xs text-ink-muted">
            {ty}年{tm}月・トライアル導入日ベース
          </p>
        </CardHeader>
        <CardBody>
          <form action={saveTrialTargets} className="space-y-6">
            <input type="hidden" name="month" value={monthStart} />
            <div className="grid items-center gap-x-10 gap-y-6 lg:grid-cols-[13rem_1fr]">
              {kpiPct !== null ? (
                <div>
                  <p className="text-5xl font-bold tracking-tight">
                    {kpiPct}
                    <span className="text-2xl font-semibold text-ink-secondary">
                      %
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    実績 {kpiActual}件 / 目標 {kpiTarget}件
                  </p>
                  <Meter value={kpiActual} max={kpiTarget} className="mt-3" />
                </div>
              ) : (
                <div>
                  <p className="text-5xl font-bold tracking-tight text-ink-muted">
                    —
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    目標が未設定です。サービスごとの目標件数を入力して保存してください。
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {SERVICE_KEYS.map((s) => (
                  <TargetRow
                    key={s}
                    service={s}
                    actual={actualOf.get(`|${s}`) ?? 0}
                    target={targetOf.get(`|${s}`)}
                    inputName={`target_${s}`}
                  />
                ))}
              </div>
            </div>

            {reps.length > 0 && (
              <div className="border-t border-line pt-5">
                <p className="text-xs font-bold text-ink-secondary">担当者別</p>
                <div className="mt-4 grid gap-x-10 gap-y-5 lg:grid-cols-2">
                  {reps.map((rep, i) => (
                    <div key={rep} className="space-y-2.5">
                      <p className="text-sm font-bold">{rep}</p>
                      <input type="hidden" name={`rep_name_${i}`} value={rep} />
                      {SERVICE_KEYS.map((s) => (
                        <TargetRow
                          key={s}
                          service={s}
                          actual={actualOf.get(`${rep}|${s}`) ?? 0}
                          target={targetOf.get(`${rep}|${s}`)}
                          inputName={`rep_${i}_${s}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {unassignedTrials > 0 && (
                  <p className="mt-4 text-xs text-ink-muted">
                    担当未設定の顧客のトライアルが今月{unassignedTrials}
                    件あります(全社の実績には含まれています)。顧客に弊社担当者を設定すると担当者別にも反映されます。
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="outline">
                目標を保存
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

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
