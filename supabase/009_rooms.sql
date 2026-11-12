-- =========================================================
-- 9차: 방 꾸미기 저장 (내 방은 나만 읽고 쓸 수 있음)
-- 008_privacy.sql 실행 후에 실행. 여러 번 실행해도 안전함
-- =========================================================
create table if not exists public.rooms (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint rooms_data_size check (pg_column_size(data) < 20000)
);

alter table public.rooms enable row level security;
revoke all on public.rooms from anon, authenticated;
grant select, insert, update on public.rooms to authenticated;

drop policy if exists "rooms_read_own" on public.rooms;
create policy "rooms_read_own" on public.rooms
  for select to authenticated
  using (user_id = auth.uid() and public.is_member());

drop policy if exists "rooms_insert_own" on public.rooms;
create policy "rooms_insert_own" on public.rooms
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());

drop policy if exists "rooms_update_own" on public.rooms;
create policy "rooms_update_own" on public.rooms
  for update to authenticated
  using (user_id = auth.uid() and public.is_member())
  with check (user_id = auth.uid());
