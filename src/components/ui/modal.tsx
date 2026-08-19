import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * サーバーレンダリング可能なモーダル。開閉はURLで制御する
 * (開く = クエリ付きURLへredirect/遷移、閉じる = dismissHref へのリンク)。
 * dismissHref を渡すと背景クリックで閉じられる。
 */
export function Modal({
  dismissHref,
  className,
  children,
}: {
  dismissHref?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const backdrop = "absolute inset-0 bg-night/40";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {dismissHref ? (
        <Link
          href={dismissHref}
          scroll={false}
          aria-label="閉じる"
          className={backdrop}
        />
      ) : (
        <div className={backdrop} />
      )}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-card bg-surface shadow-card",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
