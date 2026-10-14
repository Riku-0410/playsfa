import { NextResponse } from "next/server";
import { contractEndDate } from "@/lib/billing";
import { todayJST } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * 日次バッチ(Vercel Cron, 毎朝7時JST)。
 * 1. 送付済のまま支払期限を過ぎた請求書を overdue に
 * 2. 課金開始日が来た pending 契約を active に
 * 3. 更新済み(新しい契約がある)で終了日を過ぎた契約を ended に
 * (請求書の採番は送付時。未送付のまま期限を過ぎたものはダッシュボードの送付待ちに赤で出る)
 * Vercel は CRON_SECRET を Authorization: Bearer で送ってくる。
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const today = todayJST();

  // 1. 期限超過
  const { data: overdue } = await db
    .from("invoices")
    .update({ status: "overdue" })
    .eq("status", "sent")
    .lt("due_date", today)
    .select("id");

  // 2. 課金開始日が来た契約をactiveに
  const { data: activated } = await db
    .from("contracts")
    .update({ status: "active" })
    .eq("status", "pending")
    .lte("billing_start_date", today)
    .select("id");

  // 3. 更新済みの前の契約を満了に(未送付の請求書には手を付けない)
  const { data: renewed } = await db
    .from("contracts")
    .select("previous_contract_id")
    .not("previous_contract_id", "is", null);
  const previousIds = (renewed ?? []).map((r) => r.previous_contract_id!);
  const { data: previous } = previousIds.length
    ? await db
        .from("contracts")
        .select("id, billing_start_date, term_months")
        .in("id", previousIds)
        .eq("status", "active")
    : { data: [] };
  const endedIds = (previous ?? [])
    .filter((c) => contractEndDate(c.billing_start_date, c.term_months) < today)
    .map((c) => c.id);
  if (endedIds.length) {
    await db.from("contracts").update({ status: "ended" }).in("id", endedIds);
  }

  return NextResponse.json({
    date: today,
    overdueCount: overdue?.length ?? 0,
    activatedContracts: activated?.length ?? 0,
    endedContracts: endedIds.length,
  });
}
