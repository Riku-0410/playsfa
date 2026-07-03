import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CardInset } from "@/components/ui/card";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = createAdminClient();
  const { data: settings } = await db
    .from("company_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="設定"
        description="請求書に印字される自社情報"
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
    </div>
  );
}
