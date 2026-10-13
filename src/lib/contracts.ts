import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  computeInvoiceSchedule,
  contractEndDate,
  dueDateForYmd,
  nextTermStart,
  type BillingCycle,
} from "@/lib/billing";
import { BILLING_CYCLES, SERVICES } from "@/lib/status";

export type ContractFee = {
  description: string;
  amount: number; // 税抜
  recurring: boolean; // true: 更新後も毎年 / false: 初回契約のみ
};

export type NewContract = {
  customer_id: string;
  deal_id?: string | null;
  service: "playcut" | "baskestats";
  billing_cycle: BillingCycle;
  amount_per_billing: number;
  tax_rate: number;
  agreement_date: string;
  billing_start_date: string;
  term_months?: number;
  fees?: ContractFee[];
};

/** 同じ顧客・サービスで期間の重なる課金待ち/課金中の契約がすでにある */
export class DuplicateContractError extends Error {
  constructor(public existingId: string) {
    super("同じ顧客・サービスで期間の重なる契約がすでにあります");
  }
}

/**
 * 契約を登録し、契約期間分の請求書(明細付き)を scheduled で先行生成する。
 * 初期費用・年間費用は初回請求に明細行として載る。
 * 途中で失敗したら契約ごと巻き戻す。
 * - 同じ顧客・サービスで期間の重なる契約があれば DuplicateContractError(継続なら「更新」を使う)
 * - 商談の指定がなければ、同じ顧客・サービスの未契約の商談(失注以外)を自動で紐づける
 */
export async function createContractWithInvoices(
  db: SupabaseClient<Database>,
  input: NewContract,
): Promise<{ contractId: string; invoiceCount: number }> {
  const fees = input.fees ?? [];
  const termMonths = input.term_months ?? 12;

  const { data: existing, error: existingError } = await db
    .from("contracts")
    .select("id, deal_id, billing_start_date, term_months")
    .eq("customer_id", input.customer_id)
    .eq("service", input.service)
    .in("status", ["pending", "active"]);
  if (existingError) throw existingError;
  const newEnd = contractEndDate(input.billing_start_date, termMonths);
  const overlapping = (existing ?? []).find(
    (c) =>
      c.billing_start_date <= newEnd &&
      input.billing_start_date <=
        contractEndDate(c.billing_start_date, c.term_months),
  );
  if (overlapping) throw new DuplicateContractError(overlapping.id);

  let dealId = input.deal_id ?? null;
  if (!dealId) {
    const { data: linked } = await db
      .from("contracts")
      .select("deal_id")
      .not("deal_id", "is", null);
    const taken = new Set((linked ?? []).map((r) => r.deal_id));
    const { data: candidates } = await db
      .from("deals")
      .select("id")
      .eq("customer_id", input.customer_id)
      .eq("service", input.service)
      .neq("stage", "lost")
      .order("updated_at", { ascending: false });
    dealId = (candidates ?? []).find((d) => !taken.has(d.id))?.id ?? null;
  }

  const { data: contract, error: contractError } = await db
    .from("contracts")
    .insert({
      customer_id: input.customer_id,
      deal_id: dealId,
      service: input.service,
      billing_cycle: input.billing_cycle,
      amount_per_billing: input.amount_per_billing,
      tax_rate: input.tax_rate,
      agreement_date: input.agreement_date,
      billing_start_date: input.billing_start_date,
      term_months: termMonths,
      status: "pending",
    })
    .select("id")
    .single();
  if (contractError) throw contractError;

  // 請求書は契約にカスケードしないので、生成済みの分も明示的に消す
  const rollback = async (invoiceIds: string[] = []) => {
    if (invoiceIds.length > 0) {
      await db.from("invoices").delete().in("id", invoiceIds);
    }
    await db.from("contracts").delete().eq("id", contract.id);
  };

  if (fees.length > 0) {
    const { error } = await db.from("contract_fees").insert(
      fees.map((f) => ({ ...f, contract_id: contract.id })),
    );
    if (error) {
      await rollback();
      throw error;
    }
  }

  const drafts = computeInvoiceSchedule({
    serviceLabel: SERVICES[input.service].label,
    billingCycle: input.billing_cycle,
    amountPerBilling: input.amount_per_billing,
    taxRate: input.tax_rate,
    billingStartDate: input.billing_start_date,
    termMonths,
    fees,
  });

  const { data: inserted, error: invoiceError } = await db
    .from("invoices")
    .insert(
      drafts.map(({ items: _items, ...d }) => ({
        ...d,
        customer_id: input.customer_id,
        tax_rate: input.tax_rate,
        status: "scheduled" as const,
      })),
    )
    .select("id, issue_date");
  if (invoiceError || !inserted) {
    await rollback();
    throw invoiceError ?? new Error("請求書の生成に失敗しました");
  }

  // 明細行を発行日で突き合わせて挿入(発行日は契約内で一意)。行は契約IDを持つ
  const byIssueDate = new Map(inserted.map((r) => [r.issue_date, r.id]));
  const itemRows = drafts.flatMap((d) => {
    const invoiceId = byIssueDate.get(d.issue_date);
    if (!invoiceId) return [];
    return d.items.map((it) => ({
      ...it,
      invoice_id: invoiceId,
      contract_id: contract.id,
    }));
  });
  const { error: itemError } = await db.from("invoice_items").insert(itemRows);
  if (itemError) {
    await rollback(inserted.map((r) => r.id));
    throw itemError;
  }

  // 商談に紐づいた契約なら商談を成約に倒す
  if (dealId) {
    await db
      .from("deals")
      .update({ stage: "won", closed_at: input.agreement_date })
      .eq("id", dealId);
  }

  return { contractId: contract.id, invoiceCount: drafts.length };
}

