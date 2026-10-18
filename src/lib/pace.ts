import type { BadgeVariant } from "@/components/ui/badge";

/**
 * 月間目標に対するペース。目標を月の日数で日割りした「今日までに何件か」と実績の差で、
 * 何件ビハインド(先行)かを出す。
 */

export type PaceVerdict = "achieved" | "on_track" | "behind" | "missed";

export const PACE_VERDICTS: Record<PaceVerdict, { label: string; badge: BadgeVariant }> = {
  achieved: { label: "達成", badge: "good" },
  on_track: { label: "順調", badge: "good" },
  behind: { label: "ビハインド", badge: "critical" },
  missed: { label: "未達", badge: "critical" },
};

export type MonthClock = {
  /** 月の日数 */
  days: number;
  /** 今日が何日目か(過去の月は days、未来の月は 0) */
  day: number;
  /** 対象月が今月か */
  current: boolean;
};

/** 対象月(YYYY-MM)と今日(YYYY-MM-DD)から、月の経過を出す */
export function monthClock(ym: string, today: string): MonthClock {
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const thisYm = today.slice(0, 7);
  if (ym < thisYm) return { days, day: days, current: false };
  if (ym > thisYm) return { days, day: 0, current: false };
  return { days, day: Number(today.slice(8, 10)), current: true };
}

export type Pace = {
  verdict: PaceVerdict | null;
  /** 今日までのペース(目標の日割り、四捨五入) */
  expected: number;
  /** 実績 − ペース。マイナスがビハインド */
  lead: number;
  /** 今日を含む残り日数 */
  remainingDays: number;
};

export function pace(clock: MonthClock, target: number, actual: number): Pace {
  const expected = Math.round((target * clock.day) / clock.days);
  const lead = actual - expected;
  let verdict: PaceVerdict | null;
  if (actual >= target) verdict = "achieved";
  else if (!clock.current) verdict = clock.day === clock.days ? "missed" : null;
  else verdict = lead >= 0 ? "on_track" : "behind";
  return {
    verdict,
    expected,
    lead,
    remainingDays: clock.current ? clock.days - clock.day + 1 : 0,
  };
}
