import type { SupabaseClient } from "@supabase/supabase-js";
import { calcTotals, dueDateForYmd } from "@/lib/billing";
import type { Database } from "@/lib/database.types";

type Db = SupabaseClient<Database>;

/**
 * 請求書は顧客単位。どの契約の分かは明細行(invoice_items.contract_id)が持つ。
 * ここには「複数契約を1枚にまとめる/戻す」と「契約側の変化を未発行の請求書に反映する」をまとめる。
 */

type ItemRow = {
  id: string;
  invoice_id: string;
  contract_id: string | null;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  sort_order: number;
};

const minOf = (xs: string[]) => [...xs].sort()[0];
const maxOf = (xs: string[]) => [...xs].sort().at(-1);

/** 明細に載っている契約ID(重複なし) */
export function contractIdsOf(items: { contract_id: string | null }[]): string[] {
  return [...new Set(items.map((it) => it.contract_id).filter((x): x is string => !!x))];
}

/** 明細から小計・税・合計を再計算して保存 */
export async function recalcInvoice(db: Db, invoiceId: string) {
  const { data: inv, error } = await db
    .from("invoices")
    .select("tax_rate, invoice_items(amount)")
    .eq("id", invoiceId)
    .single();
  if (error) throw error;
  const { error: upError } = await db
    .from("invoices")
    .update(calcTotals(inv.invoice_items, Number(inv.tax_rate)))
    .eq("id", invoiceId);
  if (upError) throw upError;
}

/** 請求書の発行に伴い、明細に載っている課金待ちの契約を課金中へ */
export async function activateContractsOf(db: Db, invoiceId: string) {
  const { data: items } = await db
    .from("invoice_items")
    .select("contract_id")
    .eq("invoice_id", invoiceId);
  const ids = contractIdsOf(items ?? []);
  if (ids.length === 0) return;
  await db
    .from("contracts")
    .update({ status: "active" })
    .in("id", ids)
    .eq("status", "pending");
}

/**
 * 同じ顧客の未発行(scheduled)請求書を1枚にまとめる。
 * 発行日が最も早いものを残し、他の明細を移して合計を再計算。残りは削除。
 * 対象期間は全体の最早開始〜最遅終了、支払期限は発行月の末日に揃える。
 */
export async function mergeInvoices(db: Db, ids: string[]): Promise<string> {
  const uniq = [...new Set(ids)];
  if (uniq.length < 2) throw new Error("まとめるには請求書を2枚以上選んでください");

  const { data: invoices, error } = await db
    .from("invoices")
    .select(
      "id, customer_id, status, tax_rate, issue_date, period_start, period_end, created_at, invoice_items(id, sort_order)",
    )
    .in("id", uniq);
  if (error) throw error;
  if (!invoices || invoices.length !== uniq.length) {
    throw new Error("選択した請求書が見つかりません");
  }
  if (invoices.some((i) => i.status !== "scheduled")) {
    throw new Error("まとめられるのは未発行(予定)の請求書だけです");
  }
  if (new Set(invoices.map((i) => i.customer_id)).size > 1) {
    throw new Error("同じ顧客の請求書だけをまとめられます");
  }
  if (new Set(invoices.map((i) => Number(i.tax_rate))).size > 1) {
    throw new Error("税率が異なる請求書はまとめられません");
  }

  const sorted = [...invoices].sort(
    (a, b) =>
      a.issue_date.localeCompare(b.issue_date) ||
      a.created_at.localeCompare(b.created_at),
  );
  const [primary, ...others] = sorted;

  // 明細は「残す請求書の行 → 発行日順に他の行」の順で並べ直す
  let order = primary.invoice_items.length;
  for (const inv of others) {
    const items = [...inv.invoice_items].sort((a, b) => a.sort_order - b.sort_order);
    for (const it of items) {
      const { error: mvError } = await db
        .from("invoice_items")
        .update({ invoice_id: primary.id, sort_order: order++ })
        .eq("id", it.id);
      if (mvError) throw mvError;
    }
  }

  const { error: upError } = await db
    .from("invoices")
    .update({
      period_start: minOf(sorted.map((i) => i.period_start)),
      period_end: maxOf(sorted.map((i) => i.period_end)),
      issue_date: primary.issue_date,
      due_date: dueDateForYmd(primary.issue_date),
    })
    .eq("id", primary.id);
  if (upError) throw upError;
  await recalcInvoice(db, primary.id);

  const { error: delError } = await db
    .from("invoices")
    .delete()
    .in("id", others.map((i) => i.id));
  if (delError) throw delError;

  return primary.id;
}

/**
 * まとめた請求書を契約ごとに分け直す(未発行のみ)。
 * 明細の契約IDでグループ化し、期間が最も早いグループを元の請求書に残して他は新規請求書へ。
 * 契約に紐づかない行(手で足した行)は元の請求書に残る。
 */
