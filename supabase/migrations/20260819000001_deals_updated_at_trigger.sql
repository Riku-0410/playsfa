create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_deals_updated_at on deals;
create trigger trg_deals_updated_at
  before update on deals
  for each row execute function set_updated_at();
