-- 請求書を顧客単位にし、契約との紐づけを明細行に移す。
-- 同じ顧客の複数契約(playcut + baskestats など)を1枚の請求書にまとめられるようにするため。
--   invoices.contract_id  → 廃止(請求書がどの契約かは明細から辿る)
--   invoice_items.contract_id / period_start / period_end → 追加(利用料行は契約と請求期間を持つ。費用行は期間null)
--   invoices.tax_rate → 追加(これまで契約から引いていた税率を請求書自身が持つ)

alter table invoice_items
  add column if not exists contract_id uuid references contracts(id) on delete set null,
  add column if not exists period_start date,
  add column if not exists period_end date;

alter table invoices
  add column if not exists tax_rate numeric not null default 10;

-- 既存データの移送: 明細に契約IDを、利用料行には請求書の期間を入れる
update invoice_items it
set contract_id = i.contract_id,
    period_start = case when it.description like '利用料 (%' then i.period_start end,
    period_end   = case when it.description like '利用料 (%' then i.period_end end
from invoices i
where i.id = it.invoice_id;

update invoices i
set tax_rate = c.tax_rate
from contracts c
where c.id = i.contract_id;

-- 未発行の利用料行はサービス名付きの新しい書式に揃える(発行済みの票面は変えない)
update invoice_items it
set description = c.service::text || ' ' || it.description
from invoices i, contracts c
where i.id = it.invoice_id
  and c.id = it.contract_id
  and i.status = 'scheduled'
  and it.description like '利用料 (%';

create index if not exists idx_invoice_items_contract on invoice_items(contract_id);

drop index if exists idx_invoices_contract;
alter table invoices drop column if exists contract_id;
