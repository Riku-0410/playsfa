import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-search";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SortableTH } from "@/components/ui/sortable-th";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { calcArr } from "@/lib/arr";
import { formatJPY } from "@/lib/format";
import { parseListParams, searchQuery } from "@/lib/list-params";
import { BILLING_CYCLES, CONTRACT_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SORTS = {
  customer: "customers(name)",
  cycle: "billing_cycle",
  amount: "amount_per_billing",
  agreement: "agreement_date",
  billing_start: "billing_start_date",
  status: "status",
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { q: rawQ, ...raw } = await searchParams;
  const q = searchQuery(rawQ);
  const { page, sortKey, orderExpr, dir, from, to } = parseListParams(raw, {
    sorts: SORTS,
    defaultSort: "billing_start",
  });
  const db = createAdminClient();
  let query = db
    .from("contracts")
    .select(
      "id, service, billing_cycle, amount_per_billing, agreement_date, billing_start_date, term_months, status, customers!inner(id, name)",
      { count: "exact" },
    )
    .order(orderExpr, { ascending: dir === "asc" })
    .order("id")
    .range(from, to);
  if (q) query = query.ilike("customers.name", `%${q}%`);

  // ARRは検索・ページングと独立に全契約から出す
  const arrQuery = db
    .from("contracts")
    .select(
      "service, billing_cycle, amount_per_billing, status, contract_fees(amount, recurring)",
    )
    .in("status", ["active", "pending"]);

  const [{ data: contracts, count }, { data: arrRows }] = await Promise.all([
    query,
    arrQuery,
  ]);
  const total = count ?? 0;

  const arr = calcArr((arrRows ?? []).filter((c) => c.status === "active"));
  const pendingArr = calcArr(
    (arrRows ?? []).filter((c) => c.status === "pending"),
  );

  const keptParams = { q: q ?? undefined, sort: raw.sort, dir: raw.dir };
  const sortProps = {
    basePath: "/contracts",
    params: { q: q ?? undefined },
    sort: sortKey,
    dir,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="契約"
        description={`${total}件`}
        actions={
          <Link href="/contracts/new">
            <Button>契約を登録 →</Button>
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="ARR(課金中)" value={formatJPY(arr.total)} />
        <StatCard
          label={`ARR ${SERVICES.playcut.label}`}
          value={formatJPY(arr.byService.playcut.total)}
        />
        <StatCard
          label={`ARR ${SERVICES.baskestats.label}`}
          value={formatJPY(arr.byService.baskestats.total)}
        />
      </div>
      <p className="text-xs text-ink-muted">
        課金中{arr.count}件の年換算。内訳は利用料 {formatJPY(arr.usage)} +
        毎年かかる契約費用 {formatJPY(arr.recurringFees)}(いずれも税抜、初期費用は除く)。
        {pendingArr.count > 0 &&
          ` 課金待ち${pendingArr.count}件（${formatJPY(pendingArr.total)}）は未計上。`}
      </p>
      <div className="flex justify-end">
        <ListSearch
          basePath="/contracts"
          q={rawQ}
          placeholder="顧客名で検索…"
          params={{ sort: raw.sort, dir: raw.dir }}
        />
      </div>
      <Card>
        {!contracts?.length ? (
          q ? (
            <EmptyState
              title={`「${q}」に一致する契約がありません`}
              description="検索語を変えてみてください"
            />
          ) : (
            <EmptyState
              title="契約がまだありません"
              description="契約を登録すると請求書が自動でスケジュールされます"
              action={
                <Link href="/contracts/new">
                  <Button size="sm">契約を登録 →</Button>
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
                  <SortableTH label="サイクル" sortKey="cycle" {...sortProps} />
                  <SortableTH
                    label="請求額/回(税抜)"
                    sortKey="amount"
                    numeric
                    {...sortProps}
                  />
                  <SortableTH label="合意日" sortKey="agreement" {...sortProps} />
                  <SortableTH
                    label="課金開始"
                    sortKey="billing_start"
                    {...sortProps}
                  />
                  <SortableTH label="ステータス" sortKey="status" {...sortProps} />
                  <TH />
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-semibold">
                      <Link
                        href={`/customers/${c.customers?.id}`}
                        className="hover:underline"
                      >
                        {c.customers?.name}
                      </Link>
                    </TD>
                    <TD>
                      <Badge variant={SERVICES[c.service].badge} dot>
                        {SERVICES[c.service].label}
                      </Badge>
                    </TD>
                    <TD className="text-ink-secondary">
                      {BILLING_CYCLES[c.billing_cycle]}
                    </TD>
                    <TD numeric className="font-semibold">
                      {formatJPY(c.amount_per_billing)}
                    </TD>
                    <TD className="text-ink-secondary">{c.agreement_date}</TD>
                    <TD className="text-ink-secondary">
                      {c.billing_start_date}
                    </TD>
                    <TD>
                      <Badge variant={CONTRACT_STATUSES[c.status].badge} dot>
                        {CONTRACT_STATUSES[c.status].label}
                      </Badge>
                    </TD>
                    <TD>
                      <Link href={`/contracts/${c.id}/edit`}>
                        <Button size="sm" variant="ghost">編集</Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination
              basePath="/contracts"
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
