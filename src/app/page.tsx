import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4 py-10 text-center">
          <p className="text-3xl font-extrabold tracking-tight">playsfa</p>
          <p className="text-sm text-ink-muted">
            playcut / baskestats のSFA。ダッシュボードは準備中。
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Link href="/design">
              <Button variant="outline">デザインシステム →</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
