-- =========================================================
-- 본디 웹: DB 세팅 (Supabase SQL Editor에 통째로 붙여넣고 Run)
-- 여러 번 실행해도 안전하도록 작성됨
-- =========================================================

-- 1) 입장 코드: API로 노출되지 않는 private 스키마에 보관
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);

-- 입장 코드: 저장소가 공개라서 실제 코드는 여기 적지 말 것.
-- 실행 전에 '여기에-입장코드'를 원하는 코드로 바꿔서 실행 (공개 저장소에는 올리지 않음)
insert into private.settings (key, value) values ('invite_code', '여기에-입장코드')
on conflict (key) do update set value = excluded.value;

-- 2) 프로필
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 12),
  emoji      text not null default '🐻',
  color      text not null default '#FFD6E0',
  status     text not null default 'rest',
  approved   boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

-- 3) 채팅 메시지
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_created_at_idx on public.messages (created_at desc);

-- 4) 승인된 멤버인지 확인 (RLS 안에서 사용)
create or replace function public.is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approved
  );
$$;

-- 5) 입장 코드 확인 (코드 자체는 절대 돌려주지 않음)
create or replace function public.verify_invite(p_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.settings
    where key = 'invite_code' and value = trim(p_code)
  );
$$;

-- 6) 커뮤니티 가입: 코드가 맞을 때만 프로필 생성 + 승인
create or replace function public.join_community(
  p_code text, p_nickname text, p_emoji text, p_color text
)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if not public.verify_invite(p_code) then
    raise exception 'invalid_code';
  end if;

  insert into public.profiles (id, nickname, emoji, color, approved)
  values (auth.uid(), trim(p_nickname), p_emoji, p_color, true)
  on conflict (id) do update
    set nickname = excluded.nickname,
        emoji    = excluded.emoji,
        color    = excluded.color,
        approved = true
  returning * into result;

  return result;
end;
$$;

revoke all on function public.verify_invite(text) from public, anon;
revoke all on function public.join_community(text, text, text, text) from public, anon;
grant execute on function public.verify_invite(text) to authenticated;
grant execute on function public.join_community(text, text, text, text) to authenticated;
grant execute on function public.is_member() to authenticated;

-- 7) 보안 정책 (RLS)
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- 비로그인(anon)은 아무것도 못 함
revoke all on public.profiles from anon;
revoke all on public.messages from anon;

-- 프로필: 직접 추가 불가(가입 함수로만), 승인 여부(approved)는 본인도 못 바꿈
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, emoji, color, status, last_seen) on public.profiles to authenticated;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_member());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.is_member())
  with check (id = auth.uid());

-- 메시지: 멤버만 읽기/쓰기, 남의 이름으로 쓰기 불가, 수정·삭제 불가
revoke update, delete on public.messages from authenticated;
grant select, insert on public.messages to authenticated;

drop policy if exists "messages_read" on public.messages;
create policy "messages_read" on public.messages
  for select to authenticated
  using (public.is_member());

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());

-- 8) 최근 200개만 보관 (무료 용량 관리)
create or replace function public.trim_messages()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.messages
  where id < (
    select id from public.messages order by id desc offset 199 limit 1
  );
  return null;
end;
$$;

drop trigger if exists trim_messages_after_insert on public.messages;
create trigger trim_messages_after_insert
  after insert on public.messages
  for each statement execute function public.trim_messages();

-- 9) 실시간 전송 켜기
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
