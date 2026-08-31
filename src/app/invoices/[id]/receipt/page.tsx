import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { formatJPY } from "@/lib/format";
import { SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** 領収書番号。請求番号 INV-2026-001 → RCP-2026-001(DBには持たず請求番号から導出) */
function receiptNumber(invoiceNumber: string | null): string | null {
  return invoiceNumber ? invoiceNumber.replace(/^INV-/, "RCP-") : null;
}

export default async function ReceiptPrintPage({
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
        "*, invoice_items(description, amount, sort_order), customers(name, billing_name, billing_address), contracts(service, plan_name), payments(paid_on, amount)",
      )
      .eq("id", id)
      .single(),
    db.from("company_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const invoice = invoiceRes.data;
  if (!invoice) notFound();
  const settings = settingsRes.data;
  const billTo = invoice.customers?.billing_name || invoice.customers?.name;
  const isPaid = invoice.status === "paid";
  const items = [...invoice.invoice_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const taxRatePercent =
    invoice.subtotal > 0
      ? Math.round((invoice.tax_amount / invoice.subtotal) * 100)
      : 10;
  // 領収日: 入金レコードの最終日 → invoices.paid_at の順で採用
  const lastPaidOn = invoice.payments
    .map((p) => p.paid_on)
    .sort()
    .at(-1);
  const receiptDate = lastPaidOn ?? invoice.paid_at;
  const serviceLabel = invoice.contracts
    ? `${SERVICES[invoice.contracts.service].label}${
        invoice.contracts.plan_name ? ` ${invoice.contracts.plan_name}` : ""
      }`
    : null;
  const description =
    items.length === 1
      ? items[0].description
      : serviceLabel
        ? `${serviceLabel} 利用料`
        : "サービス利用料";
  const rcpNo = receiptNumber(invoice.invoice_number);

  if (!isPaid) {
    return (
      <div className="mx-auto w-[210mm] max-w-full space-y-4 px-4 py-8">
        <Link href="/invoices">
          <Button variant="outline">← 請求一覧へ</Button>
        </Link>
        <div className="rounded-inner bg-warn-soft px-5 py-4 text-sm text-warn-deep">
          この請求書はまだ入金済みではないため、領収書を発行できません。請求一覧の「入金登録」で入金を登録すると領収書を表示できます。
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 print:py-0">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print { body { background-color: var(--color-surface); } }
      `}</style>

      <div className="mx-auto mb-6 flex w-[210mm] max-w-full items-center justify-between gap-3 px-4 print:hidden">
        <div className="flex gap-2">
          <Link href="/invoices">
            <Button variant="outline">← 請求一覧へ</Button>
          </Link>
          <Link href={`/invoices/${invoice.id}/print`}>
            <Button variant="ghost">請求書を表示</Button>
          </Link>
        </div>
        <PrintButton />
      </div>

      {/* A4用紙 (210mm × 297mm)。請求書と同じシート構成 */}
      <main className="mx-auto flex min-h-[297mm] w-[210mm] max-w-full flex-col bg-surface px-[16mm] py-[18mm] shadow-card print:min-h-[295mm] print:shadow-none">
        <h1 className="text-center text-2xl font-extrabold tracking-[0.3em]">
          領収書
        </h1>

        <div className="mt-10 flex items-start justify-between gap-8">
          <div className="min-w-0 flex-1">
            <p className="border-b border-ink pb-2 text-lg font-bold">
              {billTo} 御中
            </p>
            {invoice.customers?.billing_address && (
              <p className="mt-2 text-sm text-ink-secondary">
                {invoice.customers.billing_address}
              </p>
            )}
          </div>

          <div className="shrink-0 text-right text-sm">
            {rcpNo && <p>領収書番号: {rcpNo}</p>}
            <p>
              領収日: <span className="font-semibold">{receiptDate}</span>
            </p>
            {invoice.invoice_number && (
              <p className="text-xs text-ink-secondary">
                対象請求書: {invoice.invoice_number}
              </p>
            )}
          </div>
        </div>

        <div className="mt-12 border-y-2 border-ink py-6">
          <div className="flex items-baseline justify-center gap-4">
            <span className="text-base font-semibold">領収金額</span>
            <span className="text-4xl font-extrabold tracking-tight">
              {formatJPY(invoice.total)}
            </span>
            <span className="text-xs text-ink-secondary">(税込)</span>
          </div>
        </div>

        <div className="mt-8 space-y-3 text-sm">
          <p>
            但し <span className="font-semibold">{description}</span> として
          </p>
          <p>上記の金額を正に領収いたしました。</p>
        </div>

        <div className="mt-8 ml-auto w-72 space-y-1.5 text-sm">
          <p className="mb-2 text-xs font-semibold text-ink-secondary">内訳</p>
          <div className="flex justify-between">
            <span>税抜金額({taxRatePercent}%対象)</span>
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

        {items.length > 1 && (
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-y border-ink text-left">
                <th className="py-2 pr-4 font-semibold">品目</th>
                <th className="w-40 py-2 text-right font-semibold">
                  金額(税抜)
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-2 pr-4">{it.description}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatJPY(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-auto flex items-end justify-between gap-8 pt-12 text-sm">
          <div className="text-xs text-ink-muted">
            <p>
              対象期間: {invoice.period_start} 〜 {invoice.period_end}
              {serviceLabel && ` ・ ${serviceLabel}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-bold">{settings?.company_name ?? ""}</p>
            {settings?.address && (
              <p className="mt-0.5 whitespace-pre-line text-xs text-ink-secondary">
                {settings.address}
              </p>
            )}
            {settings?.invoice_registration_number && (
              <p className="mt-0.5 text-xs">
                登録番号: {settings.invoice_registration_number}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
