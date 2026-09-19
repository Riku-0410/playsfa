"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BillingCycle } from "@/lib/billing";
import { createContractWithInvoices, renewContract as renewContractRecord } from "@/lib/contracts";
import { todayJST } from "@/lib/dates";
import { num, requiredStr, str } from "@/lib/form";
import {
  dropContractFromScheduled,
  hasInvoiceWithStatus,
  invoiceIdsOfContract,
} from "@/lib/invoices";
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

/**
 * 契約の編集。金額・課金開始・サイクルは請求書が生成済みのため変更不可。
 * 満了・解約に変えたときは未発行の請求を止める(その契約だけの請求書は無効化、相乗りは行を落とす)。
 */
export async function updateContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const status = requiredStr(formData, "status") as
    | "pending" | "active" | "ended" | "churned";
  const { data: before, error: fetchError } = await db
    .from("contracts")
    .select("status, churned_at")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const stopped = (st: string) => st === "churned" || st === "ended";
  const stopping = stopped(status) && !stopped(before.status);
  const { error } = await db
    .from("contracts")
    .update({
      plan_name: str(formData, "plan_name"),
      agreement_date: requiredStr(formData, "agreement_date"),
      status,
      churned_at:
        status === "churned" ? (before.churned_at ?? todayJST()) : null,
      note: str(formData, "note"),
    })
    .eq("id", id);
  if (error) throw error;
  if (stopping) await dropContractFromScheduled(db, id, "void");
  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/");
}

/**
 * 契約の削除。請求書は明細経由で紐づくので明示的に消す。
 * 入金済みがあればブロック。未発行の相乗り請求書はこの契約の行だけ落とす。
 * 発行済みの請求書はその契約だけのものなら削除、相乗りなら票面を変えずに残す(行の契約IDはnullになる)。
 */
export async function deleteContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  if (await hasInvoiceWithStatus(db, id, "paid")) {
    throw new Error("入金済みの請求書がある契約は削除できません");
  }
  await dropContractFromScheduled(db, id, "delete");

  // 発行済み・無効などで残った請求書のうち、この契約だけのものは削除
  const remaining = await invoiceIdsOfContract(db, id);
  if (remaining.length > 0) {
    const { data: rows } = await db
      .from("invoice_items")
      .select("invoice_id, contract_id")
      .in("invoice_id", remaining);
    const solo = remaining.filter(
      (invId) =>
        !(rows ?? []).some(
          (r) => r.invoice_id === invId && r.contract_id && r.contract_id !== id,
        ),
    );
    if (solo.length > 0) {
      const { error } = await db.from("invoices").delete().in("id", solo);
      if (error) throw error;
    }
  }

  const { error } = await db.from("contracts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/");
  redirect("/contracts");
}

/** 契約の更新。期間を延ばして次期分の請求書を生成する(契約レコードは増やさない) */
export async function renewContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const amount = num(formData, "amount_per_billing");
  if (!amount || amount <= 0) throw new Error("請求額が不正です");
  await renewContractRecord(db, {
    id,
    plan_name: str(formData, "plan_name"),
    billing_cycle: requiredStr(formData, "billing_cycle") as BillingCycle,
    amount_per_billing: amount,
    agreement_date: requiredStr(formData, "agreement_date"),
  });
  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/reports");
  revalidatePath("/");
  redirect(`/invoices?contract=${id}`);
}

/** 更新されなかった契約を満了にする。未発行の請求書は残っていない前提(残っていれば無効化) */
export async function endContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("contracts")
    .update({ status: "ended" })
    .eq("id", id)
    .in("status", ["active", "pending"]);
  if (error) throw error;
  await dropContractFromScheduled(db, id, "void");
  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/reports");
  revalidatePath("/");
}
