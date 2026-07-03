"use server";

import { revalidatePath } from "next/cache";
import { str } from "@/lib/form";
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
