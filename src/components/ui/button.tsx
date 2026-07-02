import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-accent text-white hover:bg-accent-deep",
  dark: "bg-night text-night-ink hover:bg-black",
  outline: "bg-surface text-ink border border-line hover:bg-sunken",
  ghost: "text-ink-secondary hover:bg-ink/5 hover:text-ink",
  danger: "bg-critical text-white hover:bg-critical-deep",
} as const;

const sizes = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-13 px-7 text-base",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  variant = "outline",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        size === "sm" ? "size-9" : size === "lg" ? "size-13" : "size-11",
        className,
      )}
      {...props}
    />
  );
}
