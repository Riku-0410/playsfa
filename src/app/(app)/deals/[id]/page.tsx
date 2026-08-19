import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFields } from "@/components/activity-fields";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { DEAL_STAGES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDeal, logDealActivity, updateDeal } from "../actions";
import { DealForm } from "../deal-form";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ log?: string }>;
}) {
  const [{ id }, { log }] = await Promise.all([params, searchParams]);
  const db = createAdminClient();
  const [dealRes, customersRes, historyRes] = await Promise.all([
    db.from("deals").select("*, customers(id, name)").eq("id", id).single(),
    db.from("customers").select("id, name").order("name"),
    db
      .from("deal_stage_history")
      .select("id, stage, previous_stage, changed_at")
      .eq("deal_id", id)
      .order("changed_at", { ascending: false }),
  ]);
  const deal = dealRes.data;
  if (!deal) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {log === "1" && (
        <Modal dismissHref={`/deals/${deal.id}`}>
          <CardHeader>
            <CardTitle>活動ログを記録</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-xs text-ink-muted">
              {deal.customers?.name ?? "この商談"}
              の商談を保存しました。いま何があったか残しておきましょう。
            </p>
            <form action={logDealActivity} className="space-y-3">
              <input type="hidden" name="customer_id" value={deal.customer_id} />
              <input type="hidden" name="deal_id" value={deal.id} />
              <ActivityFields
                actions={
                  <>
                    <Link href={`/deals/${deal.id}`} scroll={false}>
                      <Button type="button" variant="ghost">スキップ</Button>
                    </Link>
                    <Button type="submit" variant="dark">記録する</Button>
                  </>
                }
              />
            </form>
          </CardBody>
        </Modal>
      )}
      <PageHeader
        title={
          deal.customers ? (
            <Link href={`/customers/${deal.customers.id}`} className="hover:underline">
              {deal.customers.name}
            </Link>
          ) : (
            "商談"
          )
        }
        description={deal.title ?? undefined}
        actions={
          <>
            <Badge variant={SERVICES[deal.service].badge} dot>
              {SERVICES[deal.service].label}
            </Badge>
            <Badge variant={DEAL_STAGES[deal.stage].badge} dot>
              {DEAL_STAGES[deal.stage].label}
            </Badge>
          </>
        }
      />

      {deal.stage !== "lost" && (
        <Card className="bg-night text-night-ink">
          <CardBody className="flex items-center justify-between gap-4 py-5">
            <p className="text-sm">
              合意できたら契約へ。課金開始日と請求スケジュールはそこで確定する。
            </p>
            <Link
              href={`/contracts/new?deal=${deal.id}`}
              className="shrink-0"
            >
              <Button>契約を作成 →</Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>商談を編集</CardTitle>
        </CardHeader>
        <CardBody>
          <DealForm
            action={updateDeal}
            customers={customersRes.data ?? []}
            deal={deal}
            submitLabel="保存する"
          />
        </CardBody>
      </Card>

      {(historyRes.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ステージ履歴</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {(historyRes.data ?? []).map((h) => (
                <li key={h.id} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 text-xs text-ink-muted">
                    {formatDate(h.changed_at)}
                  </span>
                  {h.previous_stage && (
                    <>
                      <span className="text-ink-muted">
                        {DEAL_STAGES[h.previous_stage].label}
                      </span>
                      <span className="text-xs text-ink-muted">→</span>
                    </>
                  )}
                  <Badge variant={DEAL_STAGES[h.stage].badge} dot>
                    {DEAL_STAGES[h.stage].label}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card className="border border-critical/30">
        <CardBody className="flex items-center justify-between gap-4 py-5">
          <p className="text-xs text-ink-muted">
            商談を削除します。作成済みの契約・請求書は残ります。
          </p>
          <ConfirmForm
            action={deleteDeal}
            message="この商談を削除しますか？"
          >
            <input type="hidden" name="id" value={deal.id} />
            <Button variant="danger" size="sm" type="submit">商談を削除</Button>
          </ConfirmForm>
        </CardBody>
      </Card>
    </div>
  );
}
