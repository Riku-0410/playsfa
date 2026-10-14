-- 更新は「前の契約を満了にして新しい契約を作る」運用。新しい契約から前の契約をたどれるようにする
alter table contracts
  add column previous_contract_id uuid references contracts(id) on delete set null;

create index if not exists idx_contracts_previous on contracts(previous_contract_id);
