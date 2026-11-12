-- =========================================================
-- 8차: 마스터를 빼고는 누가 사이트를 쓰는지 서로 알 수 없게 보강
-- 1) 친구 관계 실시간 알림이 관계없는 사람에게까지 가던 경로 차단
-- 2) 지운 사진 정리 목록이 다른 사람의 ID를 노출하던 경로 차단
-- 3) 친구 코드 무작위 대입으로 사람을 찾아내는 것 방지 (10분에 10번 실패 시 잠금)
-- 007_invite_code.sql 실행 후에 실행. 여러 번 실행해도 안전함
-- =========================================================

-- 1) friendships 실시간 중단 → 대신 본인 프로필의 friends_rev 값이 바뀌면 앱이 다시 불러옴
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and tablename = 'friendships') then
    alter publication supabase_realtime drop table public.friendships;
  end if;
end $$;

alter table public.profiles add column if not exists friends_rev integer not null default 0;
-- (friends_rev는 본인도 직접 못 바꿈: update 권한이 없는 칸)

-- 3) 친구 추가 실패 기록 (외부 접근 불가한 private 스키마)
create table if not exists private.friend_attempts (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists friend_attempts_user_at on private.friend_attempts (user_id, at);

-- 못 찾으면 오류 대신 null을 돌려줌 (실패 기록이 남도록)
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
  if (select count(*) from private.friend_attempts
      where user_id = auth.uid() and at > now() - interval '10 minutes') >= 10 then
    raise exception 'too_many';
  end if;

  select id into target from public.profiles
  where lower(friend_code) = lower(trim(p_code)) and approved;

  if target is null then
    insert into private.friend_attempts (user_id) values (auth.uid());
    delete from private.friend_attempts where at < now() - interval '1 day';
    return null;
  end if;
  if target = auth.uid() then
    raise exception 'self';
  end if;

  insert into public.friendships (user_a, user_b)
  values (least(auth.uid(), target), greatest(auth.uid(), target))
  on conflict do nothing;
  update public.profiles set friends_rev = friends_rev + 1 where id in (auth.uid(), target);
  return target;
end;
$$;

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
  update public.profiles set friends_rev = friends_rev + 1 where id in (auth.uid(), p_user);
end;
$$;

revoke all on function public.add_friend(text) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

-- 2) 지운 사진 목록에 대화방 정보를 같이 저장하고, 그 대화의 두 사람(과 마스터)에게만 보여줌
alter table public.pending_image_deletes add column if not exists room_a uuid;
alter table public.pending_image_deletes add column if not exists room_b uuid;

create or replace function public.queue_image_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.image_path is not null then
    insert into public.pending_image_deletes (path, room_a, room_b)
    values (old.image_path, old.room_a, old.room_b)
    on conflict (path) do nothing;
  end if;
  return null;
end;
$$;

create or replace function public.can_delete_pending(p_path text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pending_image_deletes p
    where p.path = p_path
      and (
        auth.uid() in (p.room_a, p.room_b)
        or split_part(p.path, '/', 1) = auth.uid()::text
        or public.is_admin()
      )
  );
$$;

create or replace function public.list_pending_image_deletes()
returns setof text
language sql stable security definer
set search_path = ''
as $$
  select p.path from public.pending_image_deletes p
  where public.is_member()
    and (
      auth.uid() in (p.room_a, p.room_b)
      or split_part(p.path, '/', 1) = auth.uid()::text
      or public.is_admin()
    )
  order by p.created_at
  limit 500;
$$;

revoke all on function public.can_delete_pending(text) from public, anon;
revoke all on function public.list_pending_image_deletes() from public, anon;
grant execute on function public.can_delete_pending(text) to authenticated;
grant execute on function public.list_pending_image_deletes() to authenticated;

drop policy if exists "chat_images_delete" on storage.objects;
create policy "chat_images_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (
      ((storage.foldername(name))[1] = auth.uid()::text and public.is_member())
      or public.is_admin()
      or (public.is_member() and public.can_delete_pending(name))
    )
  );

-- 예전 함수는 정책 교체 뒤에 삭제
drop function if exists public.is_pending_image_delete(text);
