import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { addMonths, monthBoundsJST } from "@/lib/dates";
import { SERVICES } from "@/lib/status";

type Service = keyof typeof SERVICES;
export const KPI_SERVICES = Object.keys(SERVICES) as Service[];

/**
 * 期ごとの通期KPI(トライアル獲得数、トライアル導入日ベース)。
 * 毎月の目標を積み上げる。ダッシュボードの月次目標(trial_targets)とは別に、期の基準として固定で持つ。
 * 次の期を始めるときはここに足す。
 */
export const KPI_PERIODS = [
  {
    label: "2期目",
    start: "2026-07",
    months: 12,
    monthly: { playcut: 10, baskestats: 20 } satisfies Record<Service, number>,
  },
];

export type KpiPeriod = (typeof KPI_PERIODS)[number];

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
  actual: Record<Service, number>;
  /** その月までの累計実績 */
  cumActual: Record<Service, number>;
  /** その月までの累計目標 */
  cumTarget: Record<Service, number>;
};

export type KpiSummary = {
  period: KpiPeriod;
  end: string;
  months: KpiMonth[];
  /** 今月(期の外なら期末)までの累計 */
  toDate: { actual: Record<Service, number>; target: Record<Service, number> };
  /** 通期目標 */
  annual: Record<Service, number>;
  /** 今月を含む残り月数 */
  monthsLeft: number;
};

const zero = (): Record<Service, number> =>
  Object.fromEntries(KPI_SERVICES.map((s) => [s, 0])) as Record<Service, number>;

export async function kpiSummary(
  db: SupabaseClient<Database>,
  period: KpiPeriod,
  today: string,
): Promise<KpiSummary> {
  const end = addMonths(period.start, period.months - 1);
  const { data, error } = await db
    .from("deals")
    .select("service, trial_start")
    .gte("trial_start", monthBoundsJST(period.start).start)
    .lte("trial_start", monthBoundsJST(end).end);
  if (error) throw error;

  const byMonth = new Map<string, Record<Service, number>>();
  for (const r of data ?? []) {
    const ym = r.trial_start!.slice(0, 7);
    const m = byMonth.get(ym) ?? zero();
    m[r.service] += 1;
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
    for (const s of KPI_SERVICES) {
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
    end,
    months,
    toDate,
    annual: Object.fromEntries(
      KPI_SERVICES.map((s) => [s, period.monthly[s] * period.months]),
    ) as Record<Service, number>,
    // 今月はまだ途中なので残りに含める
    monthsLeft: Math.max(period.months - elapsed + (thisYm <= end && thisYm >= period.start ? 1 : 0), 0),
  };
}
