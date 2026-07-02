const jpy = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
});

const jpyCompact = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
});

const dateLong = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dateShort = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
});

export function formatJPY(amount: number): string {
  return jpy.format(amount);
}

/** 1234567 → "123万" のような概数表示。スタットタイル用 */
export function formatJPYCompact(amount: number): string {
  return `¥${jpyCompact.format(amount)}`;
}

export function formatDate(date: string | Date): string {
  return dateLong.format(typeof date === "string" ? new Date(date) : date);
}

export function formatDateShort(date: string | Date): string {
  return dateShort.format(typeof date === "string" ? new Date(date) : date);
}
