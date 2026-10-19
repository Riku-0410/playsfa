import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, format } from "date-fns";
import type { Database } from "@/lib/database.types";

type Db = SupabaseClient<Database>;
type Service = Database["public"]["Enums"]["service_tag"];

/**
 * 商談 → 契約 → 請求の登録漏れ検出。
 * - 成約なのに契約がない商談: 商談IDで紐づく契約も、同じ顧客・サービスの契約もない
 *   (取込や顧客画面から作った契約は deal_id を持たないので、顧客×サービスでも突き合わせる)
 * - 請求書がない契約期間: 課金待ち/課金中の契約(無償を除く)の各請求期間について、
 *   その契約の明細を持つ有効な請求書の期間(period_start〜period_end)がカバーしていない
 *   (手入力の明細は period_start を持たないことがあるので、請求書側の期間で判定する)
 */

export type DealWithoutContract = {
  id: string;
  service: Service;
  closed_at: string | null;
  amount_expected: number | null;
  expected_billing_start: string | null;
  customer_id: string;
  customerName: string | null;
  ownerName: string | null;
};

export type ContractGap = {
  contractId: string;
  customerId: string;
  customerName: string | null;
  ownerName: string | null;
  service: Service;
  status: Database["public"]["Enums"]["contract_status"];
  billingStartDate: string;
  /** 請求書がない請求期間の開始日 */
  missingPeriods: string[];
  /** 同じ顧客・サービスの課金待ち/課金中の契約がほかにもある = 二重登録の疑い */
  hasSibling: boolean;
};

const parseDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** 契約期間内の請求期間の開始日一覧 */
export function billingPeriodStarts(
  billingStart: string,
  termMonths: number,
  cycle: "annual" | "semiannual",
): string[] {
  const step = cycle === "annual" ? 12 : 6;
  const starts: string[] = [];
  for (let k = 0; k < termMonths; k += step) {
    starts.push(format(addMonths(parseDate(billingStart), k), "yyyy-MM-dd"));
  }
  return starts;
}

export async function findPipelineGaps(db: Db): Promise<{
  dealsWithoutContract: DealWithoutContract[];
  contractGaps: ContractGap[];
}> {
  const [dealsRes, contractsRes, itemsRes] = await Promise.all([
    db
      .from("deals")
      .select(
        "id, service, closed_at, amount_expected, expected_billing_start, customer_id, customers(name, owner_name)",
      )
      .eq("stage", "won"),
    db
      .from("contracts")
      .select(
        "id, deal_id, customer_id, service, status, billing_cycle, billing_start_date, term_months, amount_per_billing, previous_contract_id, customers(name, owner_name)",
      ),
    db
      .from("invoice_items")
      .select("contract_id, invoices!inner(status, period_start, period_end)")
      .not("contract_id", "is", null)
      .neq("invoices.status", "void"),
  ]);
  if (dealsRes.error) throw dealsRes.error;
  if (contractsRes.error) throw contractsRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const contracts = contractsRes.data ?? [];
  const linkedDeals = new Set(contracts.map((c) => c.deal_id).filter(Boolean));
  const customerService = (customerId: string, service: string) =>
    `${customerId}|${service}`;
  const contractedPairs = new Set(
    contracts.map((c) => customerService(c.customer_id, c.service)),
  );

  const dealsWithoutContract = (dealsRes.data ?? [])
    .filter(
      (d) =>
        !linkedDeals.has(d.id) &&
        !contractedPairs.has(customerService(d.customer_id, d.service)),
    )
    .map((d) => ({
      id: d.id,
      service: d.service,
      closed_at: d.closed_at,
      amount_expected: d.amount_expected,
      expected_billing_start: d.expected_billing_start,
      customer_id: d.customer_id,
      customerName: d.customers?.name ?? null,
      ownerName: d.customers?.owner_name ?? null,
    }))
    .sort((a, b) => (a.closed_at ?? "").localeCompare(b.closed_at ?? ""));

  // 契約ごとに、その契約の明細を持つ有効な請求書の期間
  const coverage = new Map<string, { start: string; end: string }[]>();
  for (const it of itemsRes.data ?? []) {
    if (!it.contract_id) continue;
    const list = coverage.get(it.contract_id) ?? [];
    list.push({ start: it.invoices.period_start, end: it.invoices.period_end });
    coverage.set(it.contract_id, list);
  }

  const live = contracts.filter(
    (c) => c.status === "pending" || c.status === "active",
  );
  // 更新済みの前の契約は、終了日まで新しい契約と並んで生きているが二重登録ではない
  const renewed = new Set(contracts.map((c) => c.previous_contract_id).filter(Boolean));
  const liveCount = new Map<string, number>();
  for (const c of live) {
    if (renewed.has(c.id)) continue;
    const key = customerService(c.customer_id, c.service);
    liveCount.set(key, (liveCount.get(key) ?? 0) + 1);
  }

  const contractGaps: ContractGap[] = [];
  for (const c of live) {
    // 無償の契約は請求書を作らない(費用分の請求書があっても残りの回は空でよい)
    if (c.amount_per_billing === 0) continue;
    const ranges = coverage.get(c.id) ?? [];
    const missingPeriods = billingPeriodStarts(
      c.billing_start_date,
      c.term_months,
      c.billing_cycle,
    ).filter((ps) => !ranges.some((r) => r.start <= ps && ps <= r.end));
    if (missingPeriods.length === 0) continue;
    contractGaps.push({
      contractId: c.id,
      customerId: c.customer_id,
      customerName: c.customers?.name ?? null,
      ownerName: c.customers?.owner_name ?? null,
      service: c.service,
      status: c.status,
      billingStartDate: c.billing_start_date,
      missingPeriods,
      hasSibling:
        (liveCount.get(customerService(c.customer_id, c.service)) ?? 0) > 1,
    });
  }
  contractGaps.sort((a, b) =>
    a.missingPeriods[0].localeCompare(b.missingPeriods[0]),
  );

  return { dealsWithoutContract, contractGaps };
}
