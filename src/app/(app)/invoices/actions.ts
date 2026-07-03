"use server";

import { revalidatePath } from "next/cache";
import { todayJST } from "@/lib/dates";
import { requiredStr } from "@/lib/form";
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
