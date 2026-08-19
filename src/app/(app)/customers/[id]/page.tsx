import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFields } from "@/components/activity-fields";
import { ConfirmForm } from "@/components/confirm-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardInset, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ACTIVITY_TYPES } from "@/lib/activity";
import { formatDate, formatJPY } from "@/lib/format";
import {
  BILLING_CYCLES,
  CONTRACT_STATUSES,
  DEAL_STAGES,
  GENDER_CATEGORIES,
  SERVICES,
} from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { addActivity, deleteActivity } from "../actions";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const [customerRes, dealsRes, contractsRes, activitiesRes] =
    await Promise.all([
      db.from("customers").select("*").eq("id", id).single(),
      db
        .from("deals")
        .select("id, service, stage, title, amount_expected, competitor, competitor_expiry")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("contracts")
        .select("id, service, billing_cycle, amount_per_billing, agreement_date, billing_start_date, status")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("activities")
        .select("*")
        .eq("customer_id", id)
        .order("occurred_at", { ascending: false })
        .limit(30),
    ]);

  const customer = customerRes.data;
  if (!customer) notFound();
  const deals = dealsRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const activities = activitiesRes.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={customer.name}
        description={[
          customer.org_type,
          customer.gender && GENDER_CATEGORIES[customer.gender],
          customer.owner_name && `担当: ${customer.owner_name}`,
        ]
          .filter(Boolean)
          .join(" / ")}
        actions={
          <>
            <Link href={`/customers/${customer.id}/edit`}>
              <Button variant="ghost">編集</Button>
            </Link>
            <Link href={`/deals/new?customer=${customer.id}`}>
              <Button variant="outline">商談を追加</Button>
            </Link>
            <Link href={`/contracts/new?customer=${customer.id}`}>
              <Button>契約を登録 →</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Avatar name={customer.name} size="lg" />
              <div>
                <p className="font-bold">{customer.name}</p>
                <p className="text-xs text-ink-muted">
                  {customer.name_kana ?? ""}
                </p>
              </div>
            </div>
            <dl className="space-y-2 pt-2">
              {[
                ["男女", customer.gender && GENDER_CATEGORIES[customer.gender]],
                ["弊社担当者", customer.owner_name],
                ["先方担当者", customer.contact_name],
                ["メール", customer.contact_email],
                ["電話", customer.contact_phone],
                ["請求先", customer.billing_name],
                ["請求先メール", customer.billing_email],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-xs font-semibold text-ink-muted">
                    {k}
                  </dt>
                  <dd className="truncate text-right">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {customer.note && (
              <CardInset className="p-3 text-xs text-ink-secondary">
                {customer.note}
              </CardInset>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>商談</CardTitle>
            </CardHeader>
            {deals.length === 0 ? (
              <EmptyState title="商談はまだありません" />
            ) : (
              <CardBody className="space-y-2 pt-4">
                {deals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="flex items-center justify-between gap-3 rounded-inner border border-line/60 px-4 py-3 transition-colors hover:bg-sunken"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Badge variant={SERVICES[d.service].badge} dot>
                        {SERVICES[d.service].label}
                      </Badge>
                      <span className="truncate text-sm font-semibold">
                        {d.title ?? "(無題)"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {d.amount_expected != null && (
                        <span className="text-sm font-semibold tabular-nums">
                          {formatJPY(d.amount_expected)}
                        </span>
                      )}
                      <Badge variant={DEAL_STAGES[d.stage].badge} dot>
                        {DEAL_STAGES[d.stage].label}
                      </Badge>
                    </span>
                  </Link>
                ))}
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>契約</CardTitle>
            </CardHeader>
            {contracts.length === 0 ? (
              <EmptyState title="契約はまだありません" />
            ) : (
              <CardBody className="space-y-2 pt-4">
                {contracts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-inner border border-line/60 px-4 py-3"
                  >
                    <span className="flex items-center gap-2.5">
                      <Badge variant={SERVICES[c.service].badge} dot>
                        {SERVICES[c.service].label}
                      </Badge>
                      <span className="text-sm">
                        {BILLING_CYCLES[c.billing_cycle]}
                        <span className="mx-1 font-semibold tabular-nums">
                          {formatJPY(c.amount_per_billing)}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-ink-muted">
                      課金開始 {c.billing_start_date}
                      <Badge variant={CONTRACT_STATUSES[c.status].badge} dot>
                        {CONTRACT_STATUSES[c.status].label}
                      </Badge>
                    </span>
                  </div>
                ))}
              </CardBody>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>活動ログ</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <form action={addActivity} className="space-y-3">
            <input type="hidden" name="customer_id" value={customer.id} />
            <ActivityFields
              actions={<Button type="submit" variant="dark">記録する</Button>}
            />
          </form>

          {activities.length === 0 ? (
            <EmptyState title="活動ログはまだありません" />
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="group flex gap-3">
                  <Badge className="mt-0.5 shrink-0" variant="neutral">
                    {ACTIVITY_TYPES[a.type] ?? a.type}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm whitespace-pre-wrap">{a.content}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {formatDate(a.occurred_at)}
                      {a.author_name && ` ・記入: ${a.author_name}`}
                      {a.next_action && (
                        <>
                          {" ・次: "}
                          <span className="font-semibold text-ink-secondary">
                            {a.next_action}
                            {a.next_action_date && ` (${a.next_action_date})`}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <ConfirmForm
                    action={deleteActivity}
                    message="この活動ログを削除しますか？"
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="customer_id" value={customer.id} />
                    <Button variant="ghost" size="sm" type="submit">削除</Button>
                  </ConfirmForm>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
