import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  billingPeriod,
  computeInvoiceSchedule,
  contractEndDate,
  dueDateForYmd,
  type BillingCycle,
} from "@/lib/billing";
import { todayJST } from "@/lib/dates";
import { BILLING_CYCLES, SERVICES } from "@/lib/status";

export type ContractFee = {
  description: string;
  amount: number; // 税抜
  recurring: boolean; // true: 更新後も毎年 / false: 初回契約のみ
};

export type NewContract = {
  customer_id: string;
  deal_id?: string | null;
  service: Database["public"]["Enums"]["service_tag"];
  billing_cycle: BillingCycle;
  amount_per_billing: number;
  tax_rate: number;
  agreement_date: string;
  billing_start_date: string;
  term_months?: number;
  fees?: ContractFee[];
  /** 更新で作る契約なら前の契約 */
  previous_contract_id?: string | null;
  /** 登録時の活動メモ。条件と一緒に顧客の活動ログに残す */
  memo?: ContractMemo | null;
};

export type ContractMemo = { content: string; author_name: string };

/** 契約条件の1行(活動ログ用) */
function termsLine(cycle: BillingCycle, amount: number, start: string): string {
  return `${BILLING_CYCLES[cycle]} ${amount.toLocaleString()}円/回(税抜)・${start}〜`;
}

/** 同じ顧客・サービスで期間の重なる課金待ち/課金中の契約がすでにある */
export class DuplicateContractError extends Error {
  constructor(public existingId: string) {
    super("同じ顧客・サービスで期間の重なる契約がすでにあります");
  }
}

/**
 * 契約を登録し、契約期間分の請求書(明細付き)を未送付で先行生成する。
 * 初期費用・年間費用は初回請求に明細行として載る。
 * 途中で失敗したら契約ごと巻き戻す。
 * - 同じ顧客・サービスで期間の重なる契約があれば DuplicateContractError(継続なら「更新」を使う)
 * - 商談の指定がなければ、同じ顧客・サービスの未契約の商談(失注以外)を自動で紐づける(更新では紐づけない)
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
  if (!dealId && !input.previous_contract_id) {
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
      previous_contract_id: input.previous_contract_id ?? null,
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
        status: "unsent" as const,
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

  if (input.memo) {
    await db.from("activities").insert({
      customer_id: input.customer_id,
      deal_id: dealId,
      type: "memo",
      content: `${SERVICES[input.service].label}の契約を登録(${termsLine(input.billing_cycle, input.amount_per_billing, input.billing_start_date)})\n${input.memo.content}`,
      author_name: input.memo.author_name,
    });
  }

  return { contractId: contract.id, invoiceCount: drafts.length };
}

export type RenewContractInput = {
  id: string;
  billing_cycle: BillingCycle;
  amount_per_billing: number;
  agreement_date: string;
  billing_start_date: string;
  fees: ContractFee[];
  memo?: ContractMemo | null;
};

/** この契約を更新して作った契約(なければ null) */
export async function successorOf(
  db: SupabaseClient<Database>,
  contractId: string,
): Promise<{ id: string; billing_start_date: string } | null> {
  const { data } = await db
    .from("contracts")
    .select("id, billing_start_date")
    .eq("previous_contract_id", contractId)
    .limit(1);
  return data?.[0] ?? null;
}

/**
 * 契約の更新 = 新しい契約を登録し、前の契約は満了にする。
 * - 新しい契約は前の契約の終了日より後から始める(重なると二重請求になる)
 * - 前の契約の終了日がもう過ぎていればすぐ満了に。まだなら課金中のまま残し、
 *   終了日を過ぎた朝に日次バッチが満了にする(未送付の請求書には手を付けない)
 * - 条件の変化は活動ログに残す
 */
export async function renewContract(
  db: SupabaseClient<Database>,
  input: RenewContractInput,
): Promise<{ contractId: string }> {
  const { data: c, error } = await db
    .from("contracts")
    .select("*")
    .eq("id", input.id)
    .single();
  if (error) throw error;
  if (c.status === "churned") throw new Error("解約済みの契約は更新できません");
  if (c.status === "pending") {
    throw new Error("課金開始前の契約は更新できません");
  }
  if (await successorOf(db, c.id)) {
    throw new Error("この契約はすでに更新されています");
  }
  const oldEnd = contractEndDate(c.billing_start_date, c.term_months);
  if (input.billing_start_date <= oldEnd) {
    throw new Error(`課金開始日は今の契約の終了日(${oldEnd})より後にしてください`);
  }

  const { contractId } = await createContractWithInvoices(db, {
    customer_id: c.customer_id,
    previous_contract_id: c.id,
    service: c.service,
    billing_cycle: input.billing_cycle,
    amount_per_billing: input.amount_per_billing,
    tax_rate: Number(c.tax_rate),
    agreement_date: input.agreement_date,
    billing_start_date: input.billing_start_date,
    fees: input.fees,
  });

  if (c.status === "active" && oldEnd < todayJST()) {
    await db.from("contracts").update({ status: "ended" }).eq("id", c.id);
  }

  const changes: string[] = [];
  if (input.amount_per_billing !== c.amount_per_billing) {
    changes.push(`請求額/回 ${c.amount_per_billing.toLocaleString()}→${input.amount_per_billing.toLocaleString()}`);
  }
  if (input.billing_cycle !== c.billing_cycle) {
    changes.push(`サイクル ${BILLING_CYCLES[c.billing_cycle]}→${BILLING_CYCLES[input.billing_cycle]}`);
  }
  await db.from("activities").insert({
    customer_id: c.customer_id,
    deal_id: c.deal_id,
    type: "memo",
    content: `${SERVICES[c.service].label}の契約を更新(${input.billing_start_date}〜)${changes.length ? ": " + changes.join(", ") : ""}${input.memo ? `\n${input.memo.content}` : ""}`,
    author_name: input.memo?.author_name ?? null,
    occurred_at: input.agreement_date,
  });

  return { contractId };
}

