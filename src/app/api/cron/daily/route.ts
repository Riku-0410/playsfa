import { NextResponse } from "next/server";
import { todayJST } from "@/lib/dates";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * 日次バッチ(Vercel Cron, 毎朝7時JST)。
 * 1. 発行予定日が来た請求書を自動発行(採番 → issued)
 * 2. 支払期限を過ぎた未入金請求書を overdue に
 * 3. 課金開始日が来た pending 契約を active に
 * Vercel は CRON_SECRET を Authorization: Bearer で送ってくる。
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const today = todayJST();
  const year = Number(today.slice(0, 4));

  // 1. 自動発行
  const { data: due, error: dueError } = await db
    .from("invoices")
    .select("id, contract_id")
    .eq("status", "scheduled")
    .lte("issue_date", today)
    .order("issue_date");
  if (dueError) {
    return NextResponse.json({ error: dueError.message }, { status: 500 });
  }

  const issued: string[] = [];
  for (const inv of due ?? []) {
    // 採番はDBのカウントベース。直前のループで発番した分もカウントに反映される
    const invoiceNumber = await nextInvoiceNumber(db, year);
    const { error } = await db
      .from("invoices")
      .update({ invoice_number: invoiceNumber, status: "issued" })
      .eq("id", inv.id)
      .eq("status", "scheduled");
    if (!error) {
      issued.push(invoiceNumber);
      await db
        .from("contracts")
        .update({ status: "active" })
        .eq("id", inv.contract_id)
        .eq("status", "pending");
    }
  }

  // 2. 期限超過
  const { data: overdue } = await db
    .from("invoices")
    .update({ status: "overdue" })
    .in("status", ["issued", "sent"])
    .lt("due_date", today)
    .select("id");

  // 3. 課金開始日が来た契約をactiveに
  const { data: activated } = await db
    .from("contracts")
    .update({ status: "active" })
    .eq("status", "pending")
    .lte("billing_start_date", today)
    .select("id");

  return NextResponse.json({
    date: today,
    issued,
    overdueCount: overdue?.length ?? 0,
    activatedContracts: activated?.length ?? 0,
  });
}
