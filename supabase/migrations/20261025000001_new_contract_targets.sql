-- 成長シナリオの新規見込み額(全社・初年度の契約額・税抜)を月ごとに上書きする。
-- 未設定の月は「去年のその月と今年の締結済みの大きい方」。設定した額は翌年以降の同じ月にも引き継ぐ
create table new_contract_targets (
  month date primary key check (extract(day from month) = 1), -- 月初日で正規化
  amount integer not null check (amount >= 0),
  updated_at timestamptz not null default now()
);

-- RLS: 社内ツールなので authenticated に全許可(init_schema と同方針)
alter table new_contract_targets enable row level security;
create policy "authenticated_all" on new_contract_targets for all to authenticated using (true) with check (true);
