import { NextResponse } from "next/server";
import { todayJST } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * 日次バッチ(Vercel Cron, 毎朝7時JST)。
 * 1. 送付済のまま支払期限を過ぎた請求書を overdue に
 * 2. 課金開始日が来た pending 契約を active に
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

  return NextResponse.json({
    date: today,
    overdueCount: overdue?.length ?? 0,
    activatedContracts: activated?.length ?? 0,
  });
}
