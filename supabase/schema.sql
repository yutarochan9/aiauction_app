-- =============================================
-- AIオークション マーケットプレイス スキーマ
-- =============================================

-- usersテーブル（Supabase Authのauth.usersと連携）
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  bio text,
  sns_verified boolean not null default false,
  sns_url text,
  sns_verification_code text,
  created_at timestamptz not null default now()
);

-- artworksテーブル
create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title_ja text not null,
  title_en text not null,
  description_ja text,
  description_en text,
  -- 低解像度・透かし入りのパス（公開）
  image_url text,
  -- 高解像度オリジナルのパス（非公開ストレージ）
  original_storage_path text,
  starting_price numeric(10,2) not null,
  current_price numeric(10,2) not null,
  end_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'ended', 'sold')),
  created_at timestamptz not null default now()
);

-- bidsテーブル
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- purchasesテーブル
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id),
  buyer_id uuid not null references public.users(id),
  seller_id uuid not null references public.users(id),
  amount numeric(10,2) not null,
  stripe_payment_id text,
  -- 購入者固有ID（透かし用）
  buyer_unique_id text,
  download_url text,
  download_expires_at timestamptz,
  -- 落札者の一言コメント（任意）
  comment text,
  created_at timestamptz not null default now()
);

-- =============================================
-- RLS（Row Level Security）ポリシー
-- =============================================

alter table public.users enable row level security;
alter table public.artworks enable row level security;
alter table public.bids enable row level security;
alter table public.purchases enable row level security;

-- users: 誰でも閲覧可、自分のみ更新可
create policy "users_select" on public.users for select using (true);
create policy "users_insert" on public.users for insert with check (auth.uid() = id);
create policy "users_update" on public.users for update using (auth.uid() = id);

-- artworks: 誰でも閲覧可、自分のみ作成・更新可
create policy "artworks_select" on public.artworks for select using (true);
create policy "artworks_insert" on public.artworks for insert with check (auth.uid() = user_id);
create policy "artworks_update" on public.artworks for update using (auth.uid() = user_id);

-- bids: 誰でも閲覧可、ログイン済みユーザーのみ作成可
create policy "bids_select" on public.bids for select using (true);
create policy "bids_insert" on public.bids for insert with check (auth.uid() = user_id);

-- purchases: 購入者・出品者のみ閲覧可
create policy "purchases_select" on public.purchases
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "purchases_insert" on public.purchases
  for insert with check (auth.uid() = buyer_id);

-- =============================================
-- ストレージバケット
-- =============================================

-- 公開バケット（低解像度・透かし入り画像）
insert into storage.buckets (id, name, public)
values ('artwork-previews', 'artwork-previews', true);

-- 非公開バケット（高解像度オリジナル）
insert into storage.buckets (id, name, public)
values ('artwork-originals', 'artwork-originals', false);

-- artwork-previewsのRLS
create policy "previews_select" on storage.objects
  for select using (bucket_id = 'artwork-previews');
create policy "previews_insert" on storage.objects
  for insert with check (bucket_id = 'artwork-previews' and auth.role() = 'authenticated');

-- artwork-originalsのRLS（認証済みユーザーのみアップロード、ダウンロードはサーバーサイドのみ）
create policy "originals_insert" on storage.objects
  for insert with check (bucket_id = 'artwork-originals' and auth.role() = 'authenticated');

-- =============================================
-- トリガー: 新規ユーザー登録時にusersテーブルに自動挿入
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- インデックス
-- =============================================
create index artworks_status_end_at on public.artworks(status, end_at);
create index artworks_user_id on public.artworks(user_id);
create index bids_artwork_id on public.bids(artwork_id);
create index bids_user_id on public.bids(user_id);
