"use server";

import { revalidatePath } from "next/cache";
import { num, requiredStr, str } from "@/lib/form";
import { SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";

type ServiceKey = keyof typeof SERVICES;
const SERVICE_KEYS = Object.keys(SERVICES) as ServiceKey[];

/**
 * 月次トライアル目標の保存。全社(owner_name = '')と弊社担当者ごとの両方を1フォームで受ける。
 * フィールド名: 全社 = target_<service>、担当者 = rep_name_<i> + rep_<i>_<service>。
 * 入力が空の欄は「未設定」に戻す(行削除)。
 */
export async function saveTrialTargets(formData: FormData) {
  const month = requiredStr(formData, "month");
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Error("month が不正です");

  const now = new Date().toISOString();
  const upserts: {
    month: string;
    service: ServiceKey;
    owner_name: string;
    target_count: number;
    updated_at: string;
  }[] = [];
  const clears = new Map<string, ServiceKey[]>(); // owner_name → 未設定に戻すサービス

  const collect = (owner: string, field: (s: ServiceKey) => string) => {
    for (const service of SERVICE_KEYS) {
      const n = num(formData, field(service));
      if (n === null) {
        clears.set(owner, [...(clears.get(owner) ?? []), service]);
      } else {
        upserts.push({
          month,
          service,
          owner_name: owner,
          target_count: Math.max(0, Math.round(n)),
          updated_at: now,
        });
      }
    }
  };

  collect("", (s) => `target_${s}`);
  for (let i = 0; formData.has(`rep_name_${i}`); i++) {
    const name = str(formData, `rep_name_${i}`);
    if (name) collect(name, (s) => `rep_${i}_${s}`);
  }

  const db = createAdminClient();
  if (upserts.length > 0) {
    const { error } = await db.from("trial_targets").upsert(upserts);
    if (error) throw error;
  }
  for (const [owner, services] of clears) {
    const { error } = await db
      .from("trial_targets")
      .delete()
      .eq("month", month)
      .eq("owner_name", owner)
      .in("service", services);
    if (error) throw error;
  }
  revalidatePath("/");
}
