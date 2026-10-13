-- 商談の項目整理
-- 1. タイトルを廃止。入力済みのタイトルはメモとして使われていたので活動ログへ移す
-- 2. 競合の契約期限を課金開始予定に統合。課金開始予定が空なら競合の契約期限を引き継ぐ

insert into activities (customer_id, deal_id, type, content, occurred_at)
select customer_id, id, 'memo', title, created_at
from deals
where title is not null and btrim(title) <> '';

-- データ移行で更新日が動かないように
alter table deals disable trigger trg_deals_updated_at;

update deals
set expected_billing_start = competitor_expiry
where expected_billing_start is null and competitor_expiry is not null;

alter table deals enable trigger trg_deals_updated_at;

alter table deals
  drop column title,
  drop column competitor_expiry;
