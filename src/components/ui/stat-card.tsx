import { cn } from "@/lib/cn";
import { Card } from "./card";

type Delta = {
  /** 符号付きで表示する値。例 "+12%" "-¥80,000" */
  value: string;
  direction: "up" | "down";
  /** 上向きが良い指標か(未入金などは false)。色 = 方向 × これ */
  upIsGood?: boolean;
  /** 比較対象の期間名。例 "先月" */
  vs?: string;
};

/** 12点スパークライン。全体はディエンファシス色、直近区間のみアクセント */
function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 32;
  const pad = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    pad + (i * (w - pad * 2)) / (values.length - 1),
    h - pad - ((v - min) / span) * (h - pad * 2),
  ]);
  const line = (p: number[][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-24 shrink-0"
      aria-hidden
    >
      <polyline
        points={line(pts)}
        fill="none"
        stroke="var(--color-deemphasis)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={line(pts.slice(-2))}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="4"
        fill="var(--color-accent)"
        stroke="var(--color-surface)"
        strokeWidth="2"
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  delta,
  trend,
  icon,
  className,
}: {
  label: string;
  value: string;
  delta?: Delta;
  /** 12点程度の推移。渡すとスパークラインを表示 */
  trend?: number[];
  icon?: React.ReactNode;
  className?: string;
}) {
  const good = delta ? (delta.direction === "up") === (delta.upIsGood ?? true) : true;
  return (
    <Card className={cn("px-6 py-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-ink-muted">{label}</p>
        {icon && (
          <span className="flex size-9 items-center justify-center rounded-full bg-sunken text-ink-secondary [&>svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[1.75rem] leading-none font-bold tracking-tight">
          {value}
        </p>
        {trend && trend.length >= 2 && <Sparkline values={trend} />}
      </div>
      {delta && (
        <p className="mt-2.5 flex items-baseline gap-1.5 text-xs">
          <span
            className={cn(
              "font-bold",
              good ? "text-delta-good" : "text-critical",
            )}
          >
            {delta.direction === "up" ? "↑" : "↓"} {delta.value}
          </span>
          {delta.vs && <span className="text-ink-muted">vs {delta.vs}</span>}
        </p>
      )}
    </Card>
  );
}
