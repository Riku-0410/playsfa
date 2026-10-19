import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFields } from "@/components/activity-fields";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { todayJST } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { CONTRACT_STATUSES, DEAL_STAGES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDeal, logDealActivity, updateDeal } from "../actions";
import { DealForm } from "../deal-form";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ log?: string; start_trial?: string }>;
}) {
  const [{ id }, { log, start_trial }] = await Promise.all([params, searchParams]);
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
  // ダッシュボードの「トライアル開始」から: ステージをトライアル中・開始日を今日にしてフォームを開く
  const startingTrial = start_trial === "1" && deal.stage !== "won";

  // この商談の契約。取込や顧客画面から作った契約は商談IDを持たないので、同じ顧客・サービスでも探す
  const { data: contractRows } = await db
    .from("contracts")
    .select("id, deal_id, status, billing_start_date")
    .eq("customer_id", deal.customer_id)
    .eq("service", deal.service)
    .order("billing_start_date", { ascending: false });
  const contract =
    (contractRows ?? []).find((c) => c.deal_id === deal.id) ??
    (contractRows ?? []).find((c) => !c.deal_id);

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

      {contract ? (
        <Card>
          <CardBody className="flex items-center justify-between gap-4 py-5">
            <p className="flex items-center gap-2 text-sm">
              <Badge variant={CONTRACT_STATUSES[contract.status].badge} dot>
                {CONTRACT_STATUSES[contract.status].label}
              </Badge>
              契約登録済み(課金開始 {formatDate(contract.billing_start_date)})
            </p>
            <Link href={`/invoices?contract=${contract.id}`} className="shrink-0">
              <Button variant="outline" size="sm">契約の請求書 →</Button>
            </Link>
          </CardBody>
        </Card>
      ) : deal.stage === "won" ? (
        <Card className="bg-critical-soft">
          <CardBody className="flex items-center justify-between gap-4 py-5">
            <p className="text-sm text-critical-deep">
              <span className="font-semibold">成約なのに契約が未登録です。</span>
              契約を登録すると請求書が自動で作られます。
            </p>
            <Link href={`/contracts/new?deal=${deal.id}`} className="shrink-0">
              <Button>契約を作成 →</Button>
            </Link>
          </CardBody>
        </Card>
      ) : deal.stage !== "lost" && (
        <Card className="bg-night text-night-ink">
          <CardBody className="flex items-center justify-between gap-4 py-5">
            <p className="text-sm">
              合意できたら契約を作成。課金開始日と請求スケジュールを確定し、商談は自動で成約になる。
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

      <Card id="edit">
        <CardHeader>
          <CardTitle>商談を編集</CardTitle>
          {startingTrial && (
            <p className="text-xs text-ink-muted">
              トライアル中にします。終了日を入れて保存してください
            </p>
          )}
        </CardHeader>
        <CardBody>
          <DealForm
            action={updateDeal}
            customers={customersRes.data ?? []}
            deal={
              startingTrial
                ? { ...deal, stage: "trial", trial_start: deal.trial_start ?? todayJST() }
                : deal
            }
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
