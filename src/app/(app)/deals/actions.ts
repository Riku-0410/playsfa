"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayJST } from "@/lib/dates";
import { num, requiredStr, str } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";

type Stage = "lead" | "contacted" | "trial" | "negotiation" | "won" | "lost";
type Service = "playcut" | "baskestats";

function dealValues(formData: FormData) {
  return {
    customer_id: requiredStr(formData, "customer_id"),
    service: requiredStr(formData, "service") as Service,
    stage: requiredStr(formData, "stage") as Stage,
    title: str(formData, "title"),
    amount_expected: num(formData, "amount_expected"),
    trial_start: str(formData, "trial_start"),
    trial_end: str(formData, "trial_end"),
    competitor: str(formData, "competitor"),
    competitor_expiry: str(formData, "competitor_expiry"),
    expected_billing_start: str(formData, "expected_billing_start"),
    lost_reason: str(formData, "lost_reason"),
    note: str(formData, "note"),
  };
}

export async function createDeal(formData: FormData) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("deals")
    .insert(dealValues(formData))
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/deals");
  redirect(`/deals/${data.id}`);
}

export async function deleteDeal(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const { error } = await db.from("deals").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/deals");
  redirect("/deals");
}

export async function updateDeal(formData: FormData) {
  const db = createAdminClient();
  const id = requiredStr(formData, "id");
  const values = dealValues(formData);
  const closed =
    values.stage === "won" || values.stage === "lost"
      ? { closed_at: todayJST() }
      : { closed_at: null };
  const { error } = await db
    .from("deals")
    .update({ ...values, ...closed })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  redirect(`/deals/${id}`);
}
