import type { Database } from "./database.types";
import { SERVICES } from "./status";

type Service = Database["public"]["Enums"]["service_tag"];
type BillingCycle = Database["public"]["Enums"]["billing_cycle"];

/** 1年あたりの請求回数。ARRの年換算係数 */
const BILLINGS_PER_YEAR: Record<BillingCycle, number> = {
  annual: 1,
  semiannual: 2,
};

export type ArrContract = {
  service: Service;
  billing_cycle: BillingCycle;
  amount_per_billing: number;
  contract_fees: { amount: number; recurring: boolean }[] | null;
};

export type ArrBreakdown = {
  total: number;
  /** 利用料(amount_per_billing)の年換算分 */
  usage: number;
  /** 毎年かかる契約費用(contract_fees.recurring)の分 */
  recurringFees: number;
  count: number;
  byService: Record<Service, { total: number; count: number }>;
};

/**
 * 契約1件の年間収益。利用料の年換算 + 毎年かかる契約費用。
 * 初期費用(recurring=false)は繰り返さないのでARRに含めない。
 */
function contractArr(c: ArrContract): number {
  const usage = c.amount_per_billing * BILLINGS_PER_YEAR[c.billing_cycle];
  const fees = (c.contract_fees ?? [])
    .filter((f) => f.recurring)
    .reduce((sum, f) => sum + f.amount, 0);
  return usage + fees;
}

/**
 * 更新先が同じ集合にある契約を除く。更新の請求書を先に送ると新しい契約が課金中になり、
 * 前の契約も期間満了までは課金中のままなので、そのまま足すと同じ顧客を二重に数える
 */
export function withoutSuperseded<T extends { id: string; previous_contract_id: string | null }>(
  contracts: T[],
): T[] {
  const superseded = new Set(contracts.map((c) => c.previous_contract_id));
  return contracts.filter((c) => !superseded.has(c.id));
}

/** 渡された契約群のARR。ステータスの絞り込みと更新の重複除去は呼び出し側の責任 */
export function calcArr(contracts: ArrContract[]): ArrBreakdown {
  const byService = Object.fromEntries(
    (Object.keys(SERVICES) as Service[]).map((s) => [s, { total: 0, count: 0 }]),
  ) as ArrBreakdown["byService"];
  let usage = 0;
  let recurringFees = 0;

  for (const c of contracts) {
    usage += c.amount_per_billing * BILLINGS_PER_YEAR[c.billing_cycle];
    recurringFees += (c.contract_fees ?? [])
      .filter((f) => f.recurring)
      .reduce((sum, f) => sum + f.amount, 0);
    byService[c.service].total += contractArr(c);
    byService[c.service].count += 1;
  }

  return {
    total: usage + recurringFees,
    usage,
    recurringFees,
    count: contracts.length,
    byService,
  };
}
