import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { SaveForm } from "@/components/save-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardInset, CardTitle } from "@/components/ui/card";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { contractEndDate } from "@/lib/billing";
import { formatJPY } from "@/lib/format";
import { BILLING_CYCLES, CONTRACT_STATUSES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteContract, updateContract } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: contract } = await db
    .from("contracts")
    .select("*, customers(name)")
    .eq("id", id)
    .single();
  if (!contract) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`${contract.customers?.name} の契約を編集`}
        actions={
          <>
            <Badge variant={SERVICES[contract.service].badge} dot>
              {SERVICES[contract.service].label}
            </Badge>
            {["active", "ended"].includes(contract.status) && (
              <Link href={`/contracts/${contract.id}/renew`}>
                <Button variant="outline">契約を更新 →</Button>
              </Link>
            )}
          </>
        }
      />

      <CardInset className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
        <span>{BILLING_CYCLES[contract.billing_cycle]}</span>
        <span className="font-semibold">
          {formatJPY(contract.amount_per_billing)}/回(税抜)
        </span>
        <span>
          契約期間 {contract.billing_start_date} 〜{" "}
          {contractEndDate(contract.billing_start_date, contract.term_months)}
        </span>
        <span className="text-xs text-ink-muted">
          金額・サイクル・課金開始は請求書が生成済みのため変更不可。
          更新時の条件変更は「契約を更新」から。期の途中の調整は各請求書の編集で、作り直しは削除→再登録で。
        </span>
      </CardInset>

      <Card>
        <CardHeader>
          <CardTitle>契約情報</CardTitle>
        </CardHeader>
        <CardBody>
          <SaveForm action={updateContract} fallback="/contracts" className="space-y-4">
            <input type="hidden" name="id" value={contract.id} />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="ce-plan">プラン名</Label>
                <Input
                  id="ce-plan"
                  name="plan_name"
                  defaultValue={contract.plan_name ?? ""}
                />
              </Field>
              <Field>
                <Label htmlFor="ce-agreement">契約合意日</Label>
                <Input
                  id="ce-agreement"
                  name="agreement_date"
                  type="date"
                  required
                  defaultValue={contract.agreement_date}
                />
              </Field>
            </div>
            <Field>
              <Label htmlFor="ce-status">ステータス</Label>
              <Select
                id="ce-status"
                name="status"
                defaultValue={contract.status}
              >
                {Object.entries(CONTRACT_STATUSES)
                  // 「解約」は画面からは選ばない(終了は「満了」に一本化)。過去データが解約なら表示だけ残す
                  .filter(([k]) => k !== "churned" || contract.status === "churned")
                  .map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
              </Select>
              <FieldHint>更新されなかった契約は「満了」に。期の途中で終わった場合も同じです。未発行の請求は自動で止まります(この契約だけの請求書は無効化、他サービスと1枚にまとめた請求書はこの契約の行だけ外れます)</FieldHint>
            </Field>
            <Field>
              <Label htmlFor="ce-note">メモ</Label>
              <Textarea
                id="ce-note"
                name="note"
                defaultValue={contract.note ?? ""}
              />
            </Field>
            <div className="flex justify-end pt-2">
              <Button type="submit">保存する</Button>
            </div>
          </SaveForm>
        </CardBody>
      </Card>

      <Card className="border border-critical/30">
        <CardBody className="flex items-center justify-between gap-4 py-5">
          <p className="text-xs text-ink-muted">
            契約を削除すると、この契約の請求書も消えます(他サービスと1枚にまとめた請求書はこの契約の行だけ外れます)。
            入金済みの請求書がある場合は削除できません。
          </p>
          <div className="flex shrink-0 gap-2">
            <Link href={`/invoices?contract=${contract.id}`}>
              <Button variant="outline" size="sm">請求書を見る</Button>
            </Link>
            <ConfirmForm
              action={deleteContract}
              message="この契約と、この契約の請求書を削除します。よろしいですか？"
            >
              <input type="hidden" name="id" value={contract.id} />
              <Button variant="danger" size="sm" type="submit">契約を削除</Button>
            </ConfirmForm>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
