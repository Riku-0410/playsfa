import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-search";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SortableTH } from "@/components/ui/sortable-th";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { formatJPY } from "@/lib/format";
import { listHref, parseListParams, searchQuery } from "@/lib/list-params";
import { DEAL_STAGES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SORTS = {
  customer: "customers(name)",
  stage: "stage",
  amount: "amount_expected",
  trial_end: "trial_end",
  competitor_expiry: "competitor_expiry",
  created: "created_at",
};

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{
    stage?: string;
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { stage, q: rawQ, ...raw } = await searchParams;
  const q = searchQuery(rawQ);
  const { page, sortKey, orderExpr, dir, from, to } = parseListParams(raw, {
    sorts: SORTS,
    defaultSort: "created",
  });
  const db = createAdminClient();

  let query = db
    .from("deals")
    .select(
      "id, service, stage, title, amount_expected, trial_end, competitor, competitor_expiry, customers!inner(id, name)",
      { count: "exact" },
    )
    .order(orderExpr, { ascending: dir === "asc" })
    .order("id")
    .range(from, to);
  if (stage && stage in DEAL_STAGES) {
    query = query.eq("stage", stage as keyof typeof DEAL_STAGES);
  }
  if (q) query = query.ilike("customers.name", `%${q}%`);
  const { data: deals, count } = await query;
  const total = count ?? 0;

  const keptParams = { stage, q: q ?? undefined, sort: raw.sort, dir: raw.dir };
  const sortProps = {
    basePath: "/deals",
    params: { stage, q: q ?? undefined },
    sort: sortKey,
    dir,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="商談"
        description={`${total}件`}
        actions={
          <Link href="/deals/new">
            <Button>商談を追加 →</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Link
            href={listHref("/deals", { q: q ?? undefined, sort: raw.sort, dir: raw.dir })}
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
              href={listHref("/deals", {
                stage: k,
                q: q ?? undefined,
                sort: raw.sort,
                dir: raw.dir,
              })}
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
        <ListSearch
          basePath="/deals"
          q={rawQ}
          placeholder="顧客名で検索…"
          params={{ stage, sort: raw.sort, dir: raw.dir }}
        />
      </div>

      <Card>
        {!deals?.length ? (
          q ? (
            <EmptyState
              title={`「${q}」に一致する商談がありません`}
              description="検索語を変えるか、フィルタを解除してみてください"
            />
          ) : (
            <EmptyState
              title="商談がありません"
              description="最初の商談を追加してパイプラインを始めましょう"
              action={
                <Link href="/deals/new">
                  <Button size="sm">商談を追加 →</Button>
                </Link>
              }
            />
          )
        ) : (
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <SortableTH label="顧客" sortKey="customer" {...sortProps} />
                  <TH>サービス</TH>
                  <SortableTH label="ステージ" sortKey="stage" {...sortProps} />
                  <SortableTH
                    label="見込額(年)"
                    sortKey="amount"
                    numeric
                    {...sortProps}
                  />
                  <SortableTH
                    label="トライアル終了"
                    sortKey="trial_end"
                    {...sortProps}
                  />
                  <TH>競合</TH>
                  <SortableTH
                    label="競合期限"
                    sortKey="competitor_expiry"
                    {...sortProps}
                  />
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
            <Pagination
              basePath="/deals"
              params={keptParams}
              page={page}
              total={total}
            />
          </CardBody>
        )}
      </Card>
    </div>
  );
}
