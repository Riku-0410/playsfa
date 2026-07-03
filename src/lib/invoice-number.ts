import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** INV-{年}-{連番3桁} を採番する。年はJSTの発行年 */
export async function nextInvoiceNumber(
  db: SupabaseClient<Database>,
  year: number,
): Promise<string> {
  const { count } = await db
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .like("invoice_number", `INV-${year}-%`);
  return `INV-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;
}
