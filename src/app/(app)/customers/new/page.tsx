import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { createCustomer } from "../actions";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="顧客を追加" />
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={createCustomer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="name">名前 *</Label>
                <Input id="name" name="name" required placeholder="青葉学園高校" />
              </Field>
              <Field>
                <Label htmlFor="name_kana">かな</Label>
                <Input id="name_kana" name="name_kana" placeholder="あおばがくえん" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="org_type">種別</Label>
                <Input id="org_type" name="org_type" placeholder="高校 / クラブ / 大学…" />
              </Field>
              <Field>
                <Label htmlFor="contact_name">担当者</Label>
                <Input id="contact_name" name="contact_name" placeholder="山田先生" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="contact_email">メール</Label>
                <Input id="contact_email" name="contact_email" type="email" />
              </Field>
              <Field>
                <Label htmlFor="contact_phone">電話</Label>
                <Input id="contact_phone" name="contact_phone" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="billing_name">請求先名</Label>
                <Input id="billing_name" name="billing_name" />
                <FieldHint>空なら顧客名を使います</FieldHint>
              </Field>
              <Field>
                <Label htmlFor="billing_email">請求先メール</Label>
                <Input id="billing_email" name="billing_email" type="email" />
              </Field>
            </div>
            <Field>
              <Label htmlFor="billing_address">請求先住所</Label>
              <Input id="billing_address" name="billing_address" />
            </Field>
            <Field>
              <Label htmlFor="note">メモ</Label>
              <Textarea id="note" name="note" />
            </Field>
            <div className="flex justify-end pt-2">
              <Button type="submit">登録する →</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
