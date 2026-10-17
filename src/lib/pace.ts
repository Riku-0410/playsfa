import type { BadgeVariant } from "@/components/ui/badge";

/**
 * 月間目標を週ごとの目標に割り振り、「今週あと何件か」で追う。
 * 今週の目標は、週の初めの時点の残り件数を「月末までの日数に対する今週の日数」の割合で割り振る
 * (月の最初と最後の半端な週は少なめ)。週の途中では変わらないので、何曜に見ても同じ数になる。
 * 届かなかった分は翌週の目標に上乗せされる。
 */

export type PaceVerdict = "achieved" | "on_track" | "behind" | "missed";

export const PACE_VERDICTS: Record<PaceVerdict, { label: string; badge: BadgeVariant }> = {
  achieved: { label: "達成", badge: "good" },
  on_track: { label: "順調", badge: "good" },
  behind: { label: "厳しい", badge: "critical" },
  missed: { label: "未達", badge: "critical" },
};

export type MonthClock = {
  /** 月の日数 */
  days: number;
  /** 今日が何日目か(過去の月は days、未来の月は 0) */
  day: number;
  /** 今週(月曜はじまり)のうち対象月に入る最初の日・最後の日。今月以外は null */
  week: { start: number; end: number } | null;
};

/** 対象月(YYYY-MM)と今日(YYYY-MM-DD)から、月の経過と今週の範囲を出す */
export function monthClock(ym: string, today: string): MonthClock {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const thisYm = today.slice(0, 7);
  if (ym < thisYm) return { days, day: days, week: null };
  if (ym > thisYm) return { days, day: 0, week: null };
  const d = Number(today.slice(8, 10));
  const monday = d - ((new Date(y, m - 1, d).getDay() + 6) % 7);
  return {
    days,
    day: d,
    week: { start: Math.max(1, monday), end: Math.min(days, monday + 6) },
  };
}

/** 今週の初日(YYYY-MM-DD)。今月以外は null */
export function weekStartDate(ym: string, clock: MonthClock): string | null {
  return clock.week ? `${ym}-${String(clock.week.start).padStart(2, "0")}` : null;
}

export type Pace = {
  verdict: PaceVerdict | null;
  /** 今週の目標件数 */
  weekGoal: number;
  /** 今週の目標まであと何件 */
  weekLeft: number;
  /** 先週までの平均(週あたり)。先週までが1週間に満たないときは null */
  pastWeekly: number | null;
};

/**
 * @param actual 対象月の実績
 * @param week 今週の実績(actual のうち今週の分)
 */
export function pace(
  clock: MonthClock,
  target: number,
  actual: number,
  week: number,
): Pace {
  if (!clock.week) {
    const verdict: PaceVerdict | null =
      actual >= target ? "achieved" : clock.day === clock.days ? "missed" : null;
    return { verdict, weekGoal: 0, weekLeft: 0, pastWeekly: null };
  }

  const beforeWeek = actual - week;
  const remainingAtWeekStart = Math.max(target - beforeWeek, 0);
  const daysFromWeekStart = clock.days - clock.week.start + 1;
  const weekDays = clock.week.end - clock.week.start + 1;
  const weekGoal = Math.ceil((remainingAtWeekStart * weekDays) / daysFromWeekStart);
  const weekLeft = Math.max(weekGoal - week, 0);
  const elapsedBefore = clock.week.start - 1;
  const pastWeekly = elapsedBefore >= 7 ? (beforeWeek * 7) / elapsedBefore : null;

  let verdict: PaceVerdict | null;
  if (actual >= target) verdict = "achieved";
  else if (weekLeft === 0) verdict = "on_track";
  else if (pastWeekly === null) verdict = null; // 月の最初の週で、まだ判断材料がない
  else verdict = pastWeekly >= weekGoal ? "on_track" : "behind";

  return { verdict, weekGoal, weekLeft, pastWeekly };
}
