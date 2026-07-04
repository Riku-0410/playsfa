import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ListStateRecorder } from "@/components/list-state";
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
        <ListStateRecorder />
      </Suspense>
      {children}
    </AppShell>
  );
}
