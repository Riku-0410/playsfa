"use server";

import { revalidatePath } from "next/cache";
import { requiredStr, str } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveSettings(formData: FormData) {
  const db = createAdminClient();
  const { error } = await db.from("company_settings").upsert({
    id: 1,
    company_name: str(formData, "company_name"),
    invoice_registration_number: str(formData, "invoice_registration_number"),
    address: str(formData, "address"),
    bank_account: str(formData, "bank_account"),
    invoice_note: str(formData, "invoice_note"),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/settings");
}

/** 弊社担当者を一覧に追加。既にあれば何もしない */
export async function addSalesRep(formData: FormData) {
  const name = requiredStr(formData, "name");
  const db = createAdminClient();
  const { error } = await db
    .from("sales_reps")
    .upsert({ name }, { onConflict: "name", ignoreDuplicates: true });
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/");
}

/** 一覧から外す。顧客や目標のデータはそのまま(顧客に設定済みなら候補には残る) */
export async function removeSalesRep(formData: FormData) {
  const db = createAdminClient();
  const { error } = await db
    .from("sales_reps")
    .delete()
    .eq("name", requiredStr(formData, "name"));
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/");
}
