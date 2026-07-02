"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requiredStr, str } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createCustomer(formData: FormData) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("customers")
    .insert({
      name: requiredStr(formData, "name"),
      name_kana: str(formData, "name_kana"),
      org_type: str(formData, "org_type"),
      contact_name: str(formData, "contact_name"),
      contact_email: str(formData, "contact_email"),
      contact_phone: str(formData, "contact_phone"),
      billing_name: str(formData, "billing_name"),
      billing_email: str(formData, "billing_email"),
      billing_address: str(formData, "billing_address"),
      note: str(formData, "note"),
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function addActivity(formData: FormData) {
  const db = createAdminClient();
  const customerId = requiredStr(formData, "customer_id");
  const { error } = await db.from("activities").insert({
    customer_id: customerId,
    deal_id: str(formData, "deal_id"),
    type: requiredStr(formData, "type") as
      | "call" | "email" | "meeting" | "memo" | "task",
    content: requiredStr(formData, "content"),
    next_action: str(formData, "next_action"),
    next_action_date: str(formData, "next_action_date"),
  });
  if (error) throw error;
  revalidatePath(`/customers/${customerId}`);
}
