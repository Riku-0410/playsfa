-- 商談ステージの変更履歴。
-- トライアル獲得KPIは deals.trial_start の日付ベースで集計しているため、
-- ステージが「トライアル中」→「成約」に進んでもカウントは消えない設計。
-- ただし trial_start を入力せずステージだけ進めると集計から漏れるので、
-- トライアル入りの瞬間に trial_start を自動で埋めるトリガーも併設する。

create table if not exists deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  stage deal_stage not null,
  previous_stage deal_stage,  -- null = 商談作成時の初期ステージ
  changed_at timestamptz not null default now()
);

create index if not exists idx_deal_stage_history_deal
  on deal_stage_history(deal_id, changed_at);

alter table deal_stage_history enable row level security;
drop policy if exists "authenticated_all" on deal_stage_history;
create policy "authenticated_all" on deal_stage_history
  for all to authenticated using (true) with check (true);

-- トライアル入りで trial_start 未入力なら当日(JST)を自動セット
create or replace function set_trial_start_on_stage() returns trigger
language plpgsql as $$
begin
  if new.stage = 'trial' and new.trial_start is null then
    new.trial_start := (now() at time zone 'Asia/Tokyo')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_deals_set_trial_start on deals;
create trigger trg_deals_set_trial_start
  before insert or update of stage on deals
  for each row execute function set_trial_start_on_stage();

-- ステージ変更を履歴に記録(insert時は初期ステージも記録)
create or replace function record_deal_stage_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.stage = old.stage then
    return null;
  end if;
  insert into deal_stage_history (deal_id, stage, previous_stage)
  values (new.id, new.stage, case when tg_op = 'UPDATE' then old.stage end);
  return null;
end;
$$;

drop trigger if exists trg_deals_stage_history on deals;
create trigger trg_deals_stage_history
  after insert or update of stage on deals
  for each row execute function record_deal_stage_change();

-- 既存商談のバックフィル: 現在ステージをスナップショットとして1行入れる
-- (正確な遷移時刻は不明なので changed_at は created_at で代用)
insert into deal_stage_history (deal_id, stage, changed_at)
select d.id, d.stage, d.created_at
from deals d
where not exists (
  select 1 from deal_stage_history h where h.deal_id = d.id
);
