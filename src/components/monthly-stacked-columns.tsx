"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatJPY, formatJPYCompact } from "@/lib/format";

export type MonthlyStackedDatum = {
  key: string; // "2026-07"
  /** 系列順の件数(series と同じ並び) */
  values: number[];
};

export type ChartSeries = { key: string; label: string; color: string };

const BAND = 48; // 月ごとのスロット幅
const BAR = 22; // 柱の太さ(≤24px)
const GAP = 2; // 積み上げセグメント間のsurfaceギャップ
const PAD = { top: 28, right: 8, bottom: 34, left: 36 };
const PLOT_H = 220;

function niceTicks(max: number): number[] {
  const pow = 10 ** Math.floor(Math.log10(Math.max(1, max / 4)));
  const step =
    [1, 2, 5, 10].map((m) => m * pow).find((s) => max / s <= 5) ?? pow * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

/** 月キー "2026-07" → 「7月」(1月と先頭だけ年も) */
function monthLabel(key: string, isFirst: boolean): [string, string | null] {
  const [y, m] = key.split("-");
  const month = `${Number(m)}月`;
  return [month, isFirst || m === "01" ? `${y}年` : null];
}

/**
 * 月別×系列の積み上げ縦棒チャート(ホバーで全系列のツールチップ)。
 * 値の合計は柱のキャップに直接ラベル、系列の内訳は凡例+ツールチップ+表が担う。
 */
export function MonthlyStackedColumns({
  data,
  series,
  unit = "件",
  money = false,
  title,
}: {
  data: MonthlyStackedDatum[];
  series: ChartSeries[];
  unit?: string;
  /** 金額モード: 目盛・キャップは「¥48万」概数、ツールチップは正確な円表示 */
  money?: boolean;
  /** チャート全体のaria-label(例「月別成約件数」) */
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const fmtFull = (v: number) => (money ? formatJPY(v) : `${v}${unit}`);
  const fmtShort = (v: number) => (money ? formatJPYCompact(v) : String(v));

  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const ticks = niceTicks(Math.max(1, ...totals));
  const maxTick = ticks[ticks.length - 1];
  const width = PAD.left + data.length * BAND + PAD.right;
  const height = PAD.top + PLOT_H + PAD.bottom;
  const yOf = (v: number) => PAD.top + PLOT_H - (v / maxTick) * PLOT_H;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 px-1">
        {series.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary"
          >
            <span
              className="size-2.5 rounded-[3px]"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${title}(${series.map((s) => s.label).join("・")})`}
      >
        {/* グリッド(ヘアライン)と目盛 */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={yOf(t)}
              y2={yOf(t)}
              stroke={t === 0 ? "var(--color-axis)" : "var(--color-grid)"}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={yOf(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-ink-muted text-[10px] tabular-nums"
            >
              {fmtShort(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = PAD.left + i * BAND + (BAND - BAR) / 2;
          const total = totals[i];
          const [mLabel, yLabel] = monthLabel(d.key, i === 0);
          const hovered = hover === i;

          // 下から系列順に積む。最上段だけ4px角丸(データ端)、ベースラインは直角
          let acc = 0;
          const segs = d.values.map((v, si) => {
            const y0 = yOf(acc);
            const y1 = yOf(acc + v);
            acc += v;
            return { v, si, top: y1, bottom: y0 };
          });
          const drawn = segs.filter((s) => s.v > 0);
          const topIdx = drawn.length ? drawn[drawn.length - 1].si : -1;

          return (
            <g key={d.key}>
              {hovered && (
                <rect
                  x={PAD.left + i * BAND + 2}
                  y={PAD.top}
                  width={BAND - 4}
                  height={PLOT_H}
                  rx="8"
                  fill="var(--color-sunken)"
                />
              )}
              {drawn.map((s) => {
                const gapTop = s.si === topIdx ? 0 : GAP / 2;
                const gapBottom = s.si === drawn[0].si ? 0 : GAP / 2;
                const top = s.top + gapTop;
                const h = Math.max(1, s.bottom - gapBottom - top);
                const r = s.si === topIdx ? Math.min(4, h / 2) : 0;
                return (
                  <path
                    key={s.si}
                    d={
                      r > 0
                        ? `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + BAR - r},${top} Q${x + BAR},${top} ${x + BAR},${top + r} L${x + BAR},${top + h} Z`
                        : `M${x},${top} h${BAR} v${h} h${-BAR} Z`
                    }
                    fill={series[s.si].color}
                  />
                );
              })}
              {total > 0 && (
                <text
                  x={x + BAR / 2}
                  y={yOf(total) - 7}
                  textAnchor="middle"
                  className="fill-ink text-[11px] font-semibold"
                >
                  {fmtShort(total)}
                </text>
              )}
              <text
                x={PAD.left + i * BAND + BAND / 2}
                y={PAD.top + PLOT_H + 16}
                textAnchor="middle"
                className={cn(
                  "text-[10px]",
                  hovered ? "fill-ink font-semibold" : "fill-ink-muted",
                )}
              >
                {mLabel}
              </text>
              {yLabel && (
                <text
                  x={PAD.left + i * BAND + BAND / 2}
                  y={PAD.top + PLOT_H + 29}
                  textAnchor="middle"
                  className="fill-ink-muted text-[10px]"
                >
                  {yLabel}
                </text>
              )}
              {/* ヒットターゲット(柱よりずっと広く・キーボードフォーカス可) */}
              <rect
                x={PAD.left + i * BAND}
                y={PAD.top}
                width={BAND}
                height={PLOT_H + PAD.bottom}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.key}: ${series
                  .map((s, si) => `${s.label} ${fmtFull(d.values[si])}`)
                  .join("、")}、合計 ${fmtFull(total)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-pointer focus:outline-none"
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-20 w-max -translate-x-1/2 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-pop"
          style={{
            left: `${Math.min(88, Math.max(12, ((PAD.left + hover * BAND + BAND / 2) / width) * 100))}%`,
            top: 20,
          }}
        >
          <p className="mb-1 text-[11px] font-semibold text-ink-muted">
            {data[hover].key}
          </p>
          {series.map((s, si) => (
            <p
              key={s.key}
              className="flex items-center gap-2 text-xs whitespace-nowrap"
            >
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ background: s.color }}
              />
              <strong className="tabular-nums text-ink">
                {fmtFull(data[hover].values[si])}
              </strong>
              <span className="text-ink-secondary">{s.label}</span>
            </p>
          ))}
          <p className="mt-1 border-t border-line pt-1 text-xs">
            <strong className="tabular-nums text-ink">
              {fmtFull(totals[hover])}
            </strong>{" "}
            <span className="text-ink-secondary">合計</span>
          </p>
        </div>
      )}
    </div>
  );
}