/**
 * 請求書が欠けている請求期間の分を1本作る(登録漏れの補填)。
 * - 利用料行は契約の現在の金額。契約の初回期間なら初期費用・年間費用も載せる
 *   (更新期の毎年費用は判別できないので載せない。必要なら請求書の編集で足す)
 * - 期間開始が過去なら発行日は今日
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
      status: "unsent" as const,
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

/** 契約の明細行と、その請求書(無効は除く)。請求書に載っている全契約IDも引く */
async function contractInvoiceRows(db: SupabaseClient<Database>, contractId: string) {
  const { data, error } = await db
    .from("invoice_items")
    .select(
      "id, invoice_id, description, period_start, period_end, invoices!inner(status, period_start, invoice_items(contract_id))",
    )
    .eq("contract_id", contractId)
    .neq("invoices.status", "void");
  if (error) throw error;
  return data ?? [];
}

/**
 * 課金開始日・支払い方を変えられない理由。変えられるなら null。
 * 請求書がすべて未送付で、他の契約とまとめていないときだけ変えられる。
 */
export async function billingStartBlocker(
  db: SupabaseClient<Database>,
  contract: { id: string; status: string },
): Promise<string | null> {
  if (contract.status === "ended" || contract.status === "churned") {
    return "満了・解約した契約は変えられません";
  }
  const rows = await contractInvoiceRows(db, contract.id);
  if (rows.some((r) => r.invoices.status === "paid")) {
    return "入金済みの請求書があるため変えられません";
  }
  if (rows.some((r) => r.invoices.status !== "unsent")) {
    return "送付済みの請求書があるため変えられません。請求書の「送付を取り消す」で未送付に戻すと変えられます";
  }
  if (
    rows.some((r) =>
      r.invoices.invoice_items.some(
        (it) => it.contract_id && it.contract_id !== contract.id,
      ),
    )
  ) {
    return "他の契約とまとめた請求書があるため変えられません。請求書の「契約ごとに分ける」で分けると変えられます";
  }
  return null;
}

/**
 * 課金開始日の変更。未送付の請求書を新しい開始日に合わせてずらす
 * (発行日・支払期限・請求期間・利用料行の期間と文言)。金額や手で足した行はそのまま。
 */
export async function changeBillingStart(
  db: SupabaseClient<Database>,
  contractId: string,
  newStart: string,
) {
  const { data: c, error } = await db
    .from("contracts")
    .select("id, status, billing_cycle, billing_start_date, term_months")
    .eq("id", contractId)
    .single();
  if (error) throw error;
  if (c.billing_start_date === newStart) return;
  const blocker = await billingStartBlocker(db, c);
  if (blocker) throw new Error(blocker);

  // 旧開始日で何番目の請求期間か
  const periodCount = Math.round(c.term_months / (c.billing_cycle === "annual" ? 12 : 6));
  const indexOf = (periodStart: string) =>
    Array.from({ length: periodCount }, (_, k) => k).find(
      (k) => billingPeriod(c.billing_start_date, c.billing_cycle, k).start === periodStart,
    );

  const rows = await contractInvoiceRows(db, contractId);
  const invoiceIndex = new Map<string, number>();
  for (const r of rows) {
    const k = indexOf(r.invoices.period_start);
    if (k === undefined) {
      throw new Error(
        `請求期間が契約と合わない請求書(${r.invoices.period_start}〜)があるため、自動でずらせません`,
      );
    }
    invoiceIndex.set(r.invoice_id, k);
  }

  for (const [invoiceId, k] of invoiceIndex) {
    const p = billingPeriod(newStart, c.billing_cycle, k);
    const { error: invError } = await db
      .from("invoices")
      .update({
        period_start: p.start,
        period_end: p.end,
        issue_date: p.start,
        due_date: dueDateForYmd(p.start),
      })
      .eq("id", invoiceId);
    if (invError) throw invError;
  }

  for (const r of rows) {
    if (!r.period_start || !r.period_end) continue; // 費用行は期間を持たない
    const k = indexOf(r.period_start);
    if (k === undefined) continue;
    const p = billingPeriod(newStart, c.billing_cycle, k);
    const { error: itemError } = await db
      .from("invoice_items")
      .update({
        period_start: p.start,
        period_end: p.end,
        description: r.description.replace(
          `${r.period_start}〜${r.period_end}`,
          `${p.start}〜${p.end}`,
        ),
      })
      .eq("id", r.id);
    if (itemError) throw itemError;
  }

  const { error: upError } = await db
    .from("contracts")
    .update({
      billing_start_date: newStart,
      // 開始日を先に延ばしたら課金待ちに戻す。過ぎた日付なら日次バッチが課金中にする
      status: newStart > todayJST() ? "pending" : c.status,
    })
    .eq("id", contractId);
  if (upError) throw upError;
}

