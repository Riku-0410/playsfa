"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BillingCycle } from "@/lib/billing";
import { createContractWithInvoices } from "@/lib/contracts";
import { num, requiredStr, str } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";

function parseFees(formData: FormData) {
  const descriptions = formData.getAll("fee_description").map(String);
  const amounts = formData.getAll("fee_amount").map(String);
  const types = formData.getAll("fee_type").map(String);
  return descriptions
    .map((description, i) => ({
      description: description.trim(),
      amount: Number((amounts[i] ?? "").replace(/[,，]/g, "")),
      recurring: types[i] === "recurring",
    }))
    .filter((f) => f.description && Number.isFinite(f.amount) && f.amount > 0);
}

export async function createContract(formData: FormData) {
  const db = createAdminClient();
  const amount = num(formData, "amount_per_billing");
  if (!amount || amount <= 0) throw new Error("請求額が不正です");

  const { contractId } = await createContractWithInvoices(db, {
    customer_id: requiredStr(formData, "customer_id"),
    deal_id: str(formData, "deal_id"),
    service: requiredStr(formData, "service") as "playcut" | "baskestats",
    plan_name: str(formData, "plan_name"),
    billing_cycle: requiredStr(formData, "billing_cycle") as BillingCycle,
    amount_per_billing: amount,
    tax_rate: num(formData, "tax_rate") ?? 10,
    agreement_date: requiredStr(formData, "agreement_date"),
    billing_start_date: requiredStr(formData, "billing_start_date"),
    note: str(formData, "note"),
    fees: parseFees(formData),
  });

  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/");
  redirect(`/invoices?contract=${contractId}`);
}

/** 契約の編集。金額・課金開始・サイクルは請求書が生成済みのため変更不可 */
export async function updateContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("contracts")
    .update({
      plan_name: str(formData, "plan_name"),
      agreement_date: requiredStr(formData, "agreement_date"),
      status: requiredStr(formData, "status") as
        | "pending" | "active" | "ended" | "churned",
      note: str(formData, "note"),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/contracts");
}

/** 契約の削除。請求書もカスケードで消えるため、入金済みがあればブロック */
export async function deleteContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { count } = await db
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", id)
    .eq("status", "paid");
  if (count && count > 0) {
    throw new Error("入金済みの請求書がある契約は削除できません");
  }
  const { error } = await db.from("contracts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/contracts");
  revalidatePath("/invoices");
  redirect("/contracts");
}
