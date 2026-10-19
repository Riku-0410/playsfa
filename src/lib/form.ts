/** フォーム値の取り出し。空文字は null に寄せる */
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
}

export function requiredStr(fd: FormData, key: string): string {
  const v = str(fd, key);
  if (!v) throw new Error(`${key} は必須です`);
  return v;
}

/**
 * 数値の取り出し。日本語入力で打ちがちな書き方も許容する:
 * 全角数字・カンマ・空白・「¥」「円」・「万」(8万 → 80000)
 */
export function num(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (!raw) return null;
  let t = raw.normalize("NFKC").replace(/[,\s¥円]/g, "");
  let unit = 1;
  if (t.endsWith("万")) {
    unit = 10000;
    t = t.slice(0, -1);
  }
  if (!t) return null;
  const n = Number(t) * unit;
  return Number.isFinite(n) ? n : null;
}
