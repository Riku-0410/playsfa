import { cn } from "@/lib/cn";

const fieldBase = [
  "w-full rounded-field bg-sunken border border-line/70 px-4 text-sm text-ink",
  "placeholder:text-ink-muted transition-colors",
  "focus:outline-none focus:bg-surface focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
  "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-24 py-3 resize-y", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(fieldBase, "h-11 appearance-none pr-10 cursor-pointer")}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
