"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayJST } from "@/lib/dates";
import { requiredStr, str } from "@/lib/form";
import { calcTotals } from "@/lib/billing";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import {
  activateContractsOf,
  mergeInvoices as mergeInvoiceRows,
  splitInvoice as splitInvoiceRows,
} from "@/lib/invoices";
import { createAdminClient } from "@/lib/supabase/admin";

function refresh() {
  revalidatePath("/invoices");
  revalidatePath("/");
}

/** まとめる: 同じ顧客の未送付の請求書を1枚に */
export async function mergeInvoices(formData: FormData) {
  const db = createAdminClient();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const primaryId = await mergeInvoiceRows(db, ids);
  refresh();
  redirect(`/invoices/${primaryId}/edit`);
}

/** 分ける: まとめた請求書を契約ごとに戻す */
export async function splitInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  await splitInvoiceRows(db, id);
  refresh();
  redirect("/invoices?status=unsent");
}

/** 送付取消: 未送付に戻す(請求番号はそのまま。送り直すと同じ番号) */
export async function unsendInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("invoices")
    .update({ status: "unsent", sent_at: null })
    .eq("id", id)
    .in("status", ["sent", "overdue"]);
  if (error) throw error;
  refresh();
}

/** 入金取消: 入金レコードを消して元のステータスへ */
export async function unpayInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { data: invoice, error: fetchError } = await db
    .from("invoices")
    .select("id, status, sent_at, due_date")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  if (invoice.status !== "paid") throw new Error("入金済みではありません");

  const { error: payError } = await db
    .from("payments")
    .delete()
    .eq("invoice_id", id);
  if (payError) throw payError;

  const status = !invoice.sent_at
    ? ("unsent" as const)
    : invoice.due_date < todayJST()
      ? ("overdue" as const)
      : ("sent" as const);
  const { error } = await db
    .from("invoices")
    .update({ status, paid_at: null })
    .eq("id", id);
  if (error) throw error;
  refresh();
}

/** 無効化: 解約後の請求などを止める */
export async function voidInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("invoices")
    .update({ status: "void" })
    .eq("id", id)
    .in("status", ["unsent", "sent", "overdue"]);
  if (error) throw error;
  refresh();
}

/** 無効の取り消し: 未送付に戻す(請求番号はそのまま) */
export async function restoreInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("invoices")
    .update({ status: "unsent", sent_at: null })
    .eq("id", id)
    .eq("status", "void");
  if (error) throw error;
  refresh();
}

/** 削除: 入金済み以外 */
export async function deleteInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { data: invoice } = await db
    .from("invoices")
    .select("status")
    .eq("id", id)
    .single();
  if (invoice?.status === "paid") {
    throw new Error("入金済みの請求書は削除できません(先に入金取消を)");
  }
  const { error } = await db.from("invoices").delete().eq("id", id);
  if (error) throw error;
  refresh();
  redirect("/invoices");
}

/** 編集: 日付・備考・明細(入金済みは不可)。明細から金額を再計算 */
export async function updateInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { data: invoice, error: fetchError } = await db
    .from("invoices")
    .select("id, status, tax_rate")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  if (invoice.status === "paid") {
    throw new Error("入金済みの請求書は編集できません(先に入金取消を)");
  }

  // 行ごとの契約ID・期間は hidden で往復させて保つ(手で足した行は空)
  const descriptions = formData.getAll("item_description").map(String);
  const amounts = formData.getAll("item_amount").map(String);
  const contractIds = formData.getAll("item_contract_id").map(String);
  const periodStarts = formData.getAll("item_period_start").map(String);
  const periodEnds = formData.getAll("item_period_end").map(String);
  const items = descriptions
    .map((description, i) => ({
      description: description.trim(),
      amount: Number((amounts[i] ?? "").replace(/[,，]/g, "")),
      sort_order: i,
      contract_id: contractIds[i] || null,
      period_start: periodStarts[i] || null,
      period_end: periodEnds[i] || null,
    }))
    .filter((it) => it.description && Number.isFinite(it.amount));
  if (items.length === 0) throw new Error("明細が1行もありません");

  const { error } = await db
    .from("invoices")
    .update({
      ...(invoice.status === "unsent"
        ? { issue_date: requiredStr(formData, "issue_date") }
        : {}),
      due_date: requiredStr(formData, "due_date"),
      note: str(formData, "note"),
      ...calcTotals(items, Number(invoice.tax_rate)),
    })
    .eq("id", id);
  if (error) throw error;

  const { error: delError } = await db
    .from("invoice_items")
    .delete()
    .eq("invoice_id", id);
  if (delError) throw delError;
  const { error: insError } = await db
    .from("invoice_items")
    .insert(items.map((it) => ({ ...it, invoice_id: id })));
  if (insError) throw insError;

  // 「契約の請求額もこの金額に変更する」にチェックした利用料行(仮の金額で登録した契約の確定など)
  for (const row of formData.getAll("sync_contract_row").map(Number)) {
    const contractId = contractIds[row];
    const amount = Number((amounts[row] ?? "").replace(/[,，]/g, ""));
    if (!contractId || !periodStarts[row] || !(amount > 0)) continue;
    const { error: syncError } = await db
      .from("contracts")
      .update({ amount_per_billing: amount })
      .eq("id", contractId);
    if (syncError) throw syncError;
  }
  revalidatePath("/contracts");
  revalidatePath("/reports");
  refresh();
}

/**
 * 送付: 請求番号がまだなければ採番して送付済へ(番号は送付取消・無効で戻しても返上しない)。
 * 載っている課金待ちの契約は課金中に。期限を過ぎてから送ったものは翌朝の日次バッチで期限超過になる
 */
export async function markSent(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { data: invoice, error: fetchError } = await db
    .from("invoices")
    .select("status, invoice_number")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  if (invoice.status !== "unsent") throw new Error("未送付の請求書ではありません");

  const invoiceNumber =
    invoice.invoice_number ??
    (await nextInvoiceNumber(db, Number(todayJST().slice(0, 4))));
  const { error } = await db
    .from("invoices")
    .update({
      invoice_number: invoiceNumber,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "unsent");
  if (error) throw error;
  await activateContractsOf(db, id);
  refresh();
}

/** 入金登録: 全額入金として消込 */
export async function registerPayment(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const today = todayJST();

  const { data: invoice, error: fetchError } = await db
    .from("invoices")
    .select("id, total, status")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  if (!["sent", "overdue"].includes(invoice.status)) {
    throw new Error("入金登録できないステータスです");
  }

  const { error: payError } = await db.from("payments").insert({
    invoice_id: id,
    amount: invoice.total,
    paid_on: today,
    method: "bank_transfer",
  });
  if (payError) throw payError;

  const { error } = await db
    .from("invoices")
    .update({ status: "paid", paid_at: today })
    .eq("id", id);
  if (error) throw error;
  refresh();
}
