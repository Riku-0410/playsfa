-- 請求書のステータスを「未送付 → 送付済 → 入金済」(+期限超過・無効)に簡素化
-- 予定(scheduled)と発行済(issued)は「未送付(unsent)」に統合。請求番号は送付時に採番する
-- 期限超過は送付済のまま期限を過ぎたものだけ。送付記録のない期限超過は未送付に戻す
-- 付いている請求番号はそのまま残す

alter type invoice_status rename to invoice_status_old;
create type invoice_status as enum ('unsent', 'sent', 'paid', 'overdue', 'void');

alter table invoices alter column status drop default;
alter table invoices
  alter column status type invoice_status
  using (
    case
      when status::text in ('scheduled', 'issued') then 'unsent'
      when status::text = 'overdue' and sent_at is null then 'unsent'
      else status::text
    end
  )::invoice_status;
alter table invoices alter column status set default 'unsent';

drop type invoice_status_old;
