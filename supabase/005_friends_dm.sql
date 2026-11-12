-- =========================================================
-- 5차: 친구 코드로 친구 추가 + 친구끼리만 보이기 + 1:1 대화
-- 004_image_cleanup.sql 실행 후에 실행. 여러 번 실행해도 안전함
-- 주의: 기존 공용 채팅방 메시지(와 사진)는 삭제됨
-- =========================================================

-- 1) 친구 코드 (처음엔 자동 6자리, 각자 원하는 코드로 변경 가능. 대소문자 구분 없이 중복 불가)
alter table public.profiles add column if not exists friend_code text;
update public.profiles set friend_code = upper(substr(md5(gen_random_uuid()::text), 1, 6)) where friend_code is null;
alter table public.profiles alter column friend_code set default upper(substr(md5(gen_random_uuid()::text), 1, 6));
alter table public.profiles alter column friend_code set not null;
drop index if exists public.profiles_friend_code_key;
create unique index if not exists profiles_friend_code_lower_key on public.profiles (lower(friend_code));

-- 2) 친구 관계 (두 사람 ID를 작은 쪽이 user_a가 되게 저장)
create table if not exists public.friendships (
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

drop policy if exists "friendships_read" on public.friendships;
create policy "friendships_read" on public.friendships
  for select to authenticated
  using (auth.uid() in (user_a, user_b) and public.is_member());

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

-- 친구 코드로 친구 추가 (코드를 아는 사람끼리 바로 서로 친구가 됨)
create or replace function public.add_friend(p_code text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not public.is_member() then
    raise exception 'not_member';
  end if;
  select id into target from public.profiles
  where lower(friend_code) = lower(trim(p_code)) and approved;
  if target is null then
    raise exception 'not_found';
  end if;
  if target = auth.uid() then
    raise exception 'self';
  end if;
  insert into public.friendships (user_a, user_b)
  values (least(auth.uid(), target), greatest(auth.uid(), target))
  on conflict do nothing;
  return target;
end;
$$;

-- 친구 끊기: 둘의 대화(와 사진)도 함께 삭제
create or replace function public.remove_friend(p_user uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.messages
  where room_a = least(auth.uid(), p_user) and room_b = greatest(auth.uid(), p_user);
  delete from public.friendships
  where user_a = least(auth.uid(), p_user) and user_b = greatest(auth.uid(), p_user);
end;
$$;

-- 내 친구 코드 직접 정하기 (한글·영문·숫자·-·_ 2~16자)
drop function if exists public.renew_friend_code();
create or replace function public.set_friend_code(p_code text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  code text := trim(p_code);
begin
  if not public.is_member() then
    raise exception 'not_member';
  end if;
  if code !~ '^[0-9A-Za-z가-힣_-]{2,16}$' then
    raise exception 'invalid_code';
  end if;
  if exists (select 1 from public.profiles where lower(friend_code) = lower(code) and id <> auth.uid()) then
    raise exception 'taken';
  end if;
  update public.profiles set friend_code = code where id = auth.uid();
  return code;
exception
  when unique_violation then
    raise exception 'taken';
end;
$$;

-- 3) 프로필은 나 / 내 친구만 보임 (마스터는 관리용으로 전체 멤버를 봄)
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.is_member() and (public.is_admin() or public.are_friends(auth.uid(), id)))
  );

-- 4) 메시지를 1:1 대화방 단위로 (room_a < room_b 두 사람)
alter table public.messages add column if not exists room_a uuid references public.profiles (id) on delete cascade;
alter table public.messages add column if not exists room_b uuid references public.profiles (id) on delete cascade;
delete from public.messages where room_a is null or room_b is null;  -- 기존 공용방 메시지 정리
alter table public.messages alter column room_a set not null;
alter table public.messages alter column room_b set not null;
alter table public.messages drop constraint if exists messages_room_order;
alter table public.messages add constraint messages_room_order check (room_a < room_b);
create index if not exists messages_room_idx on public.messages (room_a, room_b, id desc);

drop policy if exists "messages_read" on public.messages;
create policy "messages_read" on public.messages
  for select to authenticated
  using (
    public.is_member()
    and auth.uid() in (room_a, room_b)
    and public.are_friends(room_a, room_b)
  );

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member()
    and auth.uid() in (room_a, room_b)
    and public.are_friends(room_a, room_b)
    and (image_path is null or split_part(image_path, '/', 1) = auth.uid()::text)
  );

-- 내 메시지는 내가, 마스터는 자기가 속한 대화의 메시지를 지울 수 있음
drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages
  for delete to authenticated
  using (
    (user_id = auth.uid() and public.is_member())
    or (public.is_admin() and auth.uid() in (room_a, room_b))
  );

-- 대화방마다 최근 200개만 보관
drop trigger if exists trim_messages_after_insert on public.messages;
create or replace function public.trim_messages()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.messages
  where room_a = new.room_a and room_b = new.room_b
    and id < (
      select id from public.messages
      where room_a = new.room_a and room_b = new.room_b
      order by id desc offset 199 limit 1
    );
  return null;
end;
$$;
create trigger trim_messages_after_insert
  after insert on public.messages
  for each row execute function public.trim_messages();

-- 마스터 전체 삭제는 "지금 대화방" 단위로
drop function if exists public.clear_messages();
create or replace function public.clear_conversation(p_peer uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  delete from public.messages
  where room_a = least(auth.uid(), p_peer) and room_b = greatest(auth.uid(), p_peer);
end;
$$;

-- 5) 사진은 그 대화에 속한 두 사람만 볼 수 있음
create or replace function public.can_view_image(p_path text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select split_part(p_path, '/', 1) = auth.uid()::text
      or exists (
        select 1 from public.messages m
        where m.image_path = p_path
          and auth.uid() in (m.room_a, m.room_b)
          and public.are_friends(m.room_a, m.room_b)
      );
$$;

drop policy if exists "chat_images_read" on storage.objects;
create policy "chat_images_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images' and public.is_member() and public.can_view_image(name));

-- 6) 권한 정리
revoke all on function public.are_friends(uuid, uuid) from public, anon;
revoke all on function public.add_friend(text) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.set_friend_code(text) from public, anon;
revoke all on function public.clear_conversation(uuid) from public, anon;
revoke all on function public.can_view_image(text) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.set_friend_code(text) to authenticated;
grant execute on function public.clear_conversation(uuid) to authenticated;
grant execute on function public.can_view_image(text) to authenticated;

-- 7) 친구 추가/끊기도 실시간 반영
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
