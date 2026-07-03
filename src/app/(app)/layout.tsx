import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ScrollRestorer } from "@/components/scroll-restorer";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ScrollRestorer />
      </Suspense>
      {children}
    </AppShell>
  );
}
