import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TD, TH, TR } from "@/components/ui/table";
import {
  MonthlyStackedColumns,
  type MonthlyStackedDatum,
} from "@/components/monthly-stacked-columns";
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

/**
 * 成長シナリオの4系列。実請求書は入金予測と同じ色、見込みは確度順に薄く、
 * まだ存在しない新規獲得分だけ別色相(series-2)で「仮定の上乗せ」と分かるようにする
 */
const GROWTH_SERIES = [
  { key: "paid", label: "入金済み", color: "var(--color-ink-muted)" },
  { key: "invoiced", label: "請求書あり", color: "var(--color-accent)" },
  { key: "renewal", label: "既存契約の更新見込み", color: "var(--color-accent-300)" },
  { key: "new", label: "新規獲得見込み", color: "var(--color-series-2)" },
];

/** 成長シナリオの前提: 契約更新ごとの継続率と、新規獲得ペースを測る直近の月数 */
const RETENTION = 0.9;
const PACE_MONTHS = 6;

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

type BillingContract = {
  billing_cycle: string;
  amount_per_billing: number;
  billing_start_date: string;
  contract_fees: { amount: number; recurring: boolean }[] | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 契約が更新され続けた場合の請求回を発行順に出す(期限月が until を超えたら終わり)。
 * 利用料+契約年度初回の毎年費用。year は契約開始からの契約年度(0始まり)
 */
function* billingRuns(c: BillingContract, until: string) {
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
    // 支払期限 = 発行月の末日なので、期限の月 = 発行月
    const dueKey = issue.slice(0, 7);
    if (dueKey > until) return;
    const yearStart = (k * period) % 12 === 0;
    yield {
      k,
      issue,
      dueKey,
      year: Math.floor((k * period) / 12),
      subtotal: c.amount_per_billing + (yearStart ? recurringFees : 0),
    };
  }
}

const withTax = (subtotal: number, taxRate: number) =>
  subtotal + Math.floor((subtotal * taxRate) / 100);

