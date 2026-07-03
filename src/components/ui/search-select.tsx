"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type SearchSelectOption = { value: string; label: string };

const MAX_VISIBLE = 50;

function norm(s: string) {
  return s.toLowerCase().replace(/[\s　]/g, "");
}

/**
 * 検索ポップアップ付きセレクト。選択肢が多い場合(顧客428件など)に
 * <Select> の代わりに使う。値は hidden ではなく sr-only の入力で持ち、
 * required のネイティブ検証がそのまま効く。
 */
export function SearchSelect({
  name,
  options,
  defaultValue,
  placeholder = "選択してください",
  searchPlaceholder = "名前で検索…",
  required = false,
  id,
}: {
  name: string;
  options: SearchSelectOption[];
  defaultValue?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(
    () => options.find((o) => o.value === defaultValue)?.value ?? "",
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const q = norm(query);
  const hits = q ? options.filter((o) => norm(o.label).includes(q)) : options;
  const visible = hits.slice(0, MAX_VISIBLE);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {/* required検証用。readOnlyだと検証対象外になるため、controlled + noop onChange で保持
          (sr-onlyだがフォーカス可能なので、未選択時はブラウザが検証メッセージを出せる) */}
      <input
        type="text"
        name={name}
        value={value}
        required={required}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden
        autoComplete="off"
        className="sr-only"
      />
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-field border border-line/70 bg-sunken px-4 text-sm transition-colors",
          "focus:outline-none focus:bg-surface focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
          selected ? "text-ink" : "text-ink-muted",
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <svg
          className="size-3.5 shrink-0 text-ink-muted"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-inner border border-line bg-surface shadow-pop">
          <div className="border-b border-line p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 w-full rounded-field border border-line/70 bg-sunken px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:bg-surface focus:border-accent/50"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
            {visible.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-ink-muted">
                「{query}」に一致なし
              </li>
            )}
            {visible.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    setValue(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-sunken",
                    o.value === value && "bg-accent-soft font-semibold text-accent-deep",
                  )}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {hits.length > MAX_VISIBLE && (
              <li className="px-3 py-2 text-xs text-ink-muted">
                他{hits.length - MAX_VISIBLE}件 — 検索で絞り込んでください
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
