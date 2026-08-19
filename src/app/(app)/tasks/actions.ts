"use server";

import { revalidatePath } from "next/cache";
import { requiredStr } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";

export async function completeTask(formData: FormData) {
  const id = requiredStr(formData, "id");
  const db = createAdminClient();
  const { data, error } = await db
    .from("activities")
    .update({ done: true })
    .eq("id", id)
    .select("customer_id")
    .single();
  if (error) throw error;
  revalidatePath("/tasks");
  if (data?.customer_id) revalidatePath(`/customers/${data.customer_id}`);
}
