<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Supabase環境

- **dev** `playsfa-dev` (ref: `wvscqyeirzgqqpimvodh`) — ローカル開発用。`.env.local` はこちらを向いている。CLIのlink先もこちら
- **prod** `playsfa` (ref: `scbcjpckvcbehvxyokdi`) — 本番。Vercelの環境変数がこちらを向いている。**実データが入っているのでローカルから触らない**(スモークテスト・シード投入は必ずdevで)
- マイグレーション適用:
  - dev: `supabase db push`(link済み。パスワードは `.env.local` 内のコメント参照)
  - prod: `supabase link --project-ref scbcjpckvcbehvxyokdi -p <prodパスワード> && supabase db push` のあと **必ずdevにlinkを戻す**
- 型生成: `supabase gen types typescript --linked > src/lib/database.types.ts`(devから)

# デザインシステム

- トークンは `src/app/globals.css` の `@theme`(Tailwind v4)。色は必ずトークン経由で使う(生hex禁止)
- コンポーネントは `src/components/ui/`、生きたスタイルガイドは `/design` ページ。新コンポーネントを足したら `/design` にも載せる
- ドメインステータス(商談ステージ・契約・請求)のラベルとバッジ色は `src/lib/status.ts` が唯一の対応表
- チャート系列色 `--color-series-1..6` は順序固定・循環禁止。series-3/5/6(黄/緑/マゼンタ)を使うチャートは直接ラベル or テーブル併記が必須(白面コントラスト3:1未満のため)
- 金額・日付の表示は `src/lib/format.ts` を使う。大きい単独数字はプロポーショナル数字、テーブル内のみ `tabular-nums`
