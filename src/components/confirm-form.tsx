"use client";

/** 送信前に確認ダイアログを挟むフォーム。破壊的アクション用 */
export function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
