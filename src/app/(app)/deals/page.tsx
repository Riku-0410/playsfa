import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatJPY } from "@/lib/format";
import { DEAL_STAGES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from("deals")
    .select(
      "id, service, stage, title, amount_expected, trial_end, competitor, competitor_expiry, customers(id, name)",
    )
    .order("created_at", { ascending: false });
  if (stage && stage in DEAL_STAGES) {
    query = query.eq("stage", stage as keyof typeof DEAL_STAGES);
  }
  const { data: deals } = await query;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="商談"
        description={`${deals?.length ?? 0}件`}
        actions={
          <Link href="/deals/new">
            <Button>商談を追加 →</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/deals"
          className={cn(
            "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
            !stage
              ? "bg-night text-night-ink"
              : "bg-surface text-ink-secondary border border-line hover:bg-sunken",
          )}
        >
          すべて
        </Link>
        {Object.entries(DEAL_STAGES).map(([k, v]) => (
          <Link
            key={k}
            href={`/deals?stage=${k}`}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
              stage === k
                ? "bg-night text-night-ink"
                : "bg-surface text-ink-secondary border border-line hover:bg-sunken",
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <Card>
        {!deals?.length ? (
          <EmptyState
            title="商談がありません"
            description="最初の商談を追加してパイプラインを始めましょう"
            action={
              <Link href="/deals/new">
                <Button size="sm">商談を追加 →</Button>
              </Link>
            }
          />
        ) : (
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>顧客</TH>
                  <TH>サービス</TH>
                  <TH>ステージ</TH>
                  <TH numeric>見込額(年)</TH>
                  <TH>トライアル終了</TH>
                  <TH>競合</TH>
                  <TH>競合期限</TH>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <TR key={d.id}>
                    <TD className="font-semibold">
                      <Link href={`/deals/${d.id}`} className="hover:underline">
                        {d.customers?.name}
                      </Link>
                    </TD>
                    <TD>
                      <Badge variant={SERVICES[d.service].badge} dot>
                        {SERVICES[d.service].label}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge variant={DEAL_STAGES[d.stage].badge} dot>
                        {DEAL_STAGES[d.stage].label}
                      </Badge>
                    </TD>
                    <TD numeric className="font-semibold">
                      {d.amount_expected != null
                        ? formatJPY(d.amount_expected)
                        : "—"}
                    </TD>
                    <TD className="text-ink-secondary">{d.trial_end ?? "—"}</TD>
                    <TD className="text-ink-secondary">{d.competitor ?? "—"}</TD>
                    <TD className="text-ink-secondary">
                      {d.competitor_expiry ?? "—"}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
