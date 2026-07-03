import { addDays, addMonths, format } from "date-fns";

export type BillingCycle = "semiannual" | "annual";

export type InvoiceItemDraft = {
  description: string;
  amount: number; // 税抜
  sort_order: number;
};

export type InvoiceDraft = {
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  items: InvoiceItemDraft[];
};

/** 支払期限 = 発行日 + 30日(v1の固定ルール) */
export const PAYMENT_TERM_DAYS = 30;

function parseDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * 契約から請求書ドラフト(明細付き)を期間分まるごと計算する。
 * - 年払い → 1本(12ヶ月分)、半期払い → 2本(6ヶ月ごと)
 * - fees(初期費用・年間費用)はその契約期間の初回請求にのみ載る。
 *   「毎年かかる費用」も1年契約では初回に載り、更新契約で再び載るかは
 *   contract_fees.recurring で決まる(更新処理側の関心事)
 * - 消費税は明細合計に対して切り捨て
 */
export function computeInvoiceSchedule(input: {
  billingCycle: BillingCycle;
  amountPerBilling: number;
  taxRate: number;
  billingStartDate: string;
  termMonths?: number;
  fees?: { description: string; amount: number }[];
}): InvoiceDraft[] {
  const termMonths = input.termMonths ?? 12;
  const periodMonths = input.billingCycle === "annual" ? 12 : 6;
  const count = Math.max(1, Math.round(termMonths / periodMonths));
  const start = parseDate(input.billingStartDate);
  const fees = input.fees ?? [];

  return Array.from({ length: count }, (_, i) => {
    const periodStart = addMonths(start, i * periodMonths);
    const periodEnd = addDays(addMonths(periodStart, periodMonths), -1);

    const items: InvoiceItemDraft[] = [
      {
        description: `利用料 (${fmt(periodStart)}〜${fmt(periodEnd)})`,
        amount: input.amountPerBilling,
        sort_order: 0,
      },
      ...(i === 0
        ? fees.map((f, j) => ({
            description: f.description,
            amount: f.amount,
            sort_order: j + 1,
          }))
        : []),
    ];

    const subtotal = items.reduce((a, it) => a + it.amount, 0);
    const taxAmount = Math.floor((subtotal * input.taxRate) / 100);
    return {
      period_start: fmt(periodStart),
      period_end: fmt(periodEnd),
      issue_date: fmt(periodStart),
      due_date: fmt(addDays(periodStart, PAYMENT_TERM_DAYS)),
      subtotal,
      tax_amount: taxAmount,
      total: subtotal + taxAmount,
      items,
    };
  });
}
