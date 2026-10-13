"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BillingCycle } from "@/lib/billing";
import {
  changeBillingStart,
  createContractWithInvoices,
  createInvoiceForPeriod,
  DuplicateContractError,
  renewContract as renewContractRecord,
} from "@/lib/contracts";
import { todayJST } from "@/lib/dates";
import { num, requiredStr, str } from "@/lib/form";
import {
  dropContractFromUnsent,
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

  const customerId = requiredStr(formData, "customer_id");
  const dealId = str(formData, "deal_id");
  let contractId: string;
  try {
    ({ contractId } = await createContractWithInvoices(db, {
      customer_id: customerId,
      deal_id: dealId,
      service: requiredStr(formData, "service") as "playcut" | "baskestats",
      billing_cycle: requiredStr(formData, "billing_cycle") as BillingCycle,
      amount_per_billing: amount,
      tax_rate: 10,
      agreement_date: requiredStr(formData, "agreement_date"),
      billing_start_date: requiredStr(formData, "billing_start_date"),
      fees: parseFees(formData),
    }));
  } catch (e) {
    // 二重登録はフォームに戻して既存契約を案内する(本番ではthrowのメッセージが伏せられるため)
    if (e instanceof DuplicateContractError) {
      const q = new URLSearchParams({
        customer: customerId,
        dup: e.existingId,
      });
      if (dealId) q.set("deal", dealId);
      redirect(`/contracts/new?${q}`);
    }
    throw e;
  }

  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/");
  redirect(`/invoices?contract=${contractId}`);
}

/**
 * 契約の編集。金額・課金開始・サイクルは請求書が生成済みのため変更不可。
 * 満了・解約に変えたときは未送付の請求を止める(その契約だけの請求書は無効化、相乗りは行を落とす)。
 */
export async function updateContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const status = requiredStr(formData, "status") as
    "pending" | "active" | "ended" | "churned";
  const { data: before, error: fetchError } = await db
    .from("contracts")
    .select("status, churned_at")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const newStart = str(formData, "billing_start_date");
  if (newStart) await changeBillingStart(db, id, newStart);

  const stopped = (st: string) => st === "churned" || st === "ended";
  const stopping = stopped(status) && !stopped(before.status);
  const { error } = await db
    .from("contracts")
    .update({
      agreement_date: requiredStr(formData, "agreement_date"),
      // 課金開始日を先に延ばしたなら課金待ちに戻す(フォームの課金中で上書きしない)
      status:
        status === "active" && newStart && newStart > todayJST()
          ? "pending"
          : status,
      churned_at:
        status === "churned" ? (before.churned_at ?? todayJST()) : null,
    })
    .eq("id", id);
  if (error) throw error;
  if (stopping) await dropContractFromUnsent(db, id, "void");
  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/");
}

/**
 * 契約の削除。請求書は明細経由で紐づくので明示的に消す。
 * 入金済みがあればブロック。未送付の相乗り請求書はこの契約の行だけ落とす。
 * 送付済みの請求書はその契約だけのものなら削除、相乗りなら票面を変えずに残す(行の契約IDはnullになる)。
 */
export async function deleteContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  if (await hasInvoiceWithStatus(db, id, "paid")) {
    throw new Error("入金済みの請求書がある契約は削除できません");
  }
  await dropContractFromUnsent(db, id, "delete");

  // 送付済み・無効などで残った請求書のうち、この契約だけのものは削除
  const remaining = await invoiceIdsOfContract(db, id);
  if (remaining.length > 0) {
    const { data: rows } = await db
      .from("invoice_items")
      .select("invoice_id, contract_id")
      .in("invoice_id", remaining);
    const solo = remaining.filter(
      (invId) =>
        !(rows ?? []).some(
          (r) =>
            r.invoice_id === invId && r.contract_id && r.contract_id !== id,
        ),
    );
    if (solo.length > 0) {
      const { error } = await db.from("invoices").delete().in("id", solo);
      if (error) throw error;
    }
  }

  const { data: contract } = await db
    .from("contracts")
    .select("deal_id")
    .eq("id", id)
    .single();
  const { error } = await db.from("contracts").delete().eq("id", id);
  if (error) throw error;
  // 成約は契約があることと対なので、契約を消したら商談を商談中に戻す
  if (contract?.deal_id) {
    await db
      .from("deals")
      .update({ stage: "negotiation", closed_at: null })
      .eq("id", contract.deal_id)
      .eq("stage", "won");
    revalidatePath("/deals");
  }
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

/** 更新されなかった契約を満了にする。未送付の請求書は残っていない前提(残っていれば無効化) */
export async function endContract(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db
    .from("contracts")
    .update({ status: "ended" })
    .eq("id", id)
    .in("status", ["active", "pending"]);
  if (error) throw error;
  await dropContractFromUnsent(db, id, "void");
  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/reports");
  revalidatePath("/");
}

/** 登録漏れの補填: 請求書が欠けている請求期間の分を作る */
export async function createMissingInvoice(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  await createInvoiceForPeriod(
    db,
    id,
    requiredStr(formData, "period_start"),
    todayJST(),
  );
  revalidatePath("/contracts");
  revalidatePath("/invoices");
  revalidatePath("/reports");
  revalidatePath("/");
}