export type RenewContractInput = {
  id: string;
  billing_cycle: BillingCycle;
  amount_per_billing: number;
  agreement_date: string;
  term_months?: number;
};

/**
 * 契約の更新。契約レコードは増やさず、期間を延ばして次期分の請求書を生成する。
 * - 次期の課金開始 = 現在の終了日の翌日
 * - 毎年かかる費用(recurring)は次期の初回請求に載る。初期費用は載らない
 * - 金額・サイクルが変わったら契約の値を書き換え、変更内容を活動ログに残す
 *   (過去の請求書は明細に金額を持つので変わらない)
 * - 満了にしていた契約を更新した場合は課金中に戻す
 */
export async function renewContract(
  db: SupabaseClient<Database>,
  input: RenewContractInput,
): Promise<{ nextStart: string; invoiceCount: number }> {
  const { data: c, error } = await db
    .from("contracts")
    .select("*, contract_fees(description, amount, recurring)")
    .eq("id", input.id)
    .single();
  if (error) throw error;
  if (c.status === "churned") throw new Error("解約済みの契約は更新できません");
  if (c.status === "pending") {
    throw new Error("課金開始前の契約は更新できません");
  }

  const addMonths = input.term_months ?? 12;
  const nextStart = nextTermStart(c.billing_start_date, c.term_months);

  // 二重更新ガード: 次期開始日の利用料行がすでにあるなら更新済み
  const { count } = await db
    .from("invoice_items")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", c.id)
    .eq("period_start", nextStart);
  if ((count ?? 0) > 0) throw new Error("この契約はすでに更新されています");

  const recurringFees = (c.contract_fees ?? []).filter((f) => f.recurring);
  const drafts = computeInvoiceSchedule({
    serviceLabel: SERVICES[c.service].label,
    billingCycle: input.billing_cycle,
    amountPerBilling: input.amount_per_billing,
    taxRate: Number(c.tax_rate),
    billingStartDate: nextStart,
    termMonths: addMonths,
    fees: recurringFees,
  });

  const { data: inserted, error: invoiceError } = await db
    .from("invoices")
    .insert(
      drafts.map(({ items: _items, ...d }) => ({
        ...d,
        customer_id: c.customer_id,
        tax_rate: c.tax_rate,
        status: "scheduled" as const,
      })),
    )
    .select("id, issue_date");
  if (invoiceError || !inserted) {
    throw invoiceError ?? new Error("請求書の生成に失敗しました");
  }
  const byIssueDate = new Map(inserted.map((r) => [r.issue_date, r.id]));
  const itemRows = drafts.flatMap((d) => {
    const invoiceId = byIssueDate.get(d.issue_date);
    if (!invoiceId) return [];
    return d.items.map((it) => ({ ...it, invoice_id: invoiceId, contract_id: c.id }));
  });
  const { error: itemError } = await db.from("invoice_items").insert(itemRows);
  if (itemError) {
    await db.from("invoices").delete().in("id", inserted.map((r) => r.id));
    throw itemError;
  }

  // 変更点は活動ログに残す(履歴テーブルは持たない)
  const changes: string[] = [];
  if (input.amount_per_billing !== c.amount_per_billing) {
    changes.push(`請求額/回 ${c.amount_per_billing.toLocaleString()}→${input.amount_per_billing.toLocaleString()}`);
  }
  if (input.billing_cycle !== c.billing_cycle) {
    changes.push(`サイクル ${BILLING_CYCLES[c.billing_cycle]}→${BILLING_CYCLES[input.billing_cycle]}`);
  }

  const { error: upError } = await db
    .from("contracts")
    .update({
      billing_cycle: input.billing_cycle,
      amount_per_billing: input.amount_per_billing,
      agreement_date: input.agreement_date,
      term_months: c.term_months + addMonths,
      status: "active",
    })
    .eq("id", c.id);
  if (upError) {
    await db.from("invoices").delete().in("id", inserted.map((r) => r.id));
    throw upError;
  }

  await db.from("activities").insert({
    customer_id: c.customer_id,
    deal_id: c.deal_id,
    type: "memo",
    content: `${SERVICES[c.service].label}の契約を更新(${nextStart}〜)${changes.length ? ": " + changes.join(", ") : ""}`,
    occurred_at: input.agreement_date,
  });

  return { nextStart, invoiceCount: drafts.length };
}

