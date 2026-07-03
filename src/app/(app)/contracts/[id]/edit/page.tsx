import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardInset, CardTitle } from "@/components/ui/card";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
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
          <Badge variant={SERVICES[contract.service].badge} dot>
            {SERVICES[contract.service].label}
          </Badge>
        }
      />

      <CardInset className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
        <span>{BILLING_CYCLES[contract.billing_cycle]}</span>
        <span className="font-semibold">
          {formatJPY(contract.amount_per_billing)}/回(税抜)
        </span>
        <span>課金開始 {contract.billing_start_date}</span>
        <span className="text-xs text-ink-muted">
          金額・サイクル・課金開始は請求書が生成済みのため変更不可。
          調整は各請求書の編集で、作り直しは削除→再登録で。
        </span>
      </CardInset>

      <Card>
        <CardHeader>
          <CardTitle>契約情報</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={updateContract} className="space-y-4">
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
                {Object.entries(CONTRACT_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
              <FieldHint>解約時は「解約」に。以降の請求は請求一覧で個別に無効化してください</FieldHint>
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
          </form>
        </CardBody>
      </Card>

      <Card className="border border-critical/30">
        <CardBody className="flex items-center justify-between gap-4 py-5">
          <p className="text-xs text-ink-muted">
            契約を削除すると、生成済みの請求書もすべて消えます。
            入金済みの請求書がある場合は削除できません。
          </p>
          <div className="flex shrink-0 gap-2">
            <Link href={`/invoices?contract=${contract.id}`}>
              <Button variant="outline" size="sm">請求書を見る</Button>
            </Link>
            <ConfirmForm
              action={deleteContract}
              message="この契約と生成済みの請求書をすべて削除します。よろしいですか？"
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
