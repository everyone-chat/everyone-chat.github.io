-- =========================================================
-- 2차: 마스터 권한, 내보내기, 메시지 삭제, 채팅방 나가기
-- setup.sql 실행 후에 실행. 여러 번 실행해도 안전함
-- =========================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists banned   boolean not null default false;
-- (is_admin, banned 칸은 본인도 직접 못 바꿈: update 권한은 nickname·emoji·color·status·last_seen에만 있음)

-- 마스터 코드: 저장소가 공개라서 실제 코드는 여기 적지 말 것
insert into private.settings (key, value) values ('admin_code', '여기에-마스터코드')
on conflict (key) do update set value = excluded.value;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approved and is_admin
  );
$$;

-- 마스터 코드를 입력하면 본인을 마스터로 지정
create or replace function public.claim_admin(p_code text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.settings where key = 'admin_code' and value = trim(p_code)) then
    return false;
  end if;
  update public.profiles set is_admin = true where id = auth.uid() and approved;
  return found;
end;
$$;

-- 마스터가 친구 내보내기 (다시 같은 브라우저로 못 들어옴)
create or replace function public.kick_member(p_user uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_kick_self';
  end if;
  update public.profiles
     set approved = false, banned = true
   where id = p_user and not is_admin;
end;
$$;

-- 본인이 채팅방 나가기 (메시지는 남고, 다시 입장 코드로 들어올 수 있음)
create or replace function public.leave_community()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles
     set approved = false, is_admin = false
   where id = auth.uid();
end;
$$;

-- 가입 함수: 내보내진 사람은 다시 못 들어오게
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
  if exists (select 1 from public.profiles where id = auth.uid() and banned) then
    raise exception 'banned';
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

revoke all on function public.claim_admin(text) from public, anon;
revoke all on function public.kick_member(uuid) from public, anon;
revoke all on function public.leave_community() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.claim_admin(text) to authenticated;
grant execute on function public.kick_member(uuid) to authenticated;
grant execute on function public.leave_community() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 메시지 삭제: 내 메시지는 내가, 모든 메시지는 마스터가
grant delete on public.messages to authenticated;

drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages
  for delete to authenticated
  using ((user_id = auth.uid() and public.is_member()) or public.is_admin());
