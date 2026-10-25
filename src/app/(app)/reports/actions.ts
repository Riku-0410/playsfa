"use server";

import { revalidatePath } from "next/cache";
import { num } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 成長シナリオの新規見込み額の保存。フィールド名: month_<i> = "yyyy-MM-01"、amount_<i> = 金額。
 * 「200万」のような書き方も受ける。入力が空の欄は「未設定」に戻す(行削除)。
 */
export async function saveNewContractTargets(formData: FormData) {
  const now = new Date().toISOString();
  const upserts: { month: string; amount: number; updated_at: string }[] = [];
  const clears: string[] = [];
  for (let i = 0; formData.has(`month_${i}`); i++) {
    const month = String(formData.get(`month_${i}`));
    if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Error("month が不正です");
    const n = num(formData, `amount_${i}`);
    if (n === null) clears.push(month);
    else upserts.push({ month, amount: Math.max(0, Math.round(n)), updated_at: now });
  }

  const db = createAdminClient();
  if (upserts.length > 0) {
    const { error } = await db.from("new_contract_targets").upsert(upserts);
    if (error) throw error;
  }
  if (clears.length > 0) {
    const { error } = await db.from("new_contract_targets").delete().in("month", clears);
    if (error) throw error;
  }
  revalidatePath("/reports");
}
