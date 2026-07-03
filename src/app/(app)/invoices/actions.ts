"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayJST } from "@/lib/dates";
import { requiredStr, str } from "@/lib/form";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { createAdminClient } from "@/lib/supabase/admin";

function refresh() {
  revalidatePath("/invoices");
  revalidatePath("/");
}

/** 発行: 請求番号を採番して issued へ(発行予定日はそのまま) */
export async function issueInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const today = todayJST();
  const invoiceNumber = await nextInvoiceNumber(db, Number(today.slice(0, 4)));

  const { error } = await db
    .from("invoices")
    .update({ invoice_number: invoiceNumber, status: "issued" })
    .eq("id", id)
    .eq("status", "scheduled");
  if (error) throw error;

  // 初回発行と同時に契約を課金中へ
  const { data: inv } = await db
    .from("invoices")
    .select("contract_id")
    .eq("id", id)
    .single();
  if (inv) {
    await db
      .from("contracts")
      .update({ status: "active" })
      .eq("id", inv.contract_id)
      .eq("status", "pending");
  }
  refresh();
}

/** 発行取消: 予定に戻して請求番号を返上(欠番になるが番号は再利用されない) */
export async function unissueInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("invoices")
    .update({ invoice_number: null, status: "scheduled" })
    .eq("id", id)
    .in("status", ["issued", "overdue"]);
  if (error) throw error;
  refresh();
}

/** 送付取消: 発行済に戻す */
export async function unsendInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("invoices")
    .update({ status: "issued", sent_at: null })
    .eq("id", id)
    .eq("status", "sent");
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

  const today = todayJST();
  const status =
    invoice.due_date < today
      ? ("overdue" as const)
      : invoice.sent_at
        ? ("sent" as const)
        : ("issued" as const);
  const { error } = await db
    .from("invoices")
    .update({ status, paid_at: null })
    .eq("id", id);
  if (error) throw error;
  refresh();
}

/** 無効化: 解約後の請求などを止める(発行前のみ) */
export async function voidInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("invoices")
    .update({ status: "void" })
    .eq("id", id)
    .in("status", ["scheduled", "issued", "sent", "overdue"]);
  if (error) throw error;
  refresh();
}

/** 無効の取り消し: 予定に戻す(番号は返上) */
export async function restoreInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("invoices")
    .update({ status: "scheduled", invoice_number: null, sent_at: null })
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
    .select("id, status, contracts(tax_rate)")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  if (invoice.status === "paid") {
    throw new Error("入金済みの請求書は編集できません(先に入金取消を)");
  }

  const descriptions = formData.getAll("item_description").map(String);
  const amounts = formData.getAll("item_amount").map(String);
  const items = descriptions
    .map((description, i) => ({
      description: description.trim(),
      amount: Number((amounts[i] ?? "").replace(/[,，]/g, "")),
      sort_order: i,
    }))
    .filter((it) => it.description && Number.isFinite(it.amount));
  if (items.length === 0) throw new Error("明細が1行もありません");

  const taxRate = Number(invoice.contracts?.tax_rate ?? 10);
  const subtotal = items.reduce((a, it) => a + it.amount, 0);
  const taxAmount = Math.floor((subtotal * taxRate) / 100);

  const { error } = await db
    .from("invoices")
    .update({
      ...(invoice.status === "scheduled"
        ? { issue_date: requiredStr(formData, "issue_date") }
        : {}),
      due_date: requiredStr(formData, "due_date"),
      note: str(formData, "note"),
      subtotal,
      tax_amount: taxAmount,
      total: subtotal + taxAmount,
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

  refresh();
}

export async function markSent(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "issued");
  if (error) throw error;
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
  if (!["issued", "sent", "overdue"].includes(invoice.status)) {
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
