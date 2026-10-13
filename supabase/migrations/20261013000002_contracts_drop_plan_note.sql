-- 契約の項目整理: プラン名とメモを廃止(税率は10%固定、列は請求計算用に残す)
-- 入力済みのメモ(更新履歴を含む)は活動ログへ移す。以後の更新履歴も活動ログに書く

insert into activities (customer_id, deal_id, type, content, occurred_at)
select customer_id, deal_id, 'memo', note, created_at
from contracts
where note is not null and btrim(note) <> '';

alter table contracts
  drop column plan_name,
  drop column note;
