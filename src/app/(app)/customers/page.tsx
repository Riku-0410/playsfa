import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-search";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SortableTH } from "@/components/ui/sortable-th";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { parseListParams, searchQuery } from "@/lib/list-params";
import { GENDER_CATEGORIES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SORTS = {
  name: "name",
  org_type: "org_type",
  owner: "owner_name",
  created: "created_at",
};

export default async function CustomersPage({
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
    defaultSort: "created",
  });
  const db = createAdminClient();
  let query = db
    .from("customers")
    .select(
      "id, name, org_type, gender, owner_name, contact_name, contact_email, created_at",
      { count: "exact" },
    )
    .order(orderExpr, { ascending: dir === "asc" })
    .order("id")
    .range(from, to);
  if (q) {
    query = query.or(
      `name.ilike.%${q}%,name_kana.ilike.%${q}%,contact_name.ilike.%${q}%,owner_name.ilike.%${q}%`,
    );
  }
  const { data: customers, count } = await query;
  const total = count ?? 0;

  const keptParams = { q: q ?? undefined, sort: raw.sort, dir: raw.dir };
  const sortProps = {
    basePath: "/customers",
    params: { q: q ?? undefined },
    sort: sortKey,
    dir,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="顧客"
        description={`${total}件`}
        actions={
          <Link href="/customers/new">
            <Button>顧客を追加 →</Button>
          </Link>
        }
      />
      <div className="flex justify-end">
        <ListSearch
          basePath="/customers"
          q={rawQ}
          placeholder="名前・かな・担当者で検索…"
          params={{ sort: raw.sort, dir: raw.dir }}
        />
      </div>
      <Card>
        {!customers?.length ? (
          q ? (
            <EmptyState
              title={`「${q}」に一致する顧客がありません`}
              description="検索語を変えてみてください"
            />
          ) : (
            <EmptyState
              title="顧客がまだありません"
              description="最初の顧客を登録しましょう"
              action={
                <Link href="/customers/new">
                  <Button size="sm">顧客を追加 →</Button>
                </Link>
              }
            />
          )
        ) : (
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <SortableTH label="名前" sortKey="name" {...sortProps} />
                  <SortableTH label="種別" sortKey="org_type" {...sortProps} />
                  <TH>男女</TH>
                  <SortableTH label="弊社担当者" sortKey="owner" {...sortProps} />
                  <TH>先方担当者</TH>
                  <TH>メール</TH>
                  <SortableTH label="登録日" sortKey="created" {...sortProps} />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-semibold">
                      <Link
                        href={`/customers/${c.id}`}
                        className="flex items-center gap-2.5 hover:underline"
                      >
                        <Avatar name={c.name} size="sm" />
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="text-ink-secondary">{c.org_type ?? "—"}</TD>
                    <TD className="text-ink-secondary">
                      {c.gender ? GENDER_CATEGORIES[c.gender] : "—"}
                    </TD>
                    <TD className="text-ink-secondary">{c.owner_name ?? "—"}</TD>
                    <TD className="text-ink-secondary">{c.contact_name ?? "—"}</TD>
                    <TD className="text-ink-secondary">{c.contact_email ?? "—"}</TD>
                    <TD className="text-ink-secondary">
                      {formatDate(c.created_at)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination
              basePath="/customers"
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
