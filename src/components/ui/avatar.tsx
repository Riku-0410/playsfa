import { cn } from "@/lib/cn";

const palettes = [
  "bg-accent-100 text-accent-deep",
  "bg-[#e4eefb] text-[#1c5cab]",
  "bg-good-soft text-good-deep",
  "bg-warn-soft text-warn-deep",
  "bg-night text-night-ink",
];

/** 名前のイニシャルを表示。色は名前から決定的に選ぶ */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hash = [...name].reduce((a, c) => a + c.codePointAt(0)!, 0);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-12 text-base",
        palettes[hash % palettes.length],
        className,
      )}
      title={name}
    >
      {name.slice(0, 2)}
    </span>
  );
}
