import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CardInset } from "@/components/ui/card";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmForm } from "@/components/confirm-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { addSalesRep, removeSalesRep, saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = createAdminClient();
  const [{ data: settings }, { data: reps }, { data: owners }] = await Promise.all([
    db.from("company_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("sales_reps").select("name"),
    db.from("customers").select("owner_name").not("owner_name", "is", null),
  ]);
  const repNames = (reps ?? [])
    .map((r) => r.name)
    .sort((a, b) => a.localeCompare(b, "ja"));
  // 担当顧客の数(一覧から外しても、顧客に設定済みの名前は候補に残る)
  const customerCount = new Map<string, number>();
  for (const r of owners ?? []) {
    if (r.owner_name) customerCount.set(r.owner_name, (customerCount.get(r.owner_name) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="設定"
        description="請求書に印字される自社情報と、弊社担当者の一覧"
      />
      <CardInset className="p-4 text-xs text-ink-secondary">
        ここが空だと請求書の発行者欄が空欄になります。運用開始前に入力してください。
      </CardInset>
      <Card>
        <CardHeader>
          <CardTitle>自社情報</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={saveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="st-name">会社名 / 屋号</Label>
                <Input
                  id="st-name"
                  name="company_name"
                  defaultValue={settings?.company_name ?? ""}
                />
              </Field>
              <Field>
                <Label htmlFor="st-reg">適格請求書 登録番号</Label>
                <Input
                  id="st-reg"
                  name="invoice_registration_number"
                  placeholder="T1234567890123"
                  defaultValue={settings?.invoice_registration_number ?? ""}
                />
                <FieldHint>T + 13桁</FieldHint>
              </Field>
            </div>
            <Field>
              <Label htmlFor="st-address">住所</Label>
              <Textarea
                id="st-address"
                name="address"
                className="min-h-16"
                defaultValue={settings?.address ?? ""}
              />
            </Field>
            <Field>
              <Label htmlFor="st-bank">振込先口座</Label>
              <Textarea
                id="st-bank"
                name="bank_account"
                className="min-h-16"
                placeholder={"○○銀行 ○○支店\n普通 1234567 カ)○○○○"}
                defaultValue={settings?.bank_account ?? ""}
              />
            </Field>
            <Field>
              <Label htmlFor="st-note">請求書の備考(デフォルト)</Label>
              <Textarea
                id="st-note"
                name="invoice_note"
                defaultValue={settings?.invoice_note ?? ""}
              />
            </Field>
            <div className="flex justify-end pt-2">
              <Button type="submit">保存する</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>弊社担当者</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              顧客フォームの担当者候補と、ダッシュボードの担当者別目標に出ます
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {repNames.length > 0 && (
            <ul className="divide-y divide-line">
              {repNames.map((name) => (
                <li key={name} className="flex items-center gap-3 py-2">
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="text-xs text-ink-muted">
                    担当顧客 {customerCount.get(name) ?? 0}件
                  </span>
                  <ConfirmForm
                    action={removeSalesRep}
                    message={`${name}を担当者一覧から外しますか?(顧客や目標のデータは消えません)`}
                    className="ml-auto"
                  >
                    <input type="hidden" name="name" value={name} />
                    <Button type="submit" variant="ghost" size="sm">
                      外す
                    </Button>
                  </ConfirmForm>
                </li>
              ))}
            </ul>
          )}
          <form action={addSalesRep} className="flex items-end gap-2">
            <Field className="flex-1">
              <Label htmlFor="rep-name">担当者を追加</Label>
              <Input id="rep-name" name="name" placeholder="山田" required />
            </Field>
            <Button type="submit" variant="outline">
              追加
            </Button>
          </form>
          <FieldHint>
            担当顧客のいる人は、一覧から外しても顧客に設定されている限り候補に残ります。
          </FieldHint>
        </CardBody>
      </Card>
    </div>
  );
}