/** "yyyy-MM" 同士の月差(b - a) */
function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export default async function ReportsPage() {
  const db = createAdminClient();
  const today = todayJST();
  const thisMonth = today.slice(0, 7);
  const paceFrom = addMonth(thisMonth, -PACE_MONTHS);
  const [trialRes, wonRes, invRes, contractRes, itemRes, newRes] = await Promise.all([
    db.from("deals").select("trial_start, service").not("trial_start", "is", null),
    db
      .from("deals")
      .select("closed_at, service")
      .eq("stage", "won")
      .not("closed_at", "is", null),
    db
      .from("invoices")
      .select("due_date, issue_date, total, status")
      .neq("status", "void"),
    // 解約0%想定の将来請求は、いま生きている契約(課金中・課金待ち)だけを伸ばす
    db
      .from("contracts")
      .select(
        "id, service, billing_cycle, amount_per_billing, tax_rate, billing_start_date, contract_fees(amount, recurring)",
      )
      .in("status", ["active", "pending"]),
    // 「契約のどの回が請求済みか」は利用料の明細行(契約ID + 期間開始)で見る。
    // まとめ請求で請求書の発行日が契約の回とずれても、行の期間で正しく突き合う
    db
      .from("invoice_items")
      .select("contract_id, period_start, invoices!inner(status)")
      .not("contract_id", "is", null)
      .not("period_start", "is", null)
      .neq("invoices.status", "void"),
    // 新規獲得ペース = 直近の完了月に締結した新規(更新でない)契約。解約・終了済みも獲得実績として数える
    db
      .from("contracts")
      .select(
        "agreement_date, billing_cycle, amount_per_billing, tax_rate, billing_start_date, contract_fees(amount, recurring)",
      )
      .is("previous_contract_id", null)
      .gte("agreement_date", `${paceFrom}-01`)
      .lt("agreement_date", `${thisMonth}-01`),
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
    arr[r.status === "unsent" ? 1 : 0] += r.total;
    billing.set(key, arr);
  }

  // 入金予測(解約0%想定) = 実請求書(入金済みも系列を分けて積む) + 全契約が更新され続ける前提の将来請求。
  // 請求書が既にある回はその金額を使い(入金済みは除外)、未生成の回だけ請求書生成と
  // 同じルール(利用料+契約年度初回の毎年費用、税切り捨て、期限=発行月の末日)で「予定」に足す
  const projEnd = addMonth(thisMonth, 12);
  const unpaid = new Map<string, number[]>();
  const addUnpaid = (key: string, si: number, v: number) => {
    const arr = unpaid.get(key) ?? UNPAID_SERIES.map(() => 0);
    arr[si] += v;
    unpaid.set(key, arr);
  };
  const invoiced = new Set(
    (itemRes.data ?? []).map((r) => `${r.contract_id}:${r.period_start}`),
  );
  for (const r of invRes.data ?? []) {
    const si =
      r.status === "paid"
        ? 0
        : r.status === "overdue" || r.due_date < today
          ? 1
          : r.status === "unsent"
            ? 3
            : 2;
    addUnpaid(r.due_date.slice(0, 7), si, r.total);
  }
  for (const c of contractRes.data ?? []) {
    for (const r of billingRuns(c, projEnd)) {
      if (invoiced.has(`${c.id}:${r.issue}`) || r.dueKey < thisMonth) continue;
      addUnpaid(r.dueKey, 3, withTax(r.subtotal, c.tax_rate));
    }
  }
  const unpaidFirst = [...unpaid.keys()].sort()[0] ?? thisMonth;
  const unpaidRange: string[] = [];
  for (let k = unpaidFirst; k <= projEnd; k = addMonth(k, 1)) unpaidRange.push(k);
  const unpaidMonths: MonthlyStackedDatum[] = unpaidRange.map((k) => ({
    key: k,
    values: unpaid.get(k) ?? UNPAID_SERIES.map(() => 0),
  }));

  // 成長シナリオ(継続率90%+新規獲得が今のペースで続く) = 今月〜再来年末の支払期限月ベース。
  // 実請求書はそのまま(締結済みなので100%)、未請求の回は今の契約年度より先の年度ぶん
  // RETENTION を掛ける。新規は直近 PACE_MONTHS ヶ月の締結契約を「毎月これの1/PACE_MONTHS が
  // 新たに締結される」型として来月以降に複製し、締結→課金開始の間隔もそのまま保つ
  const growthEnd = `${Number(thisMonth.slice(0, 4)) + 2}-12`;
  const growth = new Map<string, number[]>();
  const addGrowth = (key: string, si: number, v: number) => {
    if (key < thisMonth || key > growthEnd) return;
    const arr = growth.get(key) ?? GROWTH_SERIES.map(() => 0);
    arr[si] += v;
    growth.set(key, arr);
  };
  for (const r of invRes.data ?? []) {
    addGrowth(r.due_date.slice(0, 7), r.status === "paid" ? 0 : 1, r.total);
  }
  for (const c of contractRes.data ?? []) {
    const currentYear = Math.max(
      0,
      Math.floor(monthDiff(c.billing_start_date.slice(0, 7), thisMonth) / 12),
    );
    for (const r of billingRuns(c, growthEnd)) {
      if (invoiced.has(`${c.id}:${r.issue}`) || r.dueKey < thisMonth) continue;
      const survive = RETENTION ** Math.max(0, r.year - currentYear);
      addGrowth(r.dueKey, 2, withTax(r.subtotal, c.tax_rate) * survive);
    }
  }
  const paceContracts = newRes.data ?? [];
  for (const t of paceContracts) {
    const lag = Math.max(
      0,
      monthDiff(t.agreement_date.slice(0, 7), t.billing_start_date.slice(0, 7)),
    );
    const oneTimeFees = sum(
      (t.contract_fees ?? []).filter((f) => !f.recurring).map((f) => f.amount),
    );
    for (let signed = addMonth(thisMonth, 1); signed <= growthEnd; signed = addMonth(signed, 1)) {
      const start = `${addMonth(signed, lag)}-01`;
      for (const r of billingRuns({ ...t, billing_start_date: start }, growthEnd)) {
        const subtotal = r.subtotal + (r.k === 0 ? oneTimeFees : 0);
        addGrowth(
          r.dueKey,
          3,
          (withTax(subtotal, t.tax_rate) * RETENTION ** r.year) / PACE_MONTHS,
        );
      }
    }
  }
  const growthMonths: MonthlyStackedDatum[] = [];
  for (let k = thisMonth; k <= growthEnd; k = addMonth(k, 1)) {
    growthMonths.push({
      key: k,
      values: (growth.get(k) ?? GROWTH_SERIES.map(() => 0)).map(Math.round),
    });
  }
  const growthTotal = sum(growthMonths.map((m) => sum(m.values)));

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
            支払期限(締切日)ベース・税込。確定=送付済み〜入金済み、薄い色の予定=未送付分(売上見込)
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
            実際の請求書に加え、全契約が更新され続ける前提の将来請求(12ヶ月先まで)を支払期限月で集計・税込。グレー=入金済み、請求済み=送付済み、薄い色の予定=未送付分+更新見込み、赤=期限超過
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
          <CardTitle>成長シナリオ(継続率90%・新規は今のペース)</CardTitle>
          <p className="text-xs text-ink-muted">
            契約更新のたびに90%が継続し、新規は直近{PACE_MONTHS}ヶ月の締結ペース(月平均
            {(paceContracts.length / PACE_MONTHS).toFixed(1)}
            件)で毎月獲得し続けた場合の入金額。支払期限月で集計・税込。
            {Number(thisMonth.slice(0, 4))}年{Number(thisMonth.slice(5))}月〜
            {growthEnd.slice(0, 4)}年末の合計{" "}
            {formatJPYCompact(growthTotal)}
          </p>
        </CardHeader>
        <CardBody>
          <MonthlyStackedColumns
            title="成長シナリオ(継続率90%・新規は今のペース)"
            data={growthMonths}
            series={GROWTH_SERIES}
            money
            subtotals={[
              { label: "請求書ベース", indices: [0, 1] },
              { label: "見込み", indices: [2, 3] },
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
