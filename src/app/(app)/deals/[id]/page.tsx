import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DEAL_STAGES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDeal, updateDeal } from "../actions";
import { DealForm } from "../deal-form";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const [dealRes, customersRes] = await Promise.all([
    db.from("deals").select("*, customers(id, name)").eq("id", id).single(),
    db.from("customers").select("id, name").order("name"),
  ]);
  const deal = dealRes.data;
  if (!deal) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={deal.customers?.name ?? "商談"}
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
