-- トライアル終了日を過ぎても放置している理由(ダッシュボードの「トライアル終了間近」から直接書く)。
-- 商談の汎用メモ(note)とは分ける。記入日時も残して、古い理由かどうか分かるようにする
alter table deals
  add column trial_overdue_reason text,
  add column trial_overdue_reason_at timestamptz;
