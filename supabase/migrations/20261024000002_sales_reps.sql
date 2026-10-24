-- 弊社担当者の一覧。これまでは顧客の owner_name から拾っていたため、担当顧客のない人を
-- 担当者別目標や顧客フォームの候補に出せなかった。候補は「この一覧 ∪ 顧客に設定済みの担当者名」
create table sales_reps (
  name text primary key check (name <> ''),
  created_at timestamptz not null default now()
);

insert into sales_reps (name)
select distinct owner_name from customers where owner_name is not null and owner_name <> ''
on conflict do nothing;
insert into sales_reps (name) values ('柴田') on conflict do nothing;

-- RLS: 社内ツールなので authenticated に全許可(init_schema と同方針)
alter table sales_reps enable row level security;
create policy "authenticated_all" on sales_reps for all to authenticated using (true) with check (true);
