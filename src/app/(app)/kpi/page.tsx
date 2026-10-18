import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { MonthlyStackedColumns } from "@/components/monthly-stacked-columns";
import { cn } from "@/lib/cn";
import { todayJST } from "@/lib/dates";
import { formatCountRange } from "@/lib/format";
import { currentPeriod, KPI_SERVICES, kpiSummary } from "@/lib/kpi";
import { SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ymLabel = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`;

/** 累計の差。+は先行、−は不足 */
function Gap({ diff }: { diff: number }) {
  if (diff === 0) return <span className="text-ink-secondary">±0</span>;
  return (
    <span className={diff > 0 ? "text-good-deep" : "text-critical-deep"}>
      {diff > 0 ? `+${diff}` : diff}
    </span>
  );
}

export default async function KpiPage() {
  const db = createAdminClient();
  const today = todayJST();
  const period = currentPeriod(today);
  const kpi = await kpiSummary(db, period, today);
  const thisYm = today.slice(0, 7);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`${period.label} KPI`}
        description={`${ymLabel(period.start)}〜${ymLabel(kpi.end)}・トライアル獲得数(トライアル導入日ベース)・毎月 ${KPI_SERVICES.map((s) => `${SERVICES[s].label} ${period.monthly[s]}件`).join(" / ")}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {KPI_SERVICES.map((s) => {
          const actual = kpi.toDate.actual[s];
          const target = kpi.toDate.target[s];
          const diff = actual - target;
          const annual = kpi.annual[s];
          const left = Math.max(annual - actual, 0);
          return (
            <Card key={s}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: SERVICES[s].seriesVar }}
                  />
                  {SERVICES[s].label}
                </CardTitle>
                <Badge variant={diff >= 0 ? "good" : "critical"} dot>
                  {diff >= 0 ? `${diff}件 先行` : `${-diff}件 不足`}
                </Badge>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs text-ink-muted">今月までの累計</p>
                  <p className="text-3xl font-bold tracking-tight">
                    {actual}
                    <span className="ml-1 text-base font-semibold text-ink-secondary">
                      件 / 今月末までの目標 {target}件
                    </span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Meter value={actual} max={annual} color={SERVICES[s].seriesVar} />
                  <p className="text-xs text-ink-secondary">
                    通期 {actual} / {annual}件({Math.round((actual / annual) * 100)}%)
                    {left > 0 && kpi.monthsLeft > 0 && (
                      <>
                        ・あと{left}件 → 残り{kpi.monthsLeft}か月で
                        <span className="font-semibold text-ink">
                          月に{formatCountRange(left / kpi.monthsLeft)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>月別のトライアル獲得</CardTitle>
        </CardHeader>
        <CardBody>
          <MonthlyStackedColumns
            title="月別のトライアル獲得"
            data={kpi.months.map((m) => ({
              key: m.ym,
              values: KPI_SERVICES.map((s) => m.actual[s]),
            }))}
            series={KPI_SERVICES.map((s) => ({
              key: s,
              label: SERVICES[s].label,
              color: SERVICES[s].seriesVar,
            }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>月別の実績と累計</CardTitle>
          <p className="text-xs text-ink-muted">累計の ± は、その月までの累計目標との差</p>
        </CardHeader>
        <CardBody className="px-2 pt-2">
          <Table>
            <thead>
              <tr>
                <TH>月</TH>
                {KPI_SERVICES.map((s) => (
                  <TH key={s} numeric>
                    {SERVICES[s].label}(目標{period.monthly[s]})
                  </TH>
                ))}
                {KPI_SERVICES.map((s) => (
                  <TH key={s} numeric>
                    {SERVICES[s].label} 累計
                  </TH>
                ))}
              </tr>
            </thead>
            <tbody>
              {kpi.months.map((m) => (
                <TR key={m.ym} className={cn(m.future && "text-ink-muted")}>
                  <TD className="font-semibold">
                    {ymLabel(m.ym)}
                    {m.ym === thisYm && (
                      <span className="ml-1.5 text-xs font-normal text-ink-muted">途中</span>
                    )}
                  </TD>
                  {KPI_SERVICES.map((s) => (
                    <TD
                      key={s}
                      numeric
                      className={cn(
                        !m.future &&
                          m.ym !== thisYm &&
                          (m.actual[s] >= period.monthly[s]
                            ? "text-good-deep"
                            : "text-critical-deep"),
                      )}
                    >
                      {m.future ? "—" : `${m.actual[s]}件`}
                    </TD>
                  ))}
                  {KPI_SERVICES.map((s) => (
                    <TD key={s} numeric>
                      {m.future ? (
                        "—"
                      ) : (
                        <>
                          {m.cumActual[s]} / {m.cumTarget[s]}件{" "}
                          <span className="ml-1 font-semibold">
                            <Gap diff={m.cumActual[s] - m.cumTarget[s]} />
                          </span>
                        </>
                      )}
                    </TD>
                  ))}
                </TR>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
