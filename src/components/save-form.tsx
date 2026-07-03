"use client";

import { useRouter } from "next/navigation";

/**
 * 保存成功後に前の画面へ戻るフォーム(編集用)。
 * router.back() は履歴移動なのでスクロール位置も復元される。
 * 直リンクなどで履歴がない場合は fallback へ。
 * backOnSuccess=false なら素のフォームと同じ(作成系はサーバー側のredirectに任せる)。
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
  return (
    <form
      className={className}
      action={async (formData) => {
        await action(formData);
        if (!backOnSuccess) return;
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      {children}
    </form>
  );
}