/**
 * 支払い方(サイクル・1回あたりの金額)の変更。決まる前に仮で登録した契約を直すためのもの。
 * 未送付の請求書を新しいサイクルで作り直す。既存の請求書は期間順に使い回し
 * (採番・メモはそのまま)、明細は契約から作り直す(手で直した行は消える)。
 * 足りない分は追加、余った分は削除。請求書が契約の期間と揃っていない契約は変えない。
 */
export async function changeBillingTerms(
  db: SupabaseClient<Database>,
  contractId: string,
  terms: { billing_cycle: BillingCycle; amount_per_billing: number },
) {
  const { data: c, error } = await db
    .from("contracts")
    .select("*, contract_fees(description, amount)")
    .eq("id", contractId)
    .single();
  if (error) throw error;
  if (
    c.billing_cycle === terms.billing_cycle &&
    c.amount_per_billing === terms.amount_per_billing
  ) {
    return;
  }
  const blocker = await billingStartBlocker(db, c);
  if (blocker) throw new Error(blocker);

  const rows = await contractInvoiceRows(db, contractId);
  const oldStarts = computeInvoiceSchedule({
    serviceLabel: SERVICES[c.service].label,
    billingCycle: c.billing_cycle,
    amountPerBilling: c.amount_per_billing,
    taxRate: Number(c.tax_rate),
    billingStartDate: c.billing_start_date,
    termMonths: c.term_months,
  }).map((d) => d.period_start);
  const existing = [...new Map(rows.map((r) => [r.invoice_id, r.invoices.period_start]))]
    .map(([id, periodStart]) => ({ id, periodStart }))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  if (
    existing.length !== oldStarts.length ||
    existing.some((inv, k) => inv.periodStart !== oldStarts[k])
  ) {
    throw new Error(
      "請求書が契約の期間と揃っていないため変えられません。契約を削除して登録し直してください",
    );
  }

  const drafts = computeInvoiceSchedule({
    serviceLabel: SERVICES[c.service].label,
    billingCycle: terms.billing_cycle,
    amountPerBilling: terms.amount_per_billing,
    taxRate: Number(c.tax_rate),
    billingStartDate: c.billing_start_date,
    termMonths: c.term_months,
    fees: c.contract_fees ?? [],
  });

  for (const [k, { items, ...d }] of drafts.entries()) {
    let invoiceId = existing[k]?.id;
    if (invoiceId) {
      const { error: invError } = await db.from("invoices").update(d).eq("id", invoiceId);
      if (invError) throw invError;
      const { error: delError } = await db
        .from("invoice_items")
        .delete()
        .eq("invoice_id", invoiceId);
      if (delError) throw delError;
    } else {
      const { data: inserted, error: insError } = await db
        .from("invoices")
        .insert({
          ...d,
          customer_id: c.customer_id,
          tax_rate: c.tax_rate,
          status: "unsent",
        })
        .select("id")
        .single();
      if (insError) throw insError;
      invoiceId = inserted.id;
    }
    const { error: itemError } = await db.from("invoice_items").insert(
      items.map((it) => ({ ...it, invoice_id: invoiceId, contract_id: c.id })),
    );
    if (itemError) throw itemError;
  }
  const extra = existing.slice(drafts.length).map((inv) => inv.id);
  if (extra.length > 0) {
    const { error: delError } = await db.from("invoices").delete().in("id", extra);
    if (delError) throw delError;
  }

  const { error: upError } = await db
    .from("contracts")
    .update(terms)
    .eq("id", contractId);
  if (upError) throw upError;

  const changes: string[] = [];
  if (terms.billing_cycle !== c.billing_cycle) {
    changes.push(`${BILLING_CYCLES[c.billing_cycle]}→${BILLING_CYCLES[terms.billing_cycle]}`);
  }
  if (terms.amount_per_billing !== c.amount_per_billing) {
    changes.push(
      `請求額/回 ${c.amount_per_billing.toLocaleString()}→${terms.amount_per_billing.toLocaleString()}`,
    );
  }
  await db.from("activities").insert({
    customer_id: c.customer_id,
    deal_id: c.deal_id,
    type: "memo",
    content: `${SERVICES[c.service].label}の契約の支払い方を変更: ${changes.join(", ")}`,
    occurred_at: todayJST(),
  });
}
