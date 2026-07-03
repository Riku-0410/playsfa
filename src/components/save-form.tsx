"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 保存成功後に前の画面へ戻るフォーム(編集用)。
 * router.back() は履歴移動なのでスクロール位置も復元される。
 * 直リンクなどで履歴がない場合は fallback へ。
 * backOnSuccess=false なら素のフォームと同じ(作成系はサーバー側のredirectに任せる)。
 * アクションが失敗したときはクラッシュさせず、フォーム上部にエラーを表示する。
 */
export function SaveForm({
  action,
  fallback,
  backOnSuccess = true,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  fallback: string;
  backOnSuccess?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={className}
      action={async (formData) => {
        setError(null);
        try {
          await action(formData);
        } catch (e) {
          // redirect()/notFound() はNextの制御フローなのでそのまま流す
          const digest = (e as { digest?: string })?.digest;
          if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
          setError(
            "保存できませんでした。入力内容を確認してもう一度お試しください。",
          );
          return;
        }
        if (!backOnSuccess) return;
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-inner bg-critical-soft px-4 py-3 text-sm font-medium text-critical-deep"
        >
          {error}
        </div>
      )}
      {children}
    </form>
  );
}
