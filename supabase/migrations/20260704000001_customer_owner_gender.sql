-- 顧客の担当者を先方/弊社で分離 + 男女カテゴリを追加
-- contact_name は「先方担当者」の意味のまま残し、弊社側は owner_name に持つ

do $$ begin
  create type gender_category as enum ('mens', 'womens', 'mixed');
exception when duplicate_object then null; end $$;

alter table customers
  add column if not exists owner_name text,           -- 弊社側の担当者
  add column if not exists gender gender_category;    -- 男女カテゴリ(男子/女子/混合)
