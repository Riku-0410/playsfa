"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  {
    href: "/",
    label: "ダッシュボード",
    icon: (
      <path d="M2.5 8.5 8 3l5.5 5.5M4 7.5V13h8V7.5" />
    ),
  },
  {
    href: "/customers",
    label: "顧客",
    icon: (
      <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4.5 5a4.5 4.5 0 0 1 9 0" />
    ),
  },
  {
    href: "/deals",
    label: "商談",
    icon: (
      <path d="M8 13A5 5 0 1 0 8 3a5 5 0 0 0 0 10Zm0-2.5A2.5 2.5 0 1 0 8 5.5" />
    ),
  },
  {
    href: "/contracts",
    label: "契約",
    icon: (
      <path d="M4.5 2.5h5L12 5v8.5h-7.5v-11ZM6.5 7h3M6.5 9.5h3" />
    ),
  },
  {
    href: "/invoices",
    label: "請求",
    icon: (
      <path d="M4 2.5h8v11l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1v-11ZM6 6h4M6 8.5h2.5" />
    ),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh w-full">
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col gap-6 px-4 py-7">
        <Link href="/" className="flex items-center gap-2.5 px-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-night text-sm font-extrabold text-night-ink">
            P
          </span>
          <span className="text-lg font-extrabold tracking-tight">playsfa</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors",
                  active
                    ? "bg-night text-night-ink"
                    : "text-ink-secondary hover:bg-ink/5 hover:text-ink",
                )}
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {item.icon}
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-4 text-[10px] text-ink-muted">
          playcut / baskestats SFA
        </p>
      </aside>
      <div className="min-w-0 flex-1 px-8 py-8">{children}</div>
    </div>
  );
}
