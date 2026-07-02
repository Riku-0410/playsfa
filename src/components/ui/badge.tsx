import { cn } from "@/lib/cn";

const variants = {
  neutral: "bg-sunken text-ink-secondary border border-line",
  accent: "bg-accent-soft text-accent-deep",
  dark: "bg-night text-night-ink",
  info: "bg-[#e4eefb] text-[#1c5cab]",
  good: "bg-good-soft text-good-deep",
  warn: "bg-warn-soft text-warn-deep",
  serious: "bg-serious-soft text-serious-deep",
  critical: "bg-critical-soft text-critical-deep",
} as const;

export type BadgeVariant = keyof typeof variants;

export function Badge({
  variant = "neutral",
  dot = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
