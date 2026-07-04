import type { BadgeVariant } from "@/components/ui/badge";

type StatusMeta = { label: string; badge: BadgeVariant };

/** サービスタグ。チャート系列色と同じ固定順(playcut=slot1, baskestats=slot2) */
export const SERVICES = {
  playcut: { label: "playcut", badge: "accent", seriesVar: "var(--color-series-1)" },
  baskestats: { label: "baskestats", badge: "info", seriesVar: "var(--color-series-2)" },
} satisfies Record<string, StatusMeta & { seriesVar: string }>;

export const DEAL_STAGES = {
  lead: { label: "リード", badge: "neutral" },
  contacted: { label: "アプローチ中", badge: "neutral" },
  trial: { label: "トライアル中", badge: "accent" },
  negotiation: { label: "商談中", badge: "warn" },
  won: { label: "成約", badge: "good" },
  lost: { label: "失注", badge: "critical" },
} satisfies Record<string, StatusMeta>;

export const CONTRACT_STATUSES = {
  pending: { label: "課金待ち", badge: "warn" },
  active: { label: "課金中", badge: "good" },
  ended: { label: "満了", badge: "neutral" },
  churned: { label: "解約", badge: "critical" },
} satisfies Record<string, StatusMeta>;

export const INVOICE_STATUSES = {
  scheduled: { label: "予定", badge: "neutral" },
  issued: { label: "発行済", badge: "warn" },
  sent: { label: "送付済", badge: "accent" },
  paid: { label: "入金済", badge: "good" },
  overdue: { label: "期限超過", badge: "critical" },
  void: { label: "無効", badge: "neutral" },
} satisfies Record<string, StatusMeta>;

export const BILLING_CYCLES: Record<string, string> = {
  semiannual: "半期払い",
  annual: "年払い",
};

/** 顧客(チーム)の男女カテゴリ */
export const GENDER_CATEGORIES: Record<string, string> = {
  mens: "男子",
  womens: "女子",
  mixed: "混合",
};
