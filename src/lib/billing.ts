import { addDays, addMonths, endOfMonth, format } from "date-fns";

export type BillingCycle = "semiannual" | "annual";

export type InvoiceItemDraft = {
  description: string;
  amount: number; // 税抜
  sort_order: number;
  /** 利用料行はその行が対象とする請求期間を持つ。費用行は null */
  period_start: string | null;
  period_end: string | null;
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

/** 支払期限 = 発行日(=請求期間開始日)が属する月の末日 */
export const dueDateFor = (issueDate: Date) => endOfMonth(issueDate);

/** "yyyy-MM-dd" の発行日から支払期限 "yyyy-MM-dd" */
export const dueDateForYmd = (issueDate: string) =>
  fmt(dueDateFor(parseDate(issueDate)));

/** 明細合計から小計・消費税(切り捨て)・合計 */
export function calcTotals(items: { amount: number }[], taxRate: number) {
  const subtotal = items.reduce((a, it) => a + it.amount, 0);
  const tax_amount = Math.floor((subtotal * taxRate) / 100);
  return { subtotal, tax_amount, total: subtotal + tax_amount };
}

/** 利用料行の品目名。まとめ請求で複数サービスが並ぶのでサービス名を頭に付ける */
export const usageDescription = (
  serviceLabel: string,
  periodStart: string,
  periodEnd: string,
) => `${serviceLabel} 利用料 (${periodStart}〜${periodEnd})`;

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
  serviceLabel: string;
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
        description: usageDescription(
          input.serviceLabel,
          fmt(periodStart),
          fmt(periodEnd),
        ),
        amount: input.amountPerBilling,
        sort_order: 0,
        period_start: fmt(periodStart),
        period_end: fmt(periodEnd),
      },
      ...(i === 0
        ? fees.map((f, j) => ({
            description: f.description,
            amount: f.amount,
            sort_order: j + 1,
            period_start: null,
            period_end: null,
          }))
        : []),
    ];

    return {
      period_start: fmt(periodStart),
      period_end: fmt(periodEnd),
      issue_date: fmt(periodStart),
      due_date: fmt(dueDateFor(periodStart)),
      ...calcTotals(items, input.taxRate),
      items,
    };
  });
}

/** 契約終了日 = 課金開始日 + 契約月数 − 1日 */
export const contractEndDate = (billingStart: string, termMonths: number) =>
  fmt(addDays(addMonths(parseDate(billingStart), termMonths), -1));

/** 次期の課金開始日 = 課金開始日 + 契約月数(終了日の翌日) */
export const nextTermStart = (billingStart: string, termMonths: number) =>
  fmt(addMonths(parseDate(billingStart), termMonths));

/** 契約終了日が「今月〜翌月」にあるか、もう過ぎているか(更新か満了かを決める時期) */
export function isEndingSoon(endDate: string, today: string): boolean {
  const [y, m] = today.split("-").map(Number);
  const nextMonthEnd = fmt(endOfMonth(new Date(y, m, 1)));
  return endDate <= nextMonthEnd;
}
