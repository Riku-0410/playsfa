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
import { contractEndDate, isEndingSoon } from "@/lib/billing";
import { addDaysJST, addMonths, monthBoundsJST, todayJST } from "@/lib/dates";
import { formatJPY, formatJPYCompact } from "@/lib/format";
import { monthClock, pace, PACE_VERDICTS, type MonthClock } from "@/lib/pace";
import { INVOICE_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConfirmForm } from "@/components/confirm-form";
import { findPipelineGaps } from "@/lib/integrity";
import { currentPeriod, kpiSummary } from "@/lib/kpi";
import { createMissingInvoice, endContract } from "./contracts/actions";
import { markSent, registerPayment } from "./invoices/actions";
import { saveTrialTargets } from "./actions";

/** KPIカードの系列。チャートと同じ固定順・固定色 */
const SERVICE_KEYS = Object.keys(SERVICES) as (keyof typeof SERVICES)[];

/** 系列ドット+メーター+実績/目標+入力欄の1行。全社・担当者別で共通 */
function TargetRow({
  service,
  actual,
  planned,
  target,
  amount,
  inputName,
}: {
  service: keyof typeof SERVICES;
  actual: number;
  /** トライアル予定で予定月が対象月の商談数(見込み) */
  planned: number;
  target: number | undefined;
  /** 対象月にトライアル開始した商談の見込額合計(年・税抜) */
  amount: number;
  inputName: string;
}) {
  const meta = SERVICES[service];
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <span className="flex w-20 shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-secondary">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: meta.seriesVar }}
        />
        {meta.label}
      </span>
      <Meter
        value={actual}
        secondary={planned}
        max={target ?? 0}
        color={meta.seriesVar}
        className="min-w-10 flex-1"
      />
      <span className="w-40 shrink-0 text-right text-xs text-ink-secondary tabular-nums">
        {actual}
        {planned > 0 && <span className="text-ink-muted"> + 見込{planned}</span>}
        {target
          ? ` / ${target}件(${Math.round((actual / target) * 100)}%)`
          : "件 / 目標未設定"}
      </span>
      <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
        {amount > 0 ? formatJPYCompact(amount) : <span className="text-ink-muted">—</span>}
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

/**
 * 月間目標に対するペース。残り日数とあと何件、日割りのペースに対して何件ビハインド(先行)か。
 * 目標が未設定なら何も出さない
 */
