import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TD, TH, TR } from "@/components/ui/table";
import {
  MonthlyStackedColumns,
  type MonthlyStackedDatum,
} from "@/components/monthly-stacked-columns";
import { todayJST } from "@/lib/dates";
import { SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SERIES = (Object.keys(SERVICES) as (keyof typeof SERVICES)[]).map(
  (k) => ({ key: k, label: SERVICES[k].label, color: SERVICES[k].seriesVar }),
);

function addMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export default async function ReportsPage() {
  const db = createAdminClient();
  const { data: rows } = await db
    .from("deals")
    .select("trial_start, service")
    .not("trial_start", "is", null);

  // 月 × サービス で集計
  const byMonth = new Map<string, number[]>();
  for (const r of rows ?? []) {
    const key = r.trial_start!.slice(0, 7);
    const arr = byMonth.get(key) ?? SERIES.map(() => 0);
    arr[SERIES.findIndex((s) => s.key === r.service)] += 1;
    byMonth.set(key, arr);
  }

  const thisMonth = todayJST().slice(0, 7);
  const keys = [...byMonth.keys()].sort();
  const first = keys[0] ?? thisMonth;
  const last = keys[keys.length - 1] ?? thisMonth;
  const end = last > thisMonth ? last : thisMonth;

  const months: MonthlyStackedDatum[] = [];
  for (let k = first; k <= end; k = addMonth(k, 1)) {
    months.push({ key: k, values: byMonth.get(k) ?? SERIES.map(() => 0) });
  }

  const totalOf = (d?: MonthlyStackedDatum) =>
    d ? d.values.reduce((a, b) => a + b, 0) : 0;
  const idxThis = months.findIndex((m) => m.key === thisMonth);
  const cur = totalOf(months[idxThis]);
  const prev = totalOf(months[idxThis - 1]);
  const last12 = months
    .slice(Math.max(0, idxThis - 11), idxThis + 1)
    .reduce((a, m) => a + totalOf(m), 0);
  const total = months.reduce((a, m) => a + totalOf(m), 0);
  const trend = months
    .slice(Math.max(0, idxThis - 11), idxThis + 1)
    .map(totalOf);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="レポート"
        description="トライアル導入日ベースの月別集計"
      />

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
        <StatCard label="先月" value={`${prev}件`} />
        <StatCard label="過去12ヶ月" value={`${last12}件`} />
        <StatCard label="累計" value={`${total}件`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>月別トライアル獲得件数</CardTitle>
        </CardHeader>
        <CardBody>
          <MonthlyStackedColumns data={months} series={SERIES} />
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
                {SERIES.map((s) => (
                  <TH key={s.key} numeric>
                    {s.label}
                  </TH>
                ))}
                <TH numeric>合計</TH>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <TR key={m.key}>
                  <TD className="font-semibold">{m.key}</TD>
                  {m.values.map((v, i) => (
                    <TD key={SERIES[i].key} numeric>
                      {v}
                    </TD>
                  ))}
                  <TD numeric className="font-semibold">
                    {totalOf(m)}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
