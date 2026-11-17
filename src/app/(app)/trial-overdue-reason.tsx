"use client";

import { useState, useTransition } from "react";
import { Button, FormPendingContext } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateShort } from "@/lib/format";
import { saveTrialOverdueReason } from "./actions";

/**
 * トライアル期限超過の商談に「放置している理由」をその場で書く・表示する。
 * 普段は理由を表示し、クリックで入力欄に切り替える。
 */
export function TrialOverdueReason({
  dealId,
  reason,
  writtenAt,
}: {
  dealId: string;
  reason: string | null;
  writtenAt: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return reason ? (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group block max-w-80 text-left"
        title="クリックで編集"
      >
        <span className="text-sm text-ink group-hover:underline">{reason}</span>
        {writtenAt && (
          <span className="ml-2 text-xs text-ink-muted">
            {formatDateShort(writtenAt)}記入
          </span>
        )}
      </button>
    ) : (
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        理由を書く
      </Button>
    );
  }

  return (
    <form
      className="flex min-w-72 items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(false);
        startTransition(async () => {
          try {
            await saveTrialOverdueReason(formData);
            setEditing(false);
          } catch {
            setError(true);
          }
        });
      }}
    >
      <input type="hidden" name="id" value={dealId} />
      <Input
        name="reason"
        defaultValue={reason ?? ""}
        placeholder="例: 先方の決裁待ち(12月の会議で判断)"
        autoFocus
        aria-invalid={error || undefined}
        className="h-9"
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <FormPendingContext value={pending}>
        <Button type="submit" size="sm">保存</Button>
      </FormPendingContext>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        取消
      </Button>
      {error && (
        <span role="alert" className="text-xs font-medium text-critical-deep">
          保存できませんでした
        </span>
      )}
    </form>
  );
}
