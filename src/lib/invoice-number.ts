import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * INV-{年}-{連番3桁} を採番する。
 * 既存の最大番号+1(発行取消で欠番が出ても衝突しない)。
 */
export async function nextInvoiceNumber(
  db: SupabaseClient<Database>,
  year: number,
): Promise<string> {
  const { data } = await db
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `INV-${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  const max = data?.[0]?.invoice_number
    ? Number(data[0].invoice_number.split("-")[2])
    : 0;
  return `INV-${year}-${String(max + 1).padStart(3, "0")}`;
}
