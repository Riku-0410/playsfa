import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardInset, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { DotProgress } from "@/components/ui/dot-progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError, FieldHint, Label } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SortableTH } from "@/components/ui/sortable-th";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TD, TH, TR } from "@/components/ui/table";
import { formatJPY } from "@/lib/format";
import {
  CONTRACT_STATUSES,
  DEAL_STAGES,
  INVOICE_STATUSES,
  SERVICES,
} from "@/lib/status";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="size-10 shrink-0 rounded-xl border border-line"
        style={{ background: `var(${varName})` }}
      />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{name}</p>
        <p className="truncate text-xs text-ink-muted">{varName}</p>
      </div>
    </div>
  );
}

const sampleInvoices = [
  { no: "INV-2026-018", customer: "青葉学園高校", service: "baskestats", amount: 480000, due: "7/31", status: "sent" },
  { no: "INV-2026-017", customer: "FCオリオンズ", service: "playcut", amount: 240000, due: "7/15", status: "overdue" },
  { no: "INV-2026-016", customer: "湘南ミネルヴァ", service: "baskestats", amount: 480000, due: "6/30", status: "paid" },
  { no: "INV-2026-019", customer: "北陵大学", service: "playcut", amount: 360000, due: "9/30", status: "scheduled" },
] as const;

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-12 px-6 py-12">
      <PageHeader
        title="playsfa Design System"
        description="温かみのあるオフホワイト / チャコール / コーラル。トークンは globals.css、コンポーネントは src/components/ui。"
        actions={
          <>
            <Button variant="outline">セカンダリ</Button>
            <Button>プライマリ →</Button>
          </>
        }
      />

      <Section title="カラー">
        <Card>
          <CardBody className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <Swatch name="canvas" varName="--color-canvas" />
              <Swatch name="surface" varName="--color-surface" />
              <Swatch name="sunken" varName="--color-sunken" />
              <Swatch name="night" varName="--color-night" />
              <Swatch name="ink" varName="--color-ink" />
              <Swatch name="ink-secondary" varName="--color-ink-secondary" />
              <Swatch name="ink-muted" varName="--color-ink-muted" />
              <Swatch name="line" varName="--color-line" />
              <Swatch name="accent" varName="--color-accent" />
              <Swatch name="accent-deep" varName="--color-accent-deep" />
              <Swatch name="accent-200" varName="--color-accent-200" />
              <Swatch name="accent-soft" varName="--color-accent-soft" />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold text-ink-muted">
                チャート系列色(順序固定・CVD検証済み。series-3/5/6は直接ラベル必須)
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <span
                    key={n}
                    className="flex h-9 items-center gap-2 rounded-full bg-sunken px-3 text-xs font-semibold"
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ background: `var(--color-series-${n})` }}
                    />
                    series-{n}
                  </span>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section title="タイポグラフィ">
        <Card>
          <CardBody className="space-y-4">
            <p className="text-5xl font-extrabold tracking-tight">¥4,280,000</p>
            <p className="text-2xl font-extrabold tracking-tight">
              ページタイトル — 商談パイプライン
            </p>
            <p className="text-lg font-bold tracking-tight">セクション見出し</p>
            <p className="text-base font-bold">カードタイトル</p>
            <p className="text-sm text-ink-secondary">
              本文テキスト。契約合意日と課金開始日は別物として扱い、競合の契約期限を起点に請求をスケジュールする。
            </p>
            <p className="text-xs text-ink-muted">
              キャプション / 補足 — 数値はテーブル内でのみ tabular-nums
            </p>
          </CardBody>
        </Card>
      </Section>

      <Section title="ボタン">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button>商談を追加 →</Button>
              <Button variant="dark">請求書を発行</Button>
              <Button variant="outline">キャンセル</Button>
              <Button variant="ghost">詳細を見る</Button>
              <Button variant="danger">削除</Button>
              <Button disabled>無効状態</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md" variant="outline">Medium</Button>
              <Button size="lg" variant="dark">Large</Button>
              <IconButton aria-label="追加">+</IconButton>
              <IconButton variant="primary" aria-label="検索">⌕</IconButton>
              <IconButton variant="dark" size="sm" aria-label="メニュー">≡</IconButton>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section title="バッジ / ドメインステータス">
        <Card>
          <CardBody className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-muted">商談ステージ</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(DEAL_STAGES).map(([k, v]) => (
                  <Badge key={k} variant={v.badge} dot>{v.label}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-muted">契約ステータス</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CONTRACT_STATUSES).map(([k, v]) => (
                  <Badge key={k} variant={v.badge} dot>{v.label}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-muted">請求ステータス</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(INVOICE_STATUSES).map(([k, v]) => (
                  <Badge key={k} variant={v.badge} dot>{v.label}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-muted">サービス</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SERVICES).map(([k, v]) => (
                  <Badge key={k} variant={v.badge} dot>{v.label}</Badge>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section title="チップ(フィルタ)">
        <Card>
          <CardBody className="flex flex-wrap gap-2">
            <Chip selected>すべて</Chip>
            <Chip>playcut</Chip>
            <Chip>baskestats</Chip>
            <Chip>トライアル中</Chip>
            <Chip>今月 ×</Chip>
          </CardBody>
        </Card>
      </Section>

      <Section title="KPI行(スタットタイル)">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="今月の請求予定"
            value="¥1,280,000"
            delta={{ value: "+¥240,000", direction: "up", vs: "先月" }}
          />
          <StatCard
            label="未入金"
            value="¥240,000"
            delta={{ value: "1件", direction: "up", upIsGood: false, vs: "先週" }}
          />
          <StatCard
            label="パイプライン総額"
            value="¥4,280,000"
            trend={[32, 35, 31, 40, 42, 39, 45, 48, 46, 52, 55, 61]}
          />
          <StatCard
            label="トライアル中"
            value="5件"
            delta={{ value: "+2件", direction: "up", vs: "先月" }}
          />
        </div>
      </Section>

      <Section title="フォーム">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>契約を登録</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field>
              <Label htmlFor="ds-customer">顧客</Label>
              <Input id="ds-customer" placeholder="例: 青葉学園高校" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="ds-cycle">支払いサイクル</Label>
                <Select id="ds-cycle" defaultValue="annual">
                  <option value="annual">年払い</option>
                  <option value="semiannual">半期払い</option>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="ds-amount">請求額(税抜)</Label>
                <Input id="ds-amount" inputMode="numeric" placeholder="480,000" />
                <FieldHint>1回の請求あたりの金額</FieldHint>
              </Field>
            </div>
            <Field>
              <Label htmlFor="ds-start">課金開始日</Label>
              <Input id="ds-start" type="date" />
              <FieldError>競合の契約期限より前の日付です</FieldError>
            </Field>
            <Field>
              <Label htmlFor="ds-note">メモ</Label>
              <Textarea id="ds-note" placeholder="競合はA社、期限は2027年3月…" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline">キャンセル</Button>
              <Button>登録する →</Button>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section title="テーブル(請求書一覧)">
        <Card>
          <CardHeader>
            <CardTitle>今月の請求</CardTitle>
            <Button variant="outline" size="sm">すべて見る</Button>
          </CardHeader>
          <CardBody className="px-2 pt-2">
            <Table>
              <thead>
                <tr>
                  {/* SortableTH: sort/dir をURLで持ち、クリックで昇順/降順トグル */}
                  <SortableTH
                    label="請求番号"
                    sortKey="number"
                    basePath="/design"
                    sort="number"
                    dir="asc"
                  />
                  <SortableTH
                    label="顧客"
                    sortKey="customer"
                    basePath="/design"
                    sort="number"
                    dir="asc"
                  />
                  <TH>サービス</TH>
                  <SortableTH
                    label="金額(税込)"
                    sortKey="total"
                    numeric
                    basePath="/design"
                    sort="number"
                    dir="asc"
                  />
                  <TH>期限</TH>
                  <TH>ステータス</TH>
                </tr>
              </thead>
              <tbody>
                {sampleInvoices.map((inv) => {
                  const st = INVOICE_STATUSES[inv.status];
                  const sv = SERVICES[inv.service];
                  return (
                    <TR key={inv.no}>
                      <TD className="font-semibold">{inv.no}</TD>
                      <TD>
                        <span className="flex items-center gap-2.5">
                          <Avatar name={inv.customer} size="sm" />
                          {inv.customer}
                        </span>
                      </TD>
                      <TD>
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: sv.seriesVar }}
                          />
                          {sv.label}
                        </span>
                      </TD>
                      <TD numeric className="font-semibold">
                        {formatJPY(Math.round(inv.amount * 1.1))}
                      </TD>
                      <TD className="text-ink-secondary">{inv.due}</TD>
                      <TD>
                        <Badge variant={st.badge} dot>{st.label}</Badge>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
            {/* Pagination: 50件/ページ、フィルタ・ソートのクエリを保持して遷移 */}
            <Pagination basePath="/design" page={2} total={428} />
          </CardBody>
        </Card>
      </Section>

      <Section title="その他">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>契約更新まで</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-3xl font-extrabold tracking-tight">92日</p>
              <DotProgress total={50} value={37} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>インセット面</CardTitle>
            </CardHeader>
            <CardBody>
              <CardInset className="p-4">
                <p className="text-xs font-semibold text-ink-muted">月額基本料</p>
                <p className="mt-1 text-xl font-bold">¥40,000</p>
              </CardInset>
            </CardBody>
          </Card>
          <Card>
            <EmptyState
              title="商談がまだありません"
              description="最初の商談を追加してパイプラインを始めましょう"
              action={<Button size="sm">商談を追加 →</Button>}
            />
          </Card>
        </div>
      </Section>
    </main>
  );
}
