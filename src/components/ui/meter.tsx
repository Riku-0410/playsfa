import { cn } from "@/lib/cn";

/**
 * 上限に対する比率を示すメーター。
 * 未達部分のトラックは塗り色を surface に薄めた同系色(状態がバー全体で読める)。
 * 100%超は満杯で頭打ちにし、数値側で示す。
 * secondary(見込みなど確度の低い分)は塗りの先に同系色の中間の濃さで積む。
 */
export function Meter({
  value,
  max,
  secondary = 0,
  color = "var(--color-accent)",
  className,
}: {
  value: number;
  max: number;
  /** value の先に薄く積む値(例: 実績に対する見込み) */
  secondary?: number;
  /** 塗り色。系列色を渡すとサービス別メーターになる */
  color?: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const total = value + secondary;
  const totalRatio = max > 0 ? Math.min(total / max, 1) : 0;
  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full", className)}
      style={{ background: `color-mix(in srgb, ${color} 16%, var(--color-surface))` }}
    >
      {secondary > 0 && (
        <div
          className="absolute inset-y-0 left-0 min-w-2.5 rounded-full"
          style={{
            width: `${totalRatio * 100}%`,
            background: `color-mix(in srgb, ${color} 45%, var(--color-surface))`,
          }}
        />
      )}
      <div
        className={cn("relative h-full rounded-full", value > 0 && "min-w-2.5")}
        style={{ width: `${ratio * 100}%`, background: color }}
      />
    </div>
  );
}
