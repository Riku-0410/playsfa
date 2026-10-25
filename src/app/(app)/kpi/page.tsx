import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { MonthlyStackedColumns } from "@/components/monthly-stacked-columns";
import { cn } from "@/lib/cn";
import { todayJST } from "@/lib/dates";
import { formatCountRange, formatJPY, formatJPYCompact } from "@/lib/format";
import { currentPeriod, kpiSummary } from "@/lib/kpi";
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

/** 金額の累計の差。+は先行、−は不足 */
function MoneyGap({ diff }: { diff: number }) {
  if (diff === 0) return <span className="text-ink-secondary">±0</span>;
  return (
    <span className={diff > 0 ? "text-good-deep" : "text-critical-deep"}>
      {diff > 0 ? "+" : "−"}
      {formatJPYCompact(Math.abs(diff))}
    </span>
  );
}

export default async function KpiPage() {
  const db = createAdminClient();
  const today = todayJST();
  const period = currentPeriod(today);
  const kpi = await kpiSummary(db, period, today);
  const thisYm = today.slice(0, 7);
  const amountDiff = kpi.toDate.amount - kpi.toDate.amountTarget;
  const amountLeft = Math.max(period.amountTarget - kpi.toDate.amount, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={`${period.label} KPI`}
        description={`${ymLabel(period.start)}〜${ymLabel(kpi.end)}・トライアル獲得数(トライアル導入日ベース)・毎月 ${kpi.services.map((s) => `${SERVICES[s].label} ${period.monthly[s]}件`).join(" / ")}・積み上げ金額 通期${formatJPYCompact(period.amountTarget)}`}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>積み上げ金額</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              期内にトライアルを始めた商談の金額(初年度の年額・税抜)。契約済みは契約の金額、未契約は商談の見込額
            </p>
          </div>
          <Badge variant={amountDiff >= 0 ? "good" : "critical"} dot>
            {amountDiff >= 0
              ? `${formatJPYCompact(amountDiff)} 先行`
              : `${formatJPYCompact(-amountDiff)} 不足`}
          </Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="text-xs text-ink-muted">今月までの累計</p>
            <p className="text-3xl font-bold tracking-tight">
              {formatJPY(kpi.toDate.amount)}
              <span className="ml-1 text-base font-semibold text-ink-secondary">
                / 今月末までの目標 {formatJPY(kpi.toDate.amountTarget)}
              </span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Meter value={kpi.toDate.amount} max={period.amountTarget} />
            <p className="text-xs text-ink-secondary">
              通期 {formatJPYCompact(kpi.toDate.amount)} /{" "}
              {formatJPYCompact(period.amountTarget)}(
              {Math.round((kpi.toDate.amount / period.amountTarget) * 100)}%)
              {amountLeft > 0 && kpi.monthsLeft > 0 && (
                <>
                  ・あと{formatJPYCompact(amountLeft)} → 残り{kpi.monthsLeft}か月で
                  <span className="font-semibold text-ink">
                    月に{formatJPYCompact(amountLeft / kpi.monthsLeft)}
                  </span>
                </>
              )}
            </p>
            {kpi.noAmountTrials > 0 && (
              <p className="text-xs text-ink-muted">
                契約も見込額もないトライアルが{kpi.noAmountTrials}件あり、金額に含まれていません。
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {kpi.services.map((s) => {
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
              values: kpi.services.map((s) => m.actual[s]),
            }))}
            series={kpi.services.map((s) => ({
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
                {kpi.services.map((s) => (
                  <TH key={s} numeric>
                    {SERVICES[s].label}(目標{period.monthly[s]})
                  </TH>
                ))}
                {kpi.services.map((s) => (
                  <TH key={s} numeric>
                    {SERVICES[s].label} 累計
                  </TH>
                ))}
                <TH numeric>金額</TH>
                <TH numeric>金額 累計</TH>
              </tr>
            </thead>
            <tbody>
              {kpi.months.map((m) => (
                <TR key={m.ym} className={cn(m.future && "text-ink-muted")}>
                  <TD className="font-semibold whitespace-nowrap">
                    {ymLabel(m.ym)}
                    {m.ym === thisYm && (
                      <span className="ml-1.5 text-xs font-normal text-ink-muted">途中</span>
                    )}
                  </TD>
                  {kpi.services.map((s) => (
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
                  {kpi.services.map((s) => (
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
                  <TD numeric className="whitespace-nowrap">
                    {m.future ? "—" : formatJPYCompact(m.amount)}
                  </TD>
                  <TD numeric className="whitespace-nowrap">
                    {m.future ? (
                      "—"
                    ) : (
                      <>
                        {formatJPYCompact(m.cumAmount)} / {formatJPYCompact(m.cumAmountTarget)}{" "}
                        <span className="ml-1 font-semibold">
                          <MoneyGap diff={m.cumAmount - m.cumAmountTarget} />
                        </span>
                      </>
                    )}
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
