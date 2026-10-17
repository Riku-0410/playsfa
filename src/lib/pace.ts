import type { BadgeVariant } from "@/components/ui/badge";

/**
 * 月間目標に対して「このペースで達成できそうか」を出す。
 * 目安は目標を月の日数で日割りした線(今日までに何件あれば予定どおりか)。
 */

export type PaceVerdict = "achieved" | "on_track" | "depends" | "behind" | "missed";

export const PACE_VERDICTS: Record<PaceVerdict, { label: string; badge: BadgeVariant }> = {
  achieved: { label: "達成", badge: "good" },
  on_track: { label: "順調", badge: "good" },
  depends: { label: "見込み次第", badge: "warn" },
  behind: { label: "厳しい", badge: "critical" },
  missed: { label: "未達", badge: "critical" },
};

export type MonthClock = {
  /** 月の日数 */
  days: number;
  /** 今日が何日目か(過去の月は days、未来の月は 0) */
  day: number;
  /** 今週(月曜はじまり)の初日。対象月の外にはみ出す分は月初に寄せる。今月以外は null */
  weekStart: string | null;
};

/** 対象月(YYYY-MM)と今日(YYYY-MM-DD)から、月の経過を出す */
export function monthClock(ym: string, today: string): MonthClock {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const thisYm = today.slice(0, 7);
  if (ym < thisYm) return { days, day: days, weekStart: null };
  if (ym > thisYm) return { days, day: 0, weekStart: null };
  const d = Number(today.slice(8, 10));
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // 月曜=0
  const startDay = Math.max(1, d - weekday);
  return {
    days,
    day: d,
    weekStart: `${ym}-${String(startDay).padStart(2, "0")}`,
  };
}

export type Pace = {
  verdict: PaceVerdict | null;
  /** 今日までの目安件数(日割りを四捨五入。判定もこの件数で行う) */
  expected: number;
  /** 実績 − 目安 */
  lead: number;
  /** 週あたりの目安(目標 ÷ 月の週数) */
  weeklyGuide: number;
  /** 達成まであと何件 */
  remaining: number;
  /** 今日を含む残り日数 */
  remainingDays: number;
  /** 残りを達成するのに必要な週あたり件数 */
  requiredWeekly: number;
};

export function pace(
  clock: MonthClock,
  target: number,
  actual: number,
  planned: number,
): Pace {
  const expected = Math.round((target * clock.day) / clock.days);
  const remaining = Math.max(target - actual, 0);
  const remainingDays = Math.max(clock.days - clock.day + 1, 0);
  const isPast = clock.weekStart === null && clock.day === clock.days;
  const isFuture = clock.day === 0;

  let verdict: PaceVerdict | null;
  if (actual >= target) verdict = "achieved";
  else if (isPast) verdict = "missed";
  else if (isFuture) verdict = null;
  else if (actual >= expected) verdict = "on_track";
  else if (actual + planned >= expected) verdict = "depends";
  else verdict = "behind";

  return {
    verdict,
    expected,
    lead: actual - expected,
    weeklyGuide: (target * 7) / clock.days,
    remaining,
    remainingDays,
    requiredWeekly: remainingDays > 0 ? (remaining * 7) / remainingDays : remaining,
  };
}
