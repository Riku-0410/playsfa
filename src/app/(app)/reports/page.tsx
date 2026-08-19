import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TD, TH, TR } from "@/components/ui/table";
import {
  MonthlyStackedColumns,
  type MonthlyStackedDatum,
} from "@/components/monthly-stacked-columns";
import { PAYMENT_TERM_DAYS } from "@/lib/billing";
import { todayJST } from "@/lib/dates";
import { formatJPY, formatJPYCompact } from "@/lib/format";
import { SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SERVICE_SERIES = (
  Object.keys(SERVICES) as (keyof typeof SERVICES)[]
).map((k) => ({ key: k, label: SERVICES[k].label, color: SERVICES[k].seriesVar }));

/** 請求額の確度2段階。同一色相(accent)の濃淡 = 順序尺度 */
const INVOICE_SERIES = [
  { key: "confirmed", label: "確定", color: "var(--color-accent)" },
  { key: "scheduled", label: "予定", color: "var(--color-accent-300)" },
];

/**
 * 入金予測の4系列。入金済みは無彩色(完了・非アクション)、請求済み/予定はaccent濃淡(確度)、
 * 期限超過のみステータス色。critical-deep + accent + accent-300 はCVD分離検証済み
 * (criticalはaccentと識別不能なので不可)。無彩色は色相を持たないのでCVD分離を崩さない
 */
const UNPAID_SERIES = [
  { key: "paid", label: "入金済み", color: "var(--color-ink-muted)" },
  { key: "overdue", label: "期限超過", color: "var(--color-critical-deep)" },
  { key: "billed", label: "請求済み", color: "var(--color-accent)" },
  { key: "scheduled", label: "予定", color: "var(--color-accent-300)" },
];

function addMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export default async function ReportsPage() {
  const db = createAdminClient();
  const [trialRes, wonRes, invRes, contractRes] = await Promise.all([
    db.from("deals").select("trial_start, service").not("trial_start", "is", null),
    db
      .from("deals")
      .select("closed_at, service")
      .eq("stage", "won")
      .not("closed_at", "is", null),
    db
      .from("invoices")
      .select("due_date, issue_date, total, status, contract_id")
      .neq("status", "void"),
    db
      .from("contracts")
      .select(
        "id, service, billing_cycle, amount_per_billing, tax_rate, billing_start_date, contract_fees(amount, recurring)",
      ),
  ]);

  // 月キー → 系列順の値
  const trials = new Map<string, number[]>();
  for (const r of trialRes.data ?? []) {
    const key = r.trial_start!.slice(0, 7);
    const arr = trials.get(key) ?? SERVICE_SERIES.map(() => 0);
    arr[SERVICE_SERIES.findIndex((s) => s.key === r.service)] += 1;
    trials.set(key, arr);
  }
  const won = new Map<string, number[]>();
  for (const r of wonRes.data ?? []) {
    const key = r.closed_at!.slice(0, 7);
    const arr = won.get(key) ?? SERVICE_SERIES.map(() => 0);
    arr[SERVICE_SERIES.findIndex((s) => s.key === r.service)] += 1;
    won.set(key, arr);
  }
  const billing = new Map<string, number[]>();
  for (const r of invRes.data ?? []) {
    const key = r.due_date.slice(0, 7);
    const arr = billing.get(key) ?? [0, 0];
    arr[r.status === "scheduled" ? 1 : 0] += r.total;
    billing.set(key, arr);
  }

  // 入金予測(解約0%想定) = 実請求書(入金済みも系列を分けて積む) + 全契約が更新され続ける前提の将来請求。
  // 請求書が既にある回はその金額を使い(入金済みは除外)、未生成の回だけ請求書生成と
  // 同じルール(利用料+契約年度初回の毎年費用、税切り捨て、期限=発行+30日)で「予定」に足す
  const today = todayJST();
  const thisMonth = today.slice(0, 7);
  const projEnd = addMonth(thisMonth, 12);
  const unpaid = new Map<string, number[]>();
  const addUnpaid = (key: string, si: number, v: number) => {
    const arr = unpaid.get(key) ?? UNPAID_SERIES.map(() => 0);
    arr[si] += v;
    unpaid.set(key, arr);
  };
  const invoiced = new Set<string>();
  for (const r of invRes.data ?? []) {
    if (r.contract_id) invoiced.add(`${r.contract_id}:${r.issue_date}`);
    const si =
      r.status === "paid"
        ? 0
        : r.status === "overdue" || r.due_date < today
          ? 1
          : r.status === "scheduled"
            ? 3
            : 2;
    addUnpaid(r.due_date.slice(0, 7), si, r.total);
  }
  const pad2 = (n: number) => String(n).padStart(2, "0");
  for (const c of contractRes.data ?? []) {
    const period = c.billing_cycle === "annual" ? 12 : 6;
    const recurringFees = sum(
      (c.contract_fees ?? []).filter((f) => f.recurring).map((f) => f.amount),
    );
    const [y, m, d] = c.billing_start_date.split("-").map(Number);
    for (let k = 0; ; k++) {
      // 発行日は請求書生成(date-fnsのaddMonths)と同じ月末クランプで出し、既存請求書と突き合わせる
      const anchor = new Date(y, m - 1 + k * period, 1);
      const day = Math.min(
        d,
        new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate(),
      );
      const issue = `${anchor.getFullYear()}-${pad2(anchor.getMonth() + 1)}-${pad2(day)}`;
      const due = new Date(anchor.getFullYear(), anchor.getMonth(), day + PAYMENT_TERM_DAYS);
      const dueKey = `${due.getFullYear()}-${pad2(due.getMonth() + 1)}`;
      if (dueKey > projEnd) break;
      if (invoiced.has(`${c.id}:${issue}`) || dueKey < thisMonth) continue;
      const subtotal =
        c.amount_per_billing + ((k * period) % 12 === 0 ? recurringFees : 0);
      addUnpaid(dueKey, 3, subtotal + Math.floor((subtotal * c.tax_rate) / 100));
    }
  }
  const unpaidFirst = [...unpaid.keys()].sort()[0] ?? thisMonth;
  const unpaidRange: string[] = [];
  for (let k = unpaidFirst; k <= projEnd; k = addMonth(k, 1)) unpaidRange.push(k);
  const unpaidMonths: MonthlyStackedDatum[] = unpaidRange.map((k) => ({
    key: k,
    values: unpaid.get(k) ?? UNPAID_SERIES.map(() => 0),
  }));

  // 全チャート共通の月レンジ(比較しやすいよう縦に揃える)
  const allKeys = [...trials.keys(), ...won.keys(), ...billing.keys()].sort();
  const first = allKeys[0] ?? thisMonth;
  const last = allKeys[allKeys.length - 1] ?? thisMonth;
  const end = last > thisMonth ? last : thisMonth;

  const range: string[] = [];
  for (let k = first; k <= end; k = addMonth(k, 1)) range.push(k);
  const monthsOf = (m: Map<string, number[]>, empty: number): MonthlyStackedDatum[] =>
    range.map((k) => ({ key: k, values: m.get(k) ?? Array(empty).fill(0) }));

  const trialMonths = monthsOf(trials, SERVICE_SERIES.length);
  const wonMonths = monthsOf(won, SERVICE_SERIES.length);
  const billingMonths = monthsOf(billing, 2);

  const idxThis = range.indexOf(thisMonth);
  const trialTotals = trialMonths.map((m) => sum(m.values));
  const cur = trialTotals[idxThis] ?? 0;
  const prev = trialTotals[idxThis - 1] ?? 0;
  const wonThis = sum(wonMonths[idxThis]?.values ?? []);
  const billingThis = sum(billingMonths[idxThis]?.values ?? []);
  const scheduledFuture = billingMonths
    .slice(idxThis + 1)
    .reduce((a, m) => a + m.values[1], 0);
  const trend = trialTotals.slice(Math.max(0, idxThis - 11), idxThis + 1);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader title="レポート" description="月別の獲得・成約・請求額" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="今月のトライアル獲得"
          value={`${cur}件`}
          delta={
            idxThis > 0
              ? {
                  value: `${cur - prev >= 0 ? "+" : ""}${cur - prev}件`,
                  direction: cur - prev >= 0 ? "up" : "down",
                  vs: "先月",
                }
              : undefined
          }
          trend={trend.length >= 2 ? trend : undefined}
        />
        <StatCard label="今月の成約" value={`${wonThis}件`} />
        <StatCard label="今月の請求額" value={formatJPYCompact(billingThis)} />
        <StatCard
          label="来月以降の請求予定"
          value={formatJPYCompact(scheduledFuture)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>月別トライアル獲得件数</CardTitle>
          <p className="text-xs text-ink-muted">トライアル導入日ベース</p>
        </CardHeader>
        <CardBody>
          <MonthlyStackedColumns
            title="月別トライアル獲得件数"
            data={trialMonths}
            series={SERVICE_SERIES}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>月別成約件数</CardTitle>
          <p className="text-xs text-ink-muted">
            成約日が記録されている商談のみ(Excel取込分は大半が日付なし)
          </p>
        </CardHeader>
        <CardBody>
          <MonthlyStackedColumns
            title="月別成約件数"
            data={wonMonths}
            series={SERVICE_SERIES}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>月別請求額</CardTitle>
          <p className="text-xs text-ink-muted">
            支払期限(締切日)ベース・税込。確定=発行済み〜入金済み、薄い色の予定=未発行分(売上見込)
          </p>
        </CardHeader>
        <CardBody>
          <MonthlyStackedColumns
            title="月別請求額"
            data={billingMonths}
            series={INVOICE_SERIES}
            money
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>月別入金予測(解約0%想定)</CardTitle>
          <p className="text-xs text-ink-muted">
            実際の請求書に加え、全契約が更新され続ける前提の将来請求(12ヶ月先まで)を支払期限月で集計・税込。グレー=入金済み、請求済み=発行〜送付済み、薄い色の予定=未発行分+更新見込み、赤=期限超過
          </p>
        </CardHeader>
        <CardBody>
          <MonthlyStackedColumns
            title="月別入金予測(解約0%想定)"
            data={unpaidMonths}
            series={UNPAID_SERIES}
            money
            subtotals={[
              { label: "入金済み計", indices: [0] },
              { label: "未入金計", indices: [1, 2, 3] },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>月別内訳</CardTitle>
        </CardHeader>
        <CardBody className="px-2 pt-2">
          <Table>
            <thead>
              <tr>
                <TH>月</TH>
                {SERVICE_SERIES.map((s) => (
                  <TH key={`t-${s.key}`} numeric>
                    トライアル {s.label}
                  </TH>
                ))}
                <TH numeric>トライアル計</TH>
                {SERVICE_SERIES.map((s) => (
                  <TH key={`w-${s.key}`} numeric>
                    成約 {s.label}
                  </TH>
                ))}
                <TH numeric>請求(確定)</TH>
                <TH numeric>請求(予定)</TH>
              </tr>
            </thead>
            <tbody>
              {[...range].reverse().map((k) => {
                const t = trials.get(k) ?? SERVICE_SERIES.map(() => 0);
                const w = won.get(k) ?? SERVICE_SERIES.map(() => 0);
                const b = billing.get(k) ?? [0, 0];
                return (
                  <TR key={k}>
                    <TD className="font-semibold">{k}</TD>
                    {t.map((v, i) => (
                      <TD key={`t${i}`} numeric>
                        {v}
                      </TD>
                    ))}
                    <TD numeric className="font-semibold">
                      {sum(t)}
                    </TD>
                    {w.map((v, i) => (
                      <TD key={`w${i}`} numeric>
                        {v}
                      </TD>
                    ))}
                    <TD numeric>{b[0] ? formatJPY(b[0]) : "—"}</TD>
                    <TD numeric>{b[1] ? formatJPY(b[1]) : "—"}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
