import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const db = createAdminClient();
  const { data: customers } = await db
    .from("customers")
    .select("id, name, org_type, contact_name, contact_email, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="顧客"
        description={`${customers?.length ?? 0}件`}
        actions={
          <Link href="/customers/new">
            <Button>顧客を追加 →</Button>
          </Link>
        }
      />
      <Card>
        {!customers?.length ? (
          <EmptyState
            title="顧客がまだありません"
            description="最初の顧客を登録しましょう"
            action={
              <Link href="/customers/new">
                <Button size="sm">顧客を追加 →</Button>
              </Link>
            }
          />
        ) : (
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  <TH>名前</TH>
                  <TH>種別</TH>
                  <TH>担当者</TH>
                  <TH>メール</TH>
                  <TH>登録日</TH>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-semibold">
                      <Link
                        href={`/customers/${c.id}`}
                        className="flex items-center gap-2.5 hover:underline"
                      >
                        <Avatar name={c.name} size="sm" />
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="text-ink-secondary">{c.org_type ?? "—"}</TD>
                    <TD className="text-ink-secondary">{c.contact_name ?? "—"}</TD>
                    <TD className="text-ink-secondary">{c.contact_email ?? "—"}</TD>
                    <TD className="text-ink-secondary">
                      {formatDate(c.created_at)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
