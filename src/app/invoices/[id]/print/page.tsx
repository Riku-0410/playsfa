import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { formatJPY } from "@/lib/format";
import { BILLING_CYCLES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const [invoiceRes, settingsRes] = await Promise.all([
    db
      .from("invoices")
      .select(
        "*, invoice_items(description, amount, sort_order), customers(name, billing_name, billing_address), contracts(service, billing_cycle, plan_name)",
      )
      .eq("id", id)
      .single(),
    db.from("company_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const invoice = invoiceRes.data;
  if (!invoice) notFound();
  const settings = settingsRes.data;
  const items = [...invoice.invoice_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const billTo = invoice.customers?.billing_name || invoice.customers?.name;
  const taxRatePercent =
    invoice.subtotal > 0
      ? Math.round((invoice.tax_amount / invoice.subtotal) * 100)
      : 10;

  return (
    <main className="mx-auto w-full max-w-3xl bg-surface px-10 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-8 flex items-center justify-between gap-3 print:hidden">
        <Link href="/invoices">
          <Button variant="outline">← 請求一覧へ</Button>
        </Link>
        <PrintButton />
      </div>

      <h1 className="text-center text-2xl font-extrabold tracking-[0.3em]">
        請求書
      </h1>

      <div className="mt-8 flex items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="border-b border-ink pb-2 text-lg font-bold">
            {billTo} 御中
          </p>
          {invoice.customers?.billing_address && (
            <p className="mt-2 text-sm text-ink-secondary">
              {invoice.customers.billing_address}
            </p>
          )}
          <p className="mt-6 text-sm">
            下記の通りご請求申し上げます。
          </p>
          <div className="mt-4 flex items-baseline gap-4 border-b-2 border-ink pb-2">
            <span className="text-sm font-semibold">ご請求金額</span>
            <span className="text-3xl font-extrabold tracking-tight">
              {formatJPY(invoice.total)}
            </span>
            <span className="text-xs text-ink-secondary">(税込)</span>
          </div>
          <p className="mt-3 text-sm">
            お支払期限: <span className="font-bold">{invoice.due_date}</span>
          </p>
        </div>

        <div className="shrink-0 text-right text-sm">
          <p>請求番号: {invoice.invoice_number ?? "(未採番)"}</p>
          <p>発行日: {invoice.issue_date}</p>
          <div className="mt-4 space-y-0.5">
            <p className="text-base font-bold">
              {settings?.company_name ?? ""}
            </p>
            {settings?.address && (
              <p className="whitespace-pre-line text-xs text-ink-secondary">
                {settings.address}
              </p>
            )}
            {settings?.invoice_registration_number && (
              <p className="text-xs">
                登録番号: {settings.invoice_registration_number}
              </p>
            )}
          </div>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left">
            <th className="py-2 pr-4 font-semibold">品目</th>
            <th className="py-2 text-right font-semibold">金額(税抜)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-2.5 pr-4">{it.description}</td>
              <td className="py-2.5 text-right tabular-nums">
                {formatJPY(it.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-64 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span>小計({taxRatePercent}%対象)</span>
          <span className="tabular-nums">{formatJPY(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>消費税({taxRatePercent}%)</span>
          <span className="tabular-nums">{formatJPY(invoice.tax_amount)}</span>
        </div>
        <div className="flex justify-between border-t-2 border-ink pt-1.5 text-base font-bold">
          <span>合計</span>
          <span className="tabular-nums">{formatJPY(invoice.total)}</span>
        </div>
      </div>

      <div className="mt-10 space-y-4 text-sm">
        {settings?.bank_account && (
          <div>
            <p className="font-semibold">お振込先</p>
            <p className="mt-1 whitespace-pre-line text-ink-secondary">
              {settings.bank_account}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              恐れ入りますが振込手数料は貴社にてご負担願います。
            </p>
          </div>
        )}
        <div className="text-xs text-ink-muted">
          <p>
            対象期間: {invoice.period_start} 〜 {invoice.period_end}
            {invoice.contracts && (
              <>
                {" ・ "}
                {SERVICES[invoice.contracts.service].label}
                {invoice.contracts.plan_name && ` ${invoice.contracts.plan_name}`}
                {" ・ "}
                {BILLING_CYCLES[invoice.contracts.billing_cycle]}
              </>
            )}
          </p>
        </div>
        {(invoice.note || settings?.invoice_note) && (
          <div>
            <p className="font-semibold">備考</p>
            <p className="mt-1 whitespace-pre-line text-ink-secondary">
              {invoice.note ?? settings?.invoice_note}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
