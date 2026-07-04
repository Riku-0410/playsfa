-- 月次KPI目標: トライアル獲得件数を「全社」と「弊社担当者ごと」に設定し、達成率を出す
-- (初版を dev 適用後に担当者軸を追加して作り直したため、先頭で drop している。未適用環境では no-op)
drop table if exists trial_targets;

create table trial_targets (
  month date not null check (extract(day from month) = 1), -- 月初日で正規化
  service service_tag not null,
  owner_name text not null default '', -- '' = 全社目標。それ以外は customers.owner_name と対応する弊社担当者名
  target_count integer not null check (target_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (month, service, owner_name)
);

-- RLS: 社内ツールなので authenticated に全許可(init_schema と同方針)
alter table trial_targets enable row level security;
create policy "authenticated_all" on trial_targets for all to authenticated using (true) with check (true);