export async function splitInvoice(db: Db, invoiceId: string): Promise<string[]> {
  const { data: inv, error } = await db
    .from("invoices")
    .select(
      "id, customer_id, status, tax_rate, note, period_start, period_end, invoice_items(id, invoice_id, contract_id, period_start, period_end, amount, sort_order)",
    )
    .eq("id", invoiceId)
    .single();
  if (error) throw error;
  if (inv.status !== "scheduled") {
    throw new Error("分けられるのは未発行(予定)の請求書だけです");
  }

  const groups = new Map<string, ItemRow[]>();
  for (const it of inv.invoice_items) {
    if (!it.contract_id) continue;
    groups.set(it.contract_id, [...(groups.get(it.contract_id) ?? []), it]);
  }
  if (groups.size < 2) throw new Error("この請求書には契約が1つしか載っていません");

  const periodOf = (items: ItemRow[]) => {
    const starts = items.map((i) => i.period_start).filter((x): x is string => !!x);
    const ends = items.map((i) => i.period_end).filter((x): x is string => !!x);
    return {
      start: starts.length ? minOf(starts) : inv.period_start,
      end: ends.length ? maxOf(ends)! : inv.period_end,
    };
  };

  const ordered = [...groups.entries()].sort((a, b) =>
    periodOf(a[1]).start.localeCompare(periodOf(b[1]).start),
  );
  const [, ...moving] = ordered;
  const created: string[] = [];

  for (const [, items] of moving) {
    const { start, end } = periodOf(items);
    const { data: fresh, error: insError } = await db
      .from("invoices")
      .insert({
        customer_id: inv.customer_id,
        tax_rate: inv.tax_rate,
        note: inv.note,
        period_start: start,
        period_end: end,
        issue_date: start,
        due_date: dueDateForYmd(start),
        status: "scheduled",
        ...calcTotals(items, Number(inv.tax_rate)),
      })
      .select("id")
      .single();
    if (insError) throw insError;
    const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);
    for (const [k, it] of sortedItems.entries()) {
      const { error: mvError } = await db
        .from("invoice_items")
        .update({ invoice_id: fresh.id, sort_order: k })
        .eq("id", it.id);
      if (mvError) throw mvError;
    }
    created.push(fresh.id);
  }

  // 残った請求書の期間・発行日・合計を残った明細から引き直す
  const remaining = inv.invoice_items.filter(
    (it) => !moving.some(([cid]) => cid === it.contract_id),
  );
  const { start, end } = periodOf(remaining);
  const { error: upError } = await db
    .from("invoices")
    .update({
      period_start: start,
      period_end: end,
      issue_date: start,
      due_date: dueDateForYmd(start),
    })
    .eq("id", inv.id);
  if (upError) throw upError;
  await recalcInvoice(db, inv.id);

  return created;
}

/**
 * 契約の未発行請求を止める(解約・削除時)。
 * その契約だけの請求書は mode に従って無効化 or 削除、他契約と相乗りしている請求書はその契約の行だけ落として再計算。
 */
export async function dropContractFromScheduled(
  db: Db,
  contractId: string,
  mode: "void" | "delete",
) {
  const { data: items, error } = await db
    .from("invoice_items")
    .select("id, invoice_id, invoices!inner(status)")
    .eq("contract_id", contractId)
    .eq("invoices.status", "scheduled");
  if (error) throw error;
  const invoiceIds = [...new Set((items ?? []).map((it) => it.invoice_id))];
  if (invoiceIds.length === 0) return;

  const { data: all } = await db
    .from("invoice_items")
    .select("id, invoice_id, contract_id")
    .in("invoice_id", invoiceIds);

  for (const invoiceId of invoiceIds) {
    const rows = (all ?? []).filter((it) => it.invoice_id === invoiceId);
    const shared = rows.some((it) => it.contract_id && it.contract_id !== contractId);
    if (!shared) {
      const q = db.from("invoices");
      const { error: e } =
        mode === "void"
          ? await q.update({ status: "void" }).eq("id", invoiceId)
          : await q.delete().eq("id", invoiceId);
      if (e) throw e;
      continue;
    }
    const { error: delError } = await db
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceId)
      .eq("contract_id", contractId);
    if (delError) throw delError;
    await recalcInvoice(db, invoiceId);
  }
}

/** 契約に紐づく請求書(明細経由)のうち、指定ステータスのものがあるか */
export async function hasInvoiceWithStatus(
  db: Db,
  contractId: string,
  status: Database["public"]["Enums"]["invoice_status"],
): Promise<boolean> {
  const { count } = await db
    .from("invoice_items")
    .select("id, invoices!inner(status)", { count: "exact", head: true })
    .eq("contract_id", contractId)
    .eq("invoices.status", status);
  return (count ?? 0) > 0;
}

/** 契約に紐づく請求書ID一覧(明細経由) */
export async function invoiceIdsOfContract(db: Db, contractId: string) {
  const { data } = await db
    .from("invoice_items")
    .select("invoice_id")
    .eq("contract_id", contractId);
  return [...new Set((data ?? []).map((r) => r.invoice_id))];
}
