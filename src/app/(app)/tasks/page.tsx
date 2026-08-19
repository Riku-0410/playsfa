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
import { addDaysJST, todayJST } from "@/lib/dates";
import { formatDateShort } from "@/lib/format";
import { listHref, parseListParams, searchQuery } from "@/lib/list-params";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeTask } from "./actions";

export const dynamic = "force-dynamic";

const FILTERS = {
  overdue: "期限切れ",
  today: "今日",
  week: "今週",
  nodate: "期日なし",
} as const;

const SORTS = {
  due: "next_action_date",
  customer: "customers(name)",
  created: "created_at",
};

function dueBadge(date: string | null, today: string) {
  if (!date) return <Badge variant="neutral">期日なし</Badge>;
  if (date < today) return <Badge variant="critical">期限切れ</Badge>;
  if (date === today) return <Badge variant="warn">今日</Badge>;
  return <Badge variant="neutral">{formatDateShort(date)}</Badge>;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    due?: string;
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { due, q: rawQ, ...raw } = await searchParams;
  const activeDue = due && due in FILTERS ? due : undefined;
  const q = searchQuery(rawQ);
  const { page, sortKey, orderExpr, dir, from, to } = parseListParams(raw, {
    sorts: SORTS,
    defaultSort: "due",
    defaultDir: "asc",
  });
  const today = todayJST();
  const weekEnd = addDaysJST(7);
  const db = createAdminClient();

  let query = db
    .from("activities")
    .select(
      "id, content, author_name, next_action, next_action_date, created_at, customer_id, customers!inner(id, name)",
      { count: "exact" },
    )
    .not("next_action", "is", null)
    .eq("done", false)
    .order(orderExpr, {
      ascending: dir === "asc",
      nullsFirst: sortKey === "due" ? false : undefined,
    })
    .order("id")
    .range(from, to);

  if (activeDue === "overdue") {
    query = query.lt("next_action_date", today);
  } else if (activeDue === "today") {
    query = query.eq("next_action_date", today);
  } else if (activeDue === "week") {
    query = query.gte("next_action_date", today).lte("next_action_date", weekEnd);
  } else if (activeDue === "nodate") {
    query = query.is("next_action_date", null);
  }
  if (q) query = query.ilike("customers.name", `%${q}%`);

  const { data: tasks, count } = await query;
  const total = count ?? 0;
  const keptParams = { due: activeDue, q: q ?? undefined, sort: raw.sort, dir: raw.dir };
  const sortProps = {
    basePath: "/tasks",
    params: { due: activeDue, q: q ?? undefined },
    sort: sortKey,
    dir,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="タスク" description={`${total}件`} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Link
            href={listHref("/tasks", {
              q: q ?? undefined,
              sort: raw.sort,
              dir: raw.dir,
            })}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
              !activeDue
                ? "bg-night text-night-ink"
                : "bg-surface text-ink-secondary border border-line hover:bg-sunken",
            )}
          >
            すべて
          </Link>
          {Object.entries(FILTERS).map(([k, label]) => (
            <Link
              key={k}
              href={listHref("/tasks", {
                due: k,
                q: q ?? undefined,
                sort: raw.sort,
                dir: raw.dir,
              })}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
                activeDue === k
                  ? "bg-night text-night-ink"
                  : "bg-surface text-ink-secondary border border-line hover:bg-sunken",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        <ListSearch
          basePath="/tasks"
          q={rawQ}
          placeholder="顧客名で検索…"
          params={{ due: activeDue, sort: raw.sort, dir: raw.dir }}
        />
      </div>

      <Card>
        {!tasks?.length ? (
          q ? (
            <EmptyState
              title={`「${q}」に一致するタスクがありません`}
              description="検索語を変えるか、フィルタを解除してみてください"
            />
          ) : (
            <EmptyState
              title="未完了タスクはありません"
              description="活動ログで次のアクションを記録するとここに表示されます"
            />
          )
        ) : (
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <SortableTH label="期日" sortKey="due" {...sortProps} />
                  <SortableTH label="顧客" sortKey="customer" {...sortProps} />
                  <TH>次のアクション</TH>
                  <TH>記入者</TH>
                  <TH>元ログ</TH>
                  <TH>アクション</TH>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TR key={task.id}>
                    <TD>{dueBadge(task.next_action_date, today)}</TD>
                    <TD className="font-semibold">
                      <Link
                        href={`/customers/${task.customers?.id}`}
                        className="hover:underline"
                      >
                        {task.customers?.name}
                      </Link>
                    </TD>
                    <TD className="min-w-64 font-semibold">
                      {task.next_action}
                    </TD>
                    <TD className="text-ink-secondary">
                      {task.author_name ?? "—"}
                    </TD>
                    <TD className="max-w-sm text-xs text-ink-muted">
                      <span className="line-clamp-2 whitespace-pre-wrap">
                        {task.content}
                      </span>
                    </TD>
                    <TD>
                      <form action={completeTask}>
                        <input type="hidden" name="id" value={task.id} />
                        <Button type="submit" size="sm" variant="outline">
                          完了
                        </Button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination
              basePath="/tasks"
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
