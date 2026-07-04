import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Field, FieldHint, Label } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { GENDER_CATEGORIES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerNameField } from "./owner-name-field";

type CustomerDefaults = {
  id?: string;
  name?: string;
  name_kana?: string | null;
  org_type?: string | null;
  gender?: string | null;
  owner_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  billing_name?: string | null;
  billing_email?: string | null;
  billing_address?: string | null;
  note?: string | null;
};

export async function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  customer?: CustomerDefaults;
  submitLabel: string;
}) {
  // 保存済みの弊社担当者名をチップ候補に出す
  const db = createAdminClient();
  const { data: owners } = await db
    .from("customers")
    .select("owner_name")
    .not("owner_name", "is", null);
  const ownerOptions = [
    ...new Set(
      (owners ?? [])
        .map((r) => r.owner_name)
        .filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b, "ja"));

  return (
    <SaveForm
      action={action}
      backOnSuccess={!!customer?.id}
      fallback={customer?.id ? `/customers/${customer.id}` : "/customers"}
      className="space-y-4"
    >
      {customer?.id && <input type="hidden" name="id" value={customer.id} />}
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="name">名前 *</Label>
          <Input
            id="name"
            name="name"
            required
            placeholder="青葉学園高校"
            defaultValue={customer?.name ?? ""}
          />
        </Field>
        <Field>
          <Label htmlFor="name_kana">かな</Label>
          <Input
            id="name_kana"
            name="name_kana"
            placeholder="あおばがくえん"
            defaultValue={customer?.name_kana ?? ""}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="org_type">種別</Label>
          <Input
            id="org_type"
            name="org_type"
            placeholder="高校 / クラブ / 大学…"
            defaultValue={customer?.org_type ?? ""}
          />
        </Field>
        <Field>
          <Label htmlFor="gender">男女</Label>
          <Select
            id="gender"
            name="gender"
            defaultValue={customer?.gender ?? ""}
          >
            <option value="">未設定</option>
            {Object.entries(GENDER_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="owner_name">弊社担当者</Label>
          <OwnerNameField
            options={ownerOptions}
            defaultValue={customer?.owner_name ?? ""}
          />
        </Field>
        <Field>
          <Label htmlFor="contact_name">先方担当者</Label>
          <Input
            id="contact_name"
            name="contact_name"
            placeholder="山田先生"
            defaultValue={customer?.contact_name ?? ""}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="contact_email">メール</Label>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={customer?.contact_email ?? ""}
          />
        </Field>
        <Field>
          <Label htmlFor="contact_phone">電話</Label>
          <Input
            id="contact_phone"
            name="contact_phone"
            defaultValue={customer?.contact_phone ?? ""}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="billing_name">請求先名</Label>
          <Input
            id="billing_name"
            name="billing_name"
            defaultValue={customer?.billing_name ?? ""}
          />
          <FieldHint>空なら顧客名を使います</FieldHint>
        </Field>
        <Field>
          <Label htmlFor="billing_email">請求先メール</Label>
          <Input
            id="billing_email"
            name="billing_email"
            type="email"
            defaultValue={customer?.billing_email ?? ""}
          />
        </Field>
      </div>
      <Field>
        <Label htmlFor="billing_address">請求先住所</Label>
        <Input
          id="billing_address"
          name="billing_address"
          defaultValue={customer?.billing_address ?? ""}
        />
      </Field>
      <Field>
        <Label htmlFor="note">メモ</Label>
        <Textarea id="note" name="note" defaultValue={customer?.note ?? ""} />
      </Field>
      <div className="flex justify-end pt-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </SaveForm>
  );
}
