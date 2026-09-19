"use client";

import { createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";

type Selected = Map<string, string>; // invoiceId → customerId

const Ctx = createContext<{
  selected: Selected;
  toggle: (id: string, customerId: string) => void;
} | null>(null);

/**
 * 請求一覧で「まとめる」対象を選ぶための選択状態。
 * 行のチェックボックス(MergeCheckbox)と下部のツールバー(MergeToolbar)で共有する。
 */
export function MergeProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Selected>(new Map());
  const toggle = (id: string, customerId: string) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, customerId);
      return next;
    });
  return <Ctx.Provider value={{ selected, toggle }}>{children}</Ctx.Provider>;
}

export function MergeCheckbox({
  id,
  customerId,
  label,
}: {
  id: string;
  customerId: string;
  label: string;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id, customerId)}
      className="size-4 accent-night"
    />
  );
}

export function MergeToolbar({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const ctx = useContext(Ctx);
  if (!ctx || ctx.selected.size === 0) return null;
  const ids = [...ctx.selected.keys()];
  const customers = new Set(ctx.selected.values());
  const ready = ids.length >= 2 && customers.size === 1;
  const hint =
    customers.size > 1
      ? "同じ顧客の請求書だけをまとめられます"
      : ids.length < 2
        ? "もう1枚選ぶとまとめられます"
        : `${ids.length}枚を1枚にまとめます(発行日が最も早いものに寄せます)`;

  return (
    <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-4 rounded-full bg-night px-5 py-2.5 text-sm text-night-ink shadow-card">
      <span>{hint}</span>
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(`選択した${ids.length}枚の請求書を1枚にまとめます。よろしいですか？`)) {
            e.preventDefault();
          }
        }}
      >
        {ids.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
        <Button size="sm" type="submit" disabled={!ready}>
          まとめる
        </Button>
      </form>
    </div>
  );
}
