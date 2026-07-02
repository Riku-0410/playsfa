"use server";

import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { requiredStr } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";

function refresh() {
  revalidatePath("/invoices");
  revalidatePath("/");
}

/** 発行: 請求番号を採番し、発行日を今日にして issued へ */
export async function issueInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const year = new Date().getFullYear();

  const { count } = await db
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .like("invoice_number", `INV-${year}-%`);
  const invoiceNumber = `INV-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const { error } = await db
    .from("invoices")
    .update({
      invoice_number: invoiceNumber,
      issue_date: format(new Date(), "yyyy-MM-dd"),
      status: "issued",
    })
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
  const today = format(new Date(), "yyyy-MM-dd");

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
