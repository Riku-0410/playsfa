import { cn } from "@/lib/cn";

/** ドットマトリクスで進捗を表す(スクショの "13 Days" タイル相当) */
export function DotProgress({
  total,
  value,
  columns = 10,
  className,
}: {
  total: number;
  value: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${value} / ${total}`}
      className={cn("grid w-fit gap-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full",
            i < value ? "bg-accent" : "bg-line",
          )}
        />
      ))}
    </div>
  );
}