function PaceSummary({
  clock,
  target,
  actual,
  showBadge = true,
}: {
  clock: MonthClock;
  target: number;
  /** 実績のみ。見込み(トライアル予定)は「あと○件」から差し引かない */
  actual: number;
  showBadge?: boolean;
}) {
  if (target <= 0) return null;
  const p = pace(clock, target, actual);
  const verdict = p.verdict ? PACE_VERDICTS[p.verdict] : null;
  const left = target - actual;
  return (
    <div className="space-y-1">
      {verdict && showBadge && (
        <Badge variant={verdict.badge} dot>{verdict.label}</Badge>
      )}
      {clock.current && p.verdict === "achieved" && (
        <p className="text-xs font-semibold text-good-deep">目標を達成しました</p>
      )}
      {clock.current && p.verdict !== "achieved" && (
        <div className="space-y-0.5">
          <p className="text-sm text-ink">
            残り{p.remainingDays}日で あと
            <span className="mx-0.5 text-base font-bold">{left}</span>件
          </p>
          <p
            className={
              p.lead < 0
                ? "text-sm font-semibold text-critical-deep"
                : p.lead > 0
                  ? "text-sm font-semibold text-good-deep"
                  : "text-sm font-semibold text-ink"
            }
            title={`目標${target}件を月の日数で割ると、今日までに${p.expected}件のペース`}
          >
            {p.lead < 0
              ? `ペースより${-p.lead}件ビハインド`
              : p.lead > 0
                ? `ペースより${p.lead}件先行`
                : "ペースどおり"}
          </p>
        </div>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const db = createAdminClient();
  const today = todayJST();
  // 請求・入金系のカードは常に今月。トライアル目標カードだけ ?month=yyyy-MM で過去月も見られる
  const { start: monthStart, end: monthEnd } = monthBoundsJST();
  const currentYM = monthStart.slice(0, 7);
  const { month: rawMonth } = await searchParams;
  const kpiYM =
    rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : currentYM;
  const isCurrentMonth = kpiYM === currentYM;
  // 翌月以降は目標を先に決めておくための表示(実績はまだないので達成率ではなく目標件数を出す)
  const isFutureMonth = kpiYM > currentYM;
  // 先の目標は12か月先まで
  const lastTargetYM = addMonths(currentYM, 12);
  const { start: kpiStart, end: kpiEnd } = monthBoundsJST(kpiYM);
  const [ky, km] = kpiYM.split("-").map(Number);
  const kpiMonthLabel = isCurrentMonth ? "今月" : `${ky}年${km}月`;
  const prevYM = addMonths(kpiYM, -1);
  const nextYM = addMonths(kpiYM, 1);
  const soon = addDaysJST(14);
  const [ty, tm, td] = today.split("-").map(Number);
  const { end: nextMonthEnd } = monthBoundsJST(addMonths(currentYM, 1));

  const [monthInvoices, unpaid, trials, activeContracts, monthTrials, targetRes, ownerRes, activeRows, gaps, upcoming, renewedRes, plannedRes, kpi, dueThisMonth, noTrialEndRes] =
    await Promise.all([
      db
        .from("invoices")
        .select("total, status, due_date")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .neq("status", "void"),
      db
        .from("invoices")
        .select("id, total, due_date, invoice_number, status, customers(name, owner_name)")
        .in("status", ["unsent", "sent", "overdue"])
        .lt("due_date", today)
        .order("due_date"),
      db
        .from("deals")
        .select("id, trial_end, service, customers(name, owner_name)")
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
        .select("service, amount_expected, customers(owner_name)")
        .gte("trial_start", kpiStart)
        .lte("trial_start", kpiEnd),
      db
        .from("trial_targets")
        .select("service, owner_name, target_count")
        .eq("month", kpiStart),
      db
        .from("customers")
        .select("owner_name")
        .not("owner_name", "is", null),
      // 契約終了日はDB列にないので課金中を全件引いてJSで絞る(件数は少ない)
      db
        .from("contracts")
        .select("id, service, billing_start_date, term_months, customers(name, owner_name)")
        .eq("status", "active"),
      findPipelineGaps(db),
      // 送付待ち: 未送付で期限が今日〜来月末(期限を過ぎたものは期限超過の欄に出す)
      db
        .from("invoices")
        .select("id, total, issue_date, due_date, invoice_number, customers(name, owner_name)")
        .eq("status", "unsent")
        .gte("due_date", today)
        .lte("due_date", nextMonthEnd)
        .order("due_date"),
      // 更新済み(新しい契約がある)の契約は、終了日まで課金中でも「更新か満了か」の対象外
      db
        .from("contracts")
        .select("previous_contract_id")
        .not("previous_contract_id", "is", null),
      // トライアル見込み: トライアル予定で予定月が対象月まで(過ぎたものは今月表示で「予定月を過ぎた」に出す)
      db
        .from("deals")
        .select("id, service, amount_expected, trial_planned_month, customers(name, owner_name)")
        .eq("stage", "trial_planned")
        .lte("trial_planned_month", kpiStart)
        .order("trial_planned_month"),
      kpiSummary(db, currentPeriod(today), today),
      // 今月の入金予定: 支払期限が今日〜今月末で未入金(過ぎたものは期限超過の欄)
      db
        .from("invoices")
        .select("id, total, due_date, invoice_number, status, customers(name, owner_name)")
        .in("status", ["unsent", "sent"])
        .gte("due_date", today)
        .lte("due_date", monthEnd)
        .order("due_date"),
      // トライアル中なのに終了日がない商談(終了間近に出せず、追いかけ漏れになる)
      db
        .from("deals")
        .select("id, service, trial_start, customers(name, owner_name)")
        .eq("stage", "trial")
        .is("trial_end", null)
        .order("trial_start", { ascending: false, nullsFirst: false }),
    ]);
  const { dealsWithoutContract, contractGaps } = gaps;
  const gapCount =
    dealsWithoutContract.length +
    contractGaps.reduce((a, g) => a + g.missingPeriods.length, 0);

  // 契約期間の終了が今月〜翌月、または過ぎているのに課金中 = 更新か満了かを決める対象
  const renewed = new Set((renewedRes.data ?? []).map((r) => r.previous_contract_id));
  const endingRows = (activeRows.data ?? [])
    .filter((c) => !renewed.has(c.id))
    .map((c) => ({
      ...c,
      endDate: contractEndDate(c.billing_start_date, c.term_months),
    }))
    .filter((c) => isEndingSoon(c.endDate, today))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  const monthTotal = (monthInvoices.data ?? []).reduce((a, r) => a + r.total, 0);
  // 今月の入金残 = 期限が今月でまだ入金されていない分(未送付も含む)
  const monthRemaining = (monthInvoices.data ?? [])
    .filter((r) => r.status !== "paid")
    .reduce((a, r) => a + r.total, 0);
  // うち期限を過ぎた分(期限超過の欄に出ている、今月期限の分)
  const monthRemainingOverdue = (monthInvoices.data ?? [])
    .filter((r) => r.status !== "paid" && r.due_date < today)
    .reduce((a, r) => a + r.total, 0);
  // 期限を過ぎた未入金。送付の記録がないもの(送ったが「送付済に」を押していない等)も含める
  const overdueRows = unpaid.data ?? [];
  const unpaidTotal = overdueRows.reduce((a, r) => a + r.total, 0);
  const unsentRows = upcoming.data ?? [];
  const trialRows = trials.data ?? [];
  const noTrialEndRows = noTrialEndRes.data ?? [];

  // KPI: 対象月のトライアル目標達成率。キーは `${担当者}|${サービス}`(全社は担当者 = '')
  const targetOf = new Map<string, number>();
  for (const r of targetRes.data ?? []) {
    targetOf.set(`${r.owner_name}|${r.service}`, r.target_count);
  }
  const actualOf = new Map<string, number>();
  // 同じキーで、商談の見込額(年・税抜)を積み上げる。未入力(null)は0扱い
  const amountOf = new Map<string, number>();
  const bump = (key: string, amount: number) => {
    actualOf.set(key, (actualOf.get(key) ?? 0) + 1);
    amountOf.set(key, (amountOf.get(key) ?? 0) + amount);
  };
  // ペース: 月の経過
  const clock = monthClock(kpiYM, today);
  let unassignedTrials = 0;
  let noAmountTrials = 0;
  for (const r of monthTrials.data ?? []) {
    const amount = r.amount_expected ?? 0;
    if (!r.amount_expected) noAmountTrials += 1;
    bump(`|${r.service}`, amount);
    const owner = r.customers?.owner_name;
    if (owner) bump(`${owner}|${r.service}`, amount);
    else unassignedTrials += 1;
  }
  /** 担当者(全社は '')のサービス合計。目標のあるサービスがあればそれだけで数える(目標と実績の範囲を揃える) */
  const sumOf = (m: Map<string, number>, rep: string) => {
    const withTarget = SERVICE_KEYS.filter((s) => (targetOf.get(`${rep}|${s}`) ?? 0) > 0);
    return (withTarget.length ? withTarget : SERVICE_KEYS).reduce(
      (a, s) => a + (m.get(`${rep}|${s}`) ?? 0),
      0,
    );
  };
  // 見込み: トライアル予定で予定月が対象月の商談。同じキーで数える
  const plannedRows = (plannedRes.data ?? []).filter(
    (r) => r.trial_planned_month === kpiStart,
  );
  // 予定月を過ぎてもトライアル予定のまま(今月表示のときだけ出す)
  const stalePlannedRows = isCurrentMonth
    ? (plannedRes.data ?? []).filter(
        (r) => r.trial_planned_month && r.trial_planned_month < kpiStart,
      )
    : [];
  const plannedOf = new Map<string, number>();
  for (const r of plannedRows) {
    const keys = [`|${r.service}`];
    if (r.customers?.owner_name) keys.push(`${r.customers.owner_name}|${r.service}`);
    for (const k of keys) plannedOf.set(k, (plannedOf.get(k) ?? 0) + 1);
  }
  // 目標のあるサービスだけで数える(目標と実績の範囲を揃える。未設定なら全サービス)
  const kpiPlanned = sumOf(plannedOf, "");
  // 担当者一覧 = 顧客に設定済みの弊社担当者 ∪ 対象月の目標を持つ担当者
  const reps = [
    ...new Set(
      [
        ...(ownerRes.data ?? []).map((r) => r.owner_name),
        ...(targetRes.data ?? []).map((r) => r.owner_name),
      ].filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b, "ja"));
  const kpiActual = sumOf(actualOf, "");
  const kpiTarget = SERVICE_KEYS.reduce((a, s) => a + (targetOf.get(`|${s}`) ?? 0), 0);
  const kpiPct = kpiTarget > 0 ? Math.round((kpiActual / kpiTarget) * 100) : null;
  const kpiAmount = SERVICE_KEYS.reduce((a, s) => a + (amountOf.get(`|${s}`) ?? 0), 0);

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
          <div>
            <CardTitle>
              {kpiMonthLabel}のトライアル目標{isFutureMonth ? "" : "達成率"}
            </CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              {ky}年{km}月・トライアル導入日ベース
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href={`/?month=${prevYM}`} aria-label="前の月">
              <Button variant="outline" size="sm">← 前月</Button>
            </Link>
            {!isCurrentMonth && (
              <Link href="/">
                <Button variant="outline" size="sm">今月</Button>
              </Link>
            )}
            {kpiYM >= lastTargetYM ? (
              <Button variant="outline" size="sm" disabled aria-label="次の月">翌月 →</Button>
            ) : (
              <Link href={`/?month=${nextYM}`} aria-label="次の月">
                <Button variant="outline" size="sm">翌月 →</Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <form action={saveTrialTargets} className="space-y-6">
            <input type="hidden" name="month" value={kpiStart} />
            <input type="hidden" name="return_month" value={kpiYM} />
            <div className="grid items-center gap-x-10 gap-y-6 lg:grid-cols-[13rem_1fr]">
              {isFutureMonth ? (
                <div>
                  <p
                    className={
                      kpiTarget > 0
                        ? "text-5xl font-bold tracking-tight"
                        : "text-5xl font-bold tracking-tight text-ink-muted"
                    }
                  >
                    {kpiTarget > 0 ? kpiTarget : "—"}
                    {kpiTarget > 0 && (
                      <span className="text-2xl font-semibold text-ink-secondary">件</span>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {kpiTarget > 0
                      ? `${kpiMonthLabel}の目標(全社)`
                      : "目標が未設定です。サービスごとの目標件数を入力して保存しておけます。"}
                  </p>
                  {kpiPlanned > 0 && (
                    <p className="mt-2 text-xs text-ink-secondary">
                      トライアル予定(見込み)
                      <span className="ml-1 font-bold">{kpiPlanned}件</span>
                    </p>
                  )}
                </div>
              ) : kpiPct !== null ? (
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
                  <Meter
                    value={kpiActual}
                    secondary={kpiPlanned}
                    max={kpiTarget}
                    className="mt-3"
                  />
                  {kpiPlanned > 0 && (
                    <p className="mt-2 text-xs text-ink-secondary">
                      見込み{kpiPlanned}件を含めると
                      <span className="ml-1 font-bold">
                        {Math.round(((kpiActual + kpiPlanned) / kpiTarget) * 100)}%
                      </span>
                    </p>
                  )}
                  <div className="mt-3">
                    <PaceSummary
                      clock={clock}
                      target={kpiTarget}
                      actual={kpiActual}
                    />
                  </div>
                  <p className="mt-3 text-xs text-ink-muted">{kpiMonthLabel}の積み上げ見込額</p>
                  <p className="text-xl font-bold tracking-tight">
                    {formatJPY(kpiAmount)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-5xl font-bold tracking-tight text-ink-muted">
                    —
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    目標が未設定です。サービスごとの目標件数を入力して保存してください。
                  </p>
                  <p className="mt-3 text-xs text-ink-muted">{kpiMonthLabel}の積み上げ見込額</p>
                  <p className="text-xl font-bold tracking-tight">
                    {formatJPY(kpiAmount)}
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {SERVICE_KEYS.map((s) => (
                  <TargetRow
                    key={s}
                    service={s}
                    actual={actualOf.get(`|${s}`) ?? 0}
                    planned={plannedOf.get(`|${s}`) ?? 0}
                    target={targetOf.get(`|${s}`)}
                    amount={amountOf.get(`|${s}`) ?? 0}
                    inputName={`target_${s}`}
                  />
                ))}
              </div>
            </div>

            {reps.length > 0 && (
              <div className="border-t border-line pt-5">
                <p className="text-xs font-bold text-ink-secondary">担当者別</p>
                <div className="mt-4 grid gap-x-10 gap-y-5 lg:grid-cols-2">
                  {reps.map((rep, i) => {
                    const repTarget = sumOf(targetOf, rep);
                    const repPace =
                      repTarget > 0
                        ? pace(clock, repTarget, sumOf(actualOf, rep))
                        : null;
                    const verdict = repPace?.verdict ? PACE_VERDICTS[repPace.verdict] : null;
                    return (
                    <div key={rep} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{rep}</p>
                        {verdict && (
                          <Badge variant={verdict.badge} dot>{verdict.label}</Badge>
                        )}
                        {repTarget > 0 && (
                          <span className="text-xs text-ink-muted">
                            実績{sumOf(actualOf, rep)}
                            {sumOf(plannedOf, rep) > 0 && ` + 見込${sumOf(plannedOf, rep)}`} / 目標
                            {repTarget}件
                          </span>
                        )}
                      </div>
                      <PaceSummary
                        showBadge={false}
                        clock={clock}
                        target={repTarget}
                        actual={sumOf(actualOf, rep)}
                      />
                      <input type="hidden" name={`rep_name_${i}`} value={rep} />
                      {SERVICE_KEYS.map((s) => (
                        <TargetRow
                          key={s}
                          service={s}
                          actual={actualOf.get(`${rep}|${s}`) ?? 0}
                          planned={plannedOf.get(`${rep}|${s}`) ?? 0}
                          target={targetOf.get(`${rep}|${s}`)}
                          amount={amountOf.get(`${rep}|${s}`) ?? 0}
                          inputName={`rep_${i}_${s}`}
                        />
                      ))}
                    </div>
                    );
                  })}
                </div>
                {unassignedTrials > 0 && (
                  <p className="mt-4 text-xs text-ink-muted">
                    担当未設定の顧客のトライアルが{kpiMonthLabel}{unassignedTrials}
                    件あります(全社の実績には含まれています)。顧客に弊社担当者を設定すると担当者別にも反映されます。
                  </p>
                )}
              </div>
            )}

            {noAmountTrials > 0 && (
              <p className="text-xs text-ink-muted">
                見込額は商談の「見込額(年・税抜)」の合計です。{kpiMonthLabel}のトライアル
                {noAmountTrials}件は見込額が未入力のため含まれていません。
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="outline">
                目標を保存
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Link
        href="/kpi"
        className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-card bg-surface px-6 py-3.5 text-sm shadow-card transition-colors hover:bg-sunken/60"
      >
        <span className="font-bold">{kpi.period.label}の累計</span>
        {kpi.services.map((s) => {
          const diff = kpi.toDate.actual[s] - kpi.toDate.target[s];
          return (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: SERVICES[s].seriesVar }}
              />
              {SERVICES[s].label} {kpi.toDate.actual[s]} / {kpi.toDate.target[s]}件
              <span
                className={
                  diff >= 0 ? "font-semibold text-good-deep" : "font-semibold text-critical-deep"
                }
              >
                {diff >= 0 ? `+${diff}` : diff}
              </span>
            </span>
          );
        })}
        <span className="ml-auto text-xs font-semibold text-ink-secondary">KPIを見る →</span>
      </Link>

      {(plannedRows.length > 0 || stalePlannedRows.length > 0) && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                {kpiMonthLabel}のトライアル見込み {plannedRows.length}件
              </CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                ステージが「トライアル予定」で、予定月が{kpiMonthLabel}の商談
              </p>
            </div>
            <Link href="/deals?stage=trial_planned">
              <Button variant="outline" size="sm">商談一覧で見る →</Button>
            </Link>
          </CardHeader>
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>顧客</TH>
                  <TH>担当</TH>
                  <TH>サービス</TH>
                  <TH>予定月</TH>
                  <TH numeric>見込額</TH>
                  <TH>アクション</TH>
                </tr>
              </thead>
              <tbody>
                {[...stalePlannedRows, ...plannedRows].map((r) => {
                  const stale = r.trial_planned_month! < kpiStart;
                  return (
                    <TR key={r.id}>
                      <TD className="font-semibold">
                        <Link href={`/deals/${r.id}`} className="hover:underline">
                          {r.customers?.name}
                        </Link>
                      </TD>
                      <TD className="text-ink-secondary">
                        {r.customers?.owner_name ?? "—"}
                      </TD>
                      <TD>
                        <Badge variant={SERVICES[r.service].badge} dot>
                          {SERVICES[r.service].label}
                        </Badge>
                      </TD>
                      <TD
                        className={
                          stale ? "font-semibold text-critical-deep" : "text-ink-secondary"
                        }
                      >
                        {r.trial_planned_month!.slice(0, 7)}
                        {stale && <span className="ml-1 text-xs">予定月を過ぎた</span>}
                      </TD>
                      <TD numeric>
                        {r.amount_expected ? formatJPY(r.amount_expected) : "—"}
                      </TD>
                      <TD>
                        <div className="flex gap-1.5">
                          <Link href={`/deals/${r.id}?start_trial=1#edit`}>
                            <Button size="sm" variant="outline">トライアル開始</Button>
                          </Link>
                          <Link href={`/deals/${r.id}`}>
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
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="今月の請求" value={formatJPY(monthTotal)} />
        <StatCard
          label="今月の入金残"
          value={formatJPY(monthRemaining)}
          note={
            monthRemainingOverdue > 0
              ? `うち期限超過 ${formatJPY(monthRemainingOverdue)}`
              : undefined
          }
        />
        <StatCard label="未回収(期限超過)" value={formatJPY(unpaidTotal)} />
        <StatCard label="期限超過" value={`${overdueRows.length}件`} />
        <StatCard
          label="課金中の契約"
          value={`${activeContracts.count ?? 0}件`}
        />
      </div>

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
                  <TH>担当</TH>
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
                    <TD className="text-ink-secondary">
                      {r.customers?.owner_name ?? "—"}
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

      {noTrialEndRows.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-critical-deep">
                トライアル終了日が未入力 {noTrialEndRows.length}件
              </CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                トライアル中なのに終了日がない商談(開始日が新しい順)。入れないと「トライアル終了間近」に出ません
              </p>
            </div>
            <Link href="/deals?no_trial_end=1">
              <Button variant="outline" size="sm">全{noTrialEndRows.length}件を見る →</Button>
            </Link>
          </CardHeader>
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>顧客</TH>
                  <TH>担当</TH>
                  <TH>サービス</TH>
                  <TH>トライアル開始</TH>
                  <TH>アクション</TH>
                </tr>
              </thead>
              <tbody>
                {noTrialEndRows.slice(0, 10).map((r) => (
                  <TR key={r.id}>
                    <TD className="font-semibold">
                      <Link href={`/deals/${r.id}#edit`} className="hover:underline">
                        {r.customers?.name}
                      </Link>
                    </TD>
                    <TD className="text-ink-secondary">
                      {r.customers?.owner_name ?? "—"}
                    </TD>
                    <TD>
                      <Badge variant={SERVICES[r.service].badge} dot>
                        {SERVICES[r.service].label}
                      </Badge>
                    </TD>
                    <TD className="text-ink-secondary">{r.trial_start ?? "—"}</TD>
                    <TD>
                      <Link href={`/deals/${r.id}#edit`}>
                        <Button size="sm" variant="outline">終了日を入れる</Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      {unsentRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>送付待ちの請求書(来月末までの期限) {unsentRows.length}件</CardTitle>
            <Link href="/invoices?status=to_send&sort=due">
              <Button variant="outline" size="sm">請求一覧で見る →</Button>
            </Link>
          </CardHeader>
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>顧客</TH>
                  <TH>担当</TH>
                  <TH>発行日</TH>
                  <TH>支払期限</TH>
                  <TH numeric>金額</TH>
                  <TH>アクション</TH>
                </tr>
              </thead>
              <tbody>
                {unsentRows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-semibold">{r.customers?.name}</TD>
                    <TD className="text-ink-secondary">
                      {r.customers?.owner_name ?? "—"}
                    </TD>
                    <TD className="text-ink-secondary">{r.issue_date}</TD>
                    <TD
                      className={
                        r.due_date < today
                          ? "font-semibold text-critical-deep"
                          : "text-ink-secondary"
                      }
                    >
                      {r.due_date}
                    </TD>
                    <TD numeric className="font-semibold">
                      {formatJPY(r.total)}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        <ConfirmForm
                          action={markSent}
                          message={`合計 ${formatJPY(r.total)}(税込)で送付済にします${r.invoice_number ? "" : "(請求番号が付きます)"}。仮の金額のままになっていませんか？`}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <Button size="sm" variant="dark" type="submit">
                            送付済に
                          </Button>
                        </ConfirmForm>
                        <Link href={`/invoices/${r.id}/print`}>
                          <Button size="sm" variant="ghost">表示</Button>
                        </Link>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      {gapCount > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-critical-deep">登録漏れ {gapCount}件</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                成約なのに契約がない商談と、契約期間内なのに請求書がない請求期間。売上・入金予測に入らないので早めに埋める
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-6 px-2 pt-2">
            {dealsWithoutContract.length > 0 && (
              <div>
                <p className="px-3 pb-1 text-xs font-bold text-ink-secondary">
                  成約 → 契約が未登録({dealsWithoutContract.length}件)
                </p>
                <div className="max-h-80 overflow-y-auto">
                <Table>
                  <thead>
                    <tr>
                      <TH>顧客</TH>
                      <TH>担当</TH>
                      <TH>サービス</TH>
                      <TH>成約日</TH>
                      <TH numeric>見込額</TH>
                      <TH>アクション</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {dealsWithoutContract.map((d) => (
                      <TR key={d.id}>
                        <TD className="font-semibold">
                          <Link href={`/deals/${d.id}`} className="hover:underline">
                            {d.customerName}
                          </Link>
                        </TD>
                        <TD className="text-ink-secondary">{d.ownerName ?? "—"}</TD>
                        <TD>
                          <Badge variant={SERVICES[d.service].badge} dot>
                            {SERVICES[d.service].label}
                          </Badge>
                        </TD>
                        <TD className="text-ink-secondary">{d.closed_at ?? "—"}</TD>
                        <TD numeric>
                          {d.amount_expected ? formatJPY(d.amount_expected) : "—"}
                        </TD>
                        <TD>
                          <Link href={`/contracts/new?deal=${d.id}`}>
                            <Button size="sm">契約を作成</Button>
                          </Link>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
                </div>
              </div>
            )}
            {contractGaps.length > 0 && (
              <div>
                <p className="px-3 pb-1 text-xs font-bold text-ink-secondary">
                  契約 → 請求書がない期間(
                  {contractGaps.reduce((a, g) => a + g.missingPeriods.length, 0)}件)
                </p>
                <div className="max-h-80 overflow-y-auto">
                <Table>
                  <thead>
                    <tr>
                      <TH>顧客</TH>
                      <TH>担当</TH>
                      <TH>サービス</TH>
                      <TH>請求期間の開始</TH>
                      <TH>アクション</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {contractGaps.flatMap((g) =>
                      g.missingPeriods.map((ps) => (
                        <TR key={`${g.contractId}:${ps}`}>
                          <TD className="font-semibold">
                            <Link href={`/customers/${g.customerId}`} className="hover:underline">
                              {g.customerName}
                            </Link>
                          </TD>
                          <TD className="text-ink-secondary">{g.ownerName ?? "—"}</TD>
                          <TD>
                            <Badge variant={SERVICES[g.service].badge} dot>
                              {SERVICES[g.service].label}
                            </Badge>
                          </TD>
                          <TD
                            className={
                              ps <= today
                                ? "font-semibold text-critical-deep"
                                : "text-ink-secondary"
                            }
                          >
                            {ps}
                          </TD>
                          <TD>
                            {g.hasSibling ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="warn" dot>二重登録の疑い</Badge>
                                <Link href={`/contracts/${g.contractId}/edit`}>
                                  <Button size="sm" variant="outline">契約を確認</Button>
                                </Link>
                              </div>
                            ) : (
                              <ConfirmForm
                                action={createMissingInvoice}
                                message={`${ps}開始の請求期間の請求書を作成します。よろしいですか？`}
                              >
                                <input type="hidden" name="id" value={g.contractId} />
                                <input type="hidden" name="period_start" value={ps} />
                                <Button size="sm" type="submit">請求書を作成</Button>
                              </ConfirmForm>
                            )}
                          </TD>
                        </TR>
                      )),
                    )}
                  </tbody>
                </Table>
                </div>
                {contractGaps.some((g) => g.hasSibling) && (
                  <p className="px-3 pt-2 text-xs text-ink-muted">
                    「二重登録の疑い」は同じ顧客・サービスの契約がほかにもあるもの。重複なら不要な方を契約編集から削除してください(課金中の契約数・ARRに二重に数えられています)。
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {endingRows.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>契約期間の終了が近い契約</CardTitle>
              <p className="mt-1 text-xs text-ink-muted">
                更新されたら「更新」で次期の請求書を生成、されなければ「満了にする」。放置すると入金予測に更新前提で数え続けられます
              </p>
            </div>
            <Link href="/contracts">
              <Button variant="outline" size="sm">契約一覧 →</Button>
            </Link>
          </CardHeader>
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>顧客</TH>
                  <TH>担当</TH>
                  <TH>サービス</TH>
                  <TH>契約終了</TH>
                  <TH>アクション</TH>
                </tr>
              </thead>
              <tbody>
                {endingRows.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-semibold">{c.customers?.name}</TD>
                    <TD className="text-ink-secondary">
                      {c.customers?.owner_name ?? "—"}
                    </TD>
                    <TD>
                      <Badge variant={SERVICES[c.service].badge} dot>
                        {SERVICES[c.service].label}
                      </Badge>
                    </TD>
                    <TD
                      className={
                        c.endDate < today
                          ? "font-semibold text-critical-deep"
                          : "font-semibold text-warn-deep"
                      }
                    >
                      {c.endDate}
                      {c.endDate < today && (
                        <span className="ml-1 text-xs">終了済み</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex gap-1.5">
                        <Link href={`/contracts/${c.id}/renew`}>
                          <Button size="sm">更新</Button>
                        </Link>
                        <ConfirmForm
                          action={endContract}
                          message="この契約を「満了」にします。未送付の請求書があれば無効化されます。よろしいですか？"
                        >
                          <input type="hidden" name="id" value={c.id} />
                          <Button size="sm" variant="ghost" type="submit">
                            満了にする
                          </Button>
                        </ConfirmForm>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      {overdueRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-critical-deep">
              期限超過の未入金 {overdueRows.length}件
              <span className="ml-2 text-sm font-semibold text-ink-secondary">
                {formatJPY(unpaidTotal)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>請求番号</TH>
                  <TH>顧客</TH>
                  <TH>担当</TH>
                  <TH>支払期限</TH>
                  <TH numeric>金額</TH>
                  <TH>ステータス</TH>
                  <TH>アクション</TH>
                </tr>
              </thead>
              <tbody>
                {overdueRows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-semibold">{r.invoice_number ?? "—"}</TD>
                    <TD>{r.customers?.name}</TD>
                    <TD className="text-ink-secondary">
                      {r.customers?.owner_name ?? "—"}
                    </TD>
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
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === "unsent" && (
                          <ConfirmForm
                            action={markSent}
                            message={`合計 ${formatJPY(r.total)}(税込)で送付済にします${r.invoice_number ? "" : "(請求番号が付きます)"}。`}
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <Button size="sm" variant="outline" type="submit">
                              送付済に
                            </Button>
                          </ConfirmForm>
                        )}
                        <form action={registerPayment}>
                          <input type="hidden" name="id" value={r.id} />
                          <Button size="sm" variant="outline" type="submit">
                            入金登録
                          </Button>
                        </form>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      {(dueThisMonth.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              今月の入金予定 {(dueThisMonth.data ?? []).length}件
              <span className="ml-2 text-sm font-semibold text-ink-secondary">
                {formatJPY((dueThisMonth.data ?? []).reduce((a, r) => a + r.total, 0))}
              </span>
            </CardTitle>
            <p className="text-xs text-ink-muted">支払期限が今日〜今月末で、まだ入金のない請求書</p>
          </CardHeader>
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>支払期限</TH>
                  <TH>顧客</TH>
                  <TH>担当</TH>
                  <TH>請求番号</TH>
                  <TH numeric>金額</TH>
                  <TH>ステータス</TH>
                  <TH>アクション</TH>
                </tr>
              </thead>
              <tbody>
                {(dueThisMonth.data ?? []).map((r) => (
                  <TR key={r.id}>
                    <TD className="text-ink-secondary">{r.due_date}</TD>
                    <TD className="font-semibold">{r.customers?.name}</TD>
                    <TD className="text-ink-secondary">
                      {r.customers?.owner_name ?? "—"}
                    </TD>
                    <TD>{r.invoice_number ?? "—"}</TD>
                    <TD numeric className="font-semibold">
                      {formatJPY(r.total)}
                    </TD>
                    <TD>
                      <Badge variant={INVOICE_STATUSES[r.status].badge} dot>
                        {INVOICE_STATUSES[r.status].label}
                      </Badge>
                    </TD>
                    <TD>
                      <ConfirmForm
                        action={registerPayment}
                        message={`${r.customers?.name} ${formatJPY(r.total)}(税込)の入金を今日の日付で登録します。`}
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <Button size="sm" variant="dark" type="submit">
                          入金登録
                        </Button>
                      </ConfirmForm>
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
