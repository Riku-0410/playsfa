"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayJST } from "@/lib/dates";
import { num, requiredStr, str } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";
import { addActivity } from "../customers/actions";

type Stage = "lead" | "contacted" | "trial" | "negotiation" | "won" | "lost";
type Service = "playcut" | "baskestats";

function dealValues(formData: FormData) {
  return {
    customer_id: requiredStr(formData, "customer_id"),
    stage: requiredStr(formData, "stage") as Stage,
    title: str(formData, "title"),
    trial_start: str(formData, "trial_start"),
    trial_end: str(formData, "trial_end"),
    competitor: str(formData, "competitor"),
    competitor_expiry: str(formData, "competitor_expiry"),
    expected_billing_start: str(formData, "expected_billing_start"),
    lost_reason: str(formData, "lost_reason"),
  };
}

/** サービスは複数選択可。選んだサービスごとに、見込額もサービス別で商談を作る */
export async function createDeal(formData: FormData) {
  const db = createAdminClient();
  const services = [...new Set(formData.getAll("service").map(String))].filter(
    (s): s is Service => s === "playcut" || s === "baskestats",
  );
  if (services.length === 0) {
    throw new Error("サービスを1つ以上選択してください");
  }
  const values = dealValues(formData);
  const { data, error } = await db
    .from("deals")
    .insert(
      services.map((service) => ({
        ...values,
        service,
        amount_expected: num(formData, `amount_expected_${service}`),
      })),
    )
    .select("id");
  if (error) throw error;
  revalidatePath("/deals");
  // 作成直後に活動ログ記入モーダルを開く(複数サービス同時作成時は先頭の商談で記入)
  redirect(`/deals/${data[0].id}?log=1`);
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
  const values = {
    ...dealValues(formData),
    service: requiredStr(formData, "service") as Service,
    amount_expected: num(formData, "amount_expected"),
  };
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
  // 保存後は必ず活動ログ記入モーダルを開く(スキップ可)
  redirect(`/deals/${id}?log=1`);
}

/** 商談の作成/保存後モーダルからの活動ログ記録。記録後はモーダルを閉じて商談詳細へ */
export async function logDealActivity(formData: FormData) {
  const dealId = requiredStr(formData, "deal_id");
  await addActivity(formData);
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
