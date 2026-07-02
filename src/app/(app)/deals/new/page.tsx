import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDeal } from "../actions";
import { DealForm } from "../deal-form";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { customer } = await searchParams;
  const db = createAdminClient();
  const { data: customers } = await db
    .from("customers")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="商談を追加" />
      <Card>
        <CardHeader>
          <CardTitle>商談情報</CardTitle>
        </CardHeader>
        <CardBody>
          <DealForm
            action={createDeal}
            customers={customers ?? []}
            deal={{ customer_id: customer }}
            submitLabel="追加する →"
          />
        </CardBody>
      </Card>
    </div>
  );
}
