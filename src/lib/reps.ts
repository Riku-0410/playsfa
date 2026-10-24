import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * 弊社担当者の候補 = 設定の担当者一覧(sales_reps) ∪ 顧客に設定済みの担当者名。
 * 顧客の担当者欄は自由入力なので、一覧にない名前も候補に残す。五十音順
 */
export async function listReps(db: SupabaseClient<Database>): Promise<string[]> {
  const [reps, owners] = await Promise.all([
    db.from("sales_reps").select("name"),
    db.from("customers").select("owner_name").not("owner_name", "is", null),
  ]);
  if (reps.error) throw reps.error;
  if (owners.error) throw owners.error;
  return [
    ...new Set(
      [...reps.data.map((r) => r.name), ...owners.data.map((r) => r.owner_name)].filter(
        (n): n is string => Boolean(n),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, "ja"));
}
