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

/** カンマ区切り数値も許容 */
export function num(fd: FormData, key: string): number | null {
  const t = str(fd, key);
  if (!t) return null;
  const n = Number(t.replace(/[,，]/g, ""));
  return Number.isFinite(n) ? n : null;
}
