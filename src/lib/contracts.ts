import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { computeInvoiceSchedule, type BillingCycle } from "@/lib/billing";

export type NewContract = {
  customer_id: string;
  deal_id?: string | null;
  service: "playcut" | "baskestats";
  plan_name?: string | null;
  billing_cycle: BillingCycle;
  amount_per_billing: number;
  tax_rate: number;
  agreement_date: string;
  billing_start_date: string;
  term_months?: number;
  note?: string | null;
};

/**
 * 契約を登録し、契約期間分の請求書を scheduled で先行生成する。
 * 請求書の生成に失敗したら契約ごと巻き戻す。
 */
export async function createContractWithInvoices(
  db: SupabaseClient<Database>,
  input: NewContract,
): Promise<{ contractId: string; invoiceCount: number }> {
  const { data: contract, error: contractError } = await db
    .from("contracts")
    .insert({
      customer_id: input.customer_id,
      deal_id: input.deal_id ?? null,
      service: input.service,
      plan_name: input.plan_name ?? null,
      billing_cycle: input.billing_cycle,
      amount_per_billing: input.amount_per_billing,
      tax_rate: input.tax_rate,
      agreement_date: input.agreement_date,
      billing_start_date: input.billing_start_date,
      term_months: input.term_months ?? 12,
      status: "pending",
      note: input.note ?? null,
    })
    .select("id")
    .single();
  if (contractError) throw contractError;

  const drafts = computeInvoiceSchedule({
    billingCycle: input.billing_cycle,
    amountPerBilling: input.amount_per_billing,
    taxRate: input.tax_rate,
    billingStartDate: input.billing_start_date,
    termMonths: input.term_months ?? 12,
  });

  const { error: invoiceError } = await db.from("invoices").insert(
    drafts.map((d) => ({
      ...d,
      contract_id: contract.id,
      customer_id: input.customer_id,
      status: "scheduled" as const,
    })),
  );
  if (invoiceError) {
    await db.from("contracts").delete().eq("id", contract.id);
    throw invoiceError;
  }

  // 商談から作った契約なら商談を成約に倒す
  if (input.deal_id) {
    await db
      .from("deals")
      .update({ stage: "won", closed_at: input.agreement_date })
      .eq("id", input.deal_id);
  }

  return { contractId: contract.id, invoiceCount: drafts.length };
}
