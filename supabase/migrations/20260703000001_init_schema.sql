-- playsfa 初期スキーマ
-- 顧客ライフサイクル: リード → トライアル(無償) → 契約合意 → 課金待ち(競合切れ待ち) → 課金開始 → 1年契約 → 更新/解約

create extension if not exists "pgcrypto";

-- enums(冪等)
do $$ begin
  create type service_tag as enum ('playcut', 'baskestats');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deal_stage as enum ('lead', 'contacted', 'trial', 'negotiation', 'won', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type billing_cycle as enum ('semiannual', 'annual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contract_status as enum ('pending', 'active', 'ended', 'churned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('scheduled', 'issued', 'sent', 'paid', 'overdue', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_type as enum ('call', 'email', 'meeting', 'memo', 'task');
exception when duplicate_object then null; end $$;

-- 取引先(チーム・学校・企業)
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_kana text,
  org_type text,
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_name text,    -- 請求先名。空なら name を使う
  billing_email text,
  billing_address text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 商談。トライアルはステージの1つ(無償)
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  service service_tag not null,
  stage deal_stage not null default 'lead',
  title text,
  amount_expected integer,          -- 年間見込額(税抜)
  trial_start date,
  trial_end date,
  competitor text,
  competitor_expiry date,           -- 競合の契約期限 = 課金開始月の根拠
  expected_billing_start date,
  lost_reason text,
  closed_at date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 契約。合意日と課金開始日は別。pending = 契約済み課金待ち
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  service service_tag not null,
  plan_name text,
  billing_cycle billing_cycle not null,
  amount_per_billing integer not null, -- 1回の請求額(税抜)。年払いなら年額、半期払いなら半年分
  tax_rate numeric not null default 10,
  agreement_date date not null,
  billing_start_date date not null,
  term_months integer not null default 12,
  status contract_status not null default 'pending',
  churned_at date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 請求書。契約作成時に契約期間分を scheduled で先行生成する
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  invoice_number text unique,
  period_start date not null,
  period_end date not null,
  issue_date date not null,
  due_date date not null,
  subtotal integer not null,
  tax_amount integer not null,
  total integer not null,
  status invoice_status not null default 'scheduled',
  sent_at timestamptz,
  paid_at date,
  pdf_path text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 入金。請求書に消込
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount integer not null,
  paid_on date not null,
  method text not null default 'bank_transfer',
  payer_name text,   -- 振込名義(将来のCSV自動消込用)
  memo text,
  created_at timestamptz not null default now()
);

-- 活動ログ。AIレイヤーの書き込み先にもなる
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  type activity_type not null default 'memo',
  content text not null,
  occurred_at timestamptz not null default now(),
  next_action text,
  next_action_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- 自社情報(請求書テンプレート用・1行のみ)
create table if not exists company_settings (
  id integer primary key default 1 check (id = 1),
  company_name text,
  invoice_registration_number text, -- 適格請求書発行事業者登録番号(T+13桁)
  address text,
  bank_account text,
  invoice_note text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_deals_customer on deals(customer_id);
create index if not exists idx_deals_stage on deals(stage);
create index if not exists idx_contracts_customer on contracts(customer_id);
create index if not exists idx_contracts_status on contracts(status, billing_start_date);
create index if not exists idx_invoices_contract on invoices(contract_id);
create index if not exists idx_invoices_status_issue on invoices(status, issue_date);
create index if not exists idx_activities_customer on activities(customer_id);
create index if not exists idx_activities_next_action on activities(next_action_date) where not done;

-- RLS: 社内ツールなので authenticated に全許可
do $$
declare t text;
begin
  foreach t in array array['customers','deals','contracts','invoices','payments','activities','company_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on %I', t);
    execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
