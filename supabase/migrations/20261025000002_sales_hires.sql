-- 営業の採用計画(全社・入社月ごとの人数)。成長シナリオで、入社から立ち上がり期間を過ぎた月から
-- 1人あたりの新規獲得額を上乗せする
create table sales_hires (
  month date primary key check (extract(day from month) = 1), -- 月初日で正規化
  headcount integer not null check (headcount > 0),
  updated_at timestamptz not null default now()
);

-- RLS: 社内ツールなので authenticated に全許可(init_schema と同方針)
alter table sales_hires enable row level security;
create policy "authenticated_all" on sales_hires for all to authenticated using (true) with check (true);