/**
 * 請求書が欠けている請求期間の分を1本作る(登録漏れの補填)。
 * - 利用料行は契約の現在の金額。契約の初回期間なら初期費用・年間費用も載せる
 *   (更新期の毎年費用は判別できないので載せない。必要なら請求書の編集で足す)
 * - 期間開始が過去なら発行予定日は今日(翌朝の日次バッチで採番される)
 */
export async function createInvoiceForPeriod(
  db: SupabaseClient<Database>,
  contractId: string,
  periodStart: string,
  today: string,
): Promise<string> {
  const { data: c, error } = await db
    .from("contracts")
    .select("*, contract_fees(description, amount, recurring)")
    .eq("id", contractId)
    .single();
  if (error) throw error;
  if (c.status !== "pending" && c.status !== "active") {
    throw new Error("課金待ち・課金中の契約だけが対象です");
  }

  const [draft] = computeInvoiceSchedule({
    serviceLabel: SERVICES[c.service].label,
    billingCycle: c.billing_cycle,
    amountPerBilling: c.amount_per_billing,
    taxRate: Number(c.tax_rate),
    billingStartDate: periodStart,
    termMonths: c.billing_cycle === "annual" ? 12 : 6,
    fees: periodStart === c.billing_start_date ? (c.contract_fees ?? []) : [],
  });

  // 二重作成ガード: この契約の明細を持つ有効な請求書がすでにこの期間をカバーしている
  const { data: covered } = await db
    .from("invoice_items")
    .select("id, invoices!inner(status, period_start, period_end)")
    .eq("contract_id", c.id)
    .neq("invoices.status", "void")
    .lte("invoices.period_start", periodStart)
    .gte("invoices.period_end", periodStart)
    .limit(1);
  if ((covered ?? []).length > 0)
    throw new Error("この期間の請求書はすでにあります");

  const issueDate = draft.issue_date < today ? today : draft.issue_date;
  const { items, ...head } = draft;
  const { data: inv, error: invError } = await db
    .from("invoices")
    .insert({
      ...head,
      issue_date: issueDate,
      due_date: dueDateForYmd(issueDate),
      customer_id: c.customer_id,
      tax_rate: c.tax_rate,
      status: "scheduled" as const,
    })
    .select("id")
    .single();
  if (invError) throw invError;

  const { error: itemError } = await db
    .from("invoice_items")
    .insert(
      items.map((it) => ({ ...it, invoice_id: inv.id, contract_id: c.id })),
    );
  if (itemError) {
    await db.from("invoices").delete().eq("id", inv.id);
    throw itemError;
  }
  return inv.id;
}
