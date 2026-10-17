-- 商談ステージ「トライアル予定」と、トライアル予定月(月初日で保持)
-- ダッシュボードのトライアル目標で「見込み」として数える
alter type deal_stage add value if not exists 'trial_planned' before 'trial';
alter table deals add column trial_planned_month date;
