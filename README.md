# playsfa

playcut / baskestats の SFA。スプレッドシート運用からの脱却。

## ビジネスモデル

```
リード → トライアル(1ヶ月・無償) → 契約合意 → 課金待ち → 課金開始 → 1年契約 → 更新/解約
                                      ↑
                        競合の契約が切れる月まで待つ(数ヶ月空くこともある)
```

- 契約合意日 ≠ 課金開始日。課金開始は競合の契約期限で決まる
- 支払いは半期払い or 年払い、銀行振込
- 請求書は自前生成(適格請求書対応)、契約作成時に契約期間分を先行スケジュール

## スタック

- Next.js (App Router) + Supabase
- デプロイ: Vercel / 日次バッチ: Vercel Cron

## 開発

```bash
npm run dev              # localhost:3000
supabase start           # ローカルSupabase
supabase migration up    # マイグレーション適用(db resetは使わない)
```
