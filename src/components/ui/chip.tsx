import { cn } from "@/lib/cn";

/** フィルタ用チップ。selected で反転 */
export function Chip({
  selected = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected
          ? "bg-night text-night-ink"
          : "bg-surface text-ink-secondary border border-line hover:bg-sunken",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
