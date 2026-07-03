import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteCustomer, updateCustomer } from "../../actions";
import { CustomerForm } from "../../customer-form";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: customer } = await db
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={`${customer.name} を編集`} />
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardBody>
          <CustomerForm
            action={updateCustomer}
            customer={customer}
            submitLabel="保存する"
          />
        </CardBody>
      </Card>
      <Card className="border border-critical/30">
        <CardHeader>
          <CardTitle className="text-critical-deep">削除</CardTitle>
        </CardHeader>
        <CardBody className="flex items-center justify-between gap-4">
          <p className="text-xs text-ink-muted">
            この顧客に紐づく商談・契約・請求書もすべて削除されます。
            入金済みの請求書がある場合は削除できません。
          </p>
          <ConfirmForm
            action={deleteCustomer}
            message={`「${customer.name}」を削除します。商談・契約・請求書もすべて消えます。よろしいですか？`}
          >
            <input type="hidden" name="id" value={customer.id} />
            <Button variant="danger" type="submit">顧客を削除</Button>
          </ConfirmForm>
        </CardBody>
      </Card>
    </div>
  );
}
