import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { addMonths, monthBoundsJST } from "@/lib/dates";
import { SERVICES } from "@/lib/status";

type Service = keyof typeof SERVICES;

/**
 * 期ごとの通期KPI(トライアル獲得数、トライアル導入日ベース)。
 * 毎月の目標を積み上げる。ダッシュボードの月次目標(trial_targets)とは別に、期の基準として固定で持つ。
 * 次の期を始めるときはここに足す。目標のないサービスは monthly に書かない(KPIに出さない)。
 */
export const KPI_PERIODS = [
  {
    label: "2期目",
    start: "2026-07",
    months: 12,
    monthly: { playcut: 10, baskestats: 20, playcut_ipad: 5 },
  },
] satisfies { label: string; start: string; months: number; monthly: Partial<Record<Service, number>> }[];

export type KpiPeriod = (typeof KPI_PERIODS)[number];
/** その期でKPIを置いているサービス(目標のあるもの) */
export type KpiService = keyof KpiPeriod["monthly"];

/** 期のKPI対象サービス。チャートと同じ固定順 */
export function kpiServices(period: KpiPeriod): KpiService[] {
  return (Object.keys(SERVICES) as Service[]).filter(
    (s): s is KpiService => s in period.monthly,
  );
}

/** 今日を含む期(なければ直近に始まった期) */
export function currentPeriod(today: string): KpiPeriod {
  const ym = today.slice(0, 7);
  const started = KPI_PERIODS.filter((p) => p.start <= ym);
  return (
    started.find((p) => ym <= addMonths(p.start, p.months - 1)) ??
    started.at(-1) ??
    KPI_PERIODS[0]
  );
}

export type KpiMonth = {
  ym: string;
  /** 今月より後 */
  future: boolean;
  actual: Record<KpiService, number>;
  /** その月までの累計実績 */
  cumActual: Record<KpiService, number>;
  /** その月までの累計目標 */
  cumTarget: Record<KpiService, number>;
};

export type KpiSummary = {
  period: KpiPeriod;
  services: KpiService[];
  end: string;
  months: KpiMonth[];
  /** 今月(期の外なら期末)までの累計 */
  toDate: { actual: Record<KpiService, number>; target: Record<KpiService, number> };
  /** 通期目標 */
  annual: Record<KpiService, number>;
  /** 今月を含む残り月数 */
  monthsLeft: number;
};


export async function kpiSummary(
  db: SupabaseClient<Database>,
  period: KpiPeriod,
  today: string,
): Promise<KpiSummary> {
  const services = kpiServices(period);
  const zero = () =>
    Object.fromEntries(services.map((s) => [s, 0])) as Record<KpiService, number>;
  const end = addMonths(period.start, period.months - 1);
  const { data, error } = await db
    .from("deals")
    .select("service, trial_start")
    .in("service", services)
    .gte("trial_start", monthBoundsJST(period.start).start)
    .lte("trial_start", monthBoundsJST(end).end);
  if (error) throw error;

  const byMonth = new Map<string, Record<KpiService, number>>();
  for (const r of data ?? []) {
    const ym = r.trial_start!.slice(0, 7);
    const m = byMonth.get(ym) ?? zero();
    m[r.service as KpiService] += 1;
    byMonth.set(ym, m);
  }

  const thisYm = today.slice(0, 7);
  const cumActual = zero();
  const cumTarget = zero();
  const months: KpiMonth[] = [];
  const toDate = { actual: zero(), target: zero() };
  for (let k = 0; k < period.months; k++) {
    const ym = addMonths(period.start, k);
    const actual = byMonth.get(ym) ?? zero();
    for (const s of services) {
      cumActual[s] += actual[s];
      cumTarget[s] += period.monthly[s];
    }
    const future = ym > thisYm;
    if (!future) {
      toDate.actual = { ...cumActual };
      toDate.target = { ...cumTarget };
    }
    months.push({ ym, future, actual, cumActual: { ...cumActual }, cumTarget: { ...cumTarget } });
  }

  const elapsed = months.filter((m) => !m.future).length;
  return {
    period,
    services,
    end,
    months,
    toDate,
    annual: Object.fromEntries(
      services.map((s) => [s, period.monthly[s] * period.months]),
    ) as Record<KpiService, number>,
    // 今月はまだ途中なので残りに含める
    monthsLeft: Math.max(period.months - elapsed + (thisYm <= end && thisYm >= period.start ? 1 : 0), 0),
  };
}
