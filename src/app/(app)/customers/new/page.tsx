import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="顧客を追加" />
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardBody>
          <CustomerForm action={createCustomer} submitLabel="登録する →" />
        </CardBody>
      </Card>
    </div>
  );
}
