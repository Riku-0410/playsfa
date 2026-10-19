"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayJST } from "@/lib/dates";
import { num, requiredStr, str } from "@/lib/form";
import type { Database } from "@/lib/database.types";
import { RETIRED_DEAL_STAGES, SERVICES } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { addActivity } from "../customers/actions";

type Stage = Database["public"]["Enums"]["deal_stage"];
type Service = Database["public"]["Enums"]["service_tag"];

/** トライアル予定月(`YYYY-MM`)を月初日に。トライアル予定で未入力なら今月 */
function plannedMonth(formData: FormData, stage: Stage): string | null {
  const ym = str(formData, "trial_planned_month");
  if (ym && /^\d{4}-\d{2}$/.test(ym)) return `${ym}-01`;
  return stage === "trial_planned" ? `${todayJST().slice(0, 7)}-01` : null;
}

function dealValues(formData: FormData) {
  const stage = requiredStr(formData, "stage") as Stage;
  if (RETIRED_DEAL_STAGES.includes(stage)) {
    throw new Error("このステージは廃止されました。トライアル中を選んでください");
  }
  const trialStart = str(formData, "trial_start");
  const trialEnd = str(formData, "trial_end");
  if (stage === "trial" && (!trialStart || !trialEnd)) {
    throw new Error("トライアル中の商談はトライアル開始・終了が必須です");
  }
  if (trialStart && trialEnd && trialEnd < trialStart) {
    throw new Error("トライアル終了は開始より後にしてください");
  }
  return {
    customer_id: requiredStr(formData, "customer_id"),
    stage,
    trial_planned_month: plannedMonth(formData, stage),
    trial_start: trialStart,
    trial_end: trialEnd,
    competitor: str(formData, "competitor"),
    expected_billing_start: str(formData, "expected_billing_start"),
    lost_reason: str(formData, "lost_reason"),
  };
}

/** サービスは複数選択可。選んだサービスごとに、見込額もサービス別で商談を作る */
export async function createDeal(formData: FormData) {
  const db = createAdminClient();
  const services = [...new Set(formData.getAll("service").map(String))].filter(
    (s): s is Service => s in SERVICES,
  );
  if (services.length === 0) {
    throw new Error("サービスを1つ以上選択してください");
  }
  const values = dealValues(formData);
  if (values.stage === "won") {
    throw new Error("成約は契約の作成で設定されます");
  }
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
  // 成約・失注に変わったときだけ成約日を今日に。同じステージのまま保存しても元の日付を保つ
  const { data: before } = await db
    .from("deals")
    .select("stage, closed_at")
    .eq("id", id)
    .single();
  // 成約は契約作成でのみ付く。成約済みはステージを動かさない
  if (before?.stage === "won") values.stage = "won";
  else if (values.stage === "won") {
    throw new Error("成約は契約の作成で設定されます");
  }
  const isClosed = values.stage === "won" || values.stage === "lost";
  const closed = !isClosed
    ? { closed_at: null }
    : before?.stage === values.stage && before.closed_at
      ? { closed_at: before.closed_at }
      : { closed_at: todayJST() };
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
