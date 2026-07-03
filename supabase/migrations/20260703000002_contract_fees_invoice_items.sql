-- 契約の追加費用(初期費用・年間費用)と請求書明細行

-- 契約に紐づく費用。利用料(amount_per_billing)以外のもの
create table if not exists contract_fees (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  description text not null,
  amount integer not null, -- 税抜
  recurring boolean not null default false, -- true: 契約更新後も毎年かかる / false: 初回契約のみ
  created_at timestamptz not null default now()
);

-- 請求書の明細行。invoices の subtotal/tax/total は明細の合計(非正規化)
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  amount integer not null, -- 税抜
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_fees_contract on contract_fees(contract_id);
create index if not exists idx_invoice_items_invoice on invoice_items(invoice_id);

do $$
declare t text;
begin
  foreach t in array array['contract_fees','invoice_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on %I', t);
    execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
