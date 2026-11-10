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

/** 担当者フィルタで「顧客に担当者が設定されていない」を表す値 */
export const NO_OWNER = "_none";

/** 担当者フィルタの選択肢(候補 + 担当者なし) */
export function ownerFilterOptions(reps: string[]) {
  return [
    ...reps.map((r) => ({ value: r, label: r })),
    { value: NO_OWNER, label: "担当者なし" },
  ];
}

/**
 * customers!inner を埋め込んだクエリを、顧客の弊社担当者で絞り込む。
 * owner が空なら何もしない
 */
export function filterByOwner<
  Q extends {
    eq(column: string, value: string): Q;
    is(column: string, value: null): Q;
  },
>(query: Q, owner: string | undefined): Q {
  if (!owner) return query;
  return owner === NO_OWNER
    ? query.is("customers.owner_name", null)
    : query.eq("customers.owner_name", owner);
}
