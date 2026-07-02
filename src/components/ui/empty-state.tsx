import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-sunken text-ink-muted [&>svg]:size-5">
          {icon}
        </span>
      )}
      <div>
        <p className="text-sm font-bold">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-ink-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
