"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

/** アプリ全体のエラーバウンダリ。未処理エラーでも白画面にしない安全網 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <Card className="max-w-md">
        <CardBody className="space-y-4 text-center">
          <p className="text-lg font-bold">エラーが発生しました</p>
          <p className="text-sm text-ink-secondary">
            処理を完了できませんでした。入力内容に問題があるか、一時的な不具合の可能性があります。
          </p>
          {error.digest && (
            <p className="text-xs text-ink-muted">digest: {error.digest}</p>
          )}
          <div className="flex justify-center gap-3 pt-1">
            <Button variant="outline" onClick={() => router.back()}>
              ← 戻る
            </Button>
            <Button onClick={() => reset()}>再試行</Button>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
