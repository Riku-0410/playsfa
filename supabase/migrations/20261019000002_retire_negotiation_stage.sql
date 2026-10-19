-- 「商談中」ステージを廃止し、トライアル中にまとめる。
-- enum値は履歴(deal_stage_history)の表示のために残し、商談には使えないよう制約で止める。

-- 移行で trial_start が今日で埋まると今月のトライアル実績に数えてしまうので、自動セットを止めて移す
alter table deals disable trigger trg_deals_set_trial_start;
update deals set stage = 'trial' where stage = 'negotiation';
alter table deals enable trigger trg_deals_set_trial_start;

alter table deals add constraint deals_stage_not_negotiation check (stage <> 'negotiation');
