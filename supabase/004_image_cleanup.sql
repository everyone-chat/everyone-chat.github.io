-- =========================================================
-- 4차: 메시지가 어떤 방법으로 지워지든 사진 파일도 반드시 삭제
-- (개별 삭제 / 마스터 전체 삭제 / 200개 초과 자동 정리 모두 해당)
-- 003_photos_clear.sql 실행 후에 실행. 여러 번 실행해도 안전함
-- =========================================================

-- 1) 지워야 할 사진 목록 (외부에서 직접 못 봄)
create table if not exists public.pending_image_deletes (
  path       text primary key,
  created_at timestamptz not null default now()
);
alter table public.pending_image_deletes enable row level security;
revoke all on public.pending_image_deletes from anon, authenticated;

-- 2) 메시지가 지워지는 순간 사진 경로를 목록에 올림
create or replace function public.queue_image_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.image_path is not null then
    insert into public.pending_image_deletes (path) values (old.image_path)
    on conflict (path) do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists messages_queue_image_delete on public.messages;
create trigger messages_queue_image_delete
  after delete on public.messages
  for each row execute function public.queue_image_delete();

-- 3) 목록에 있는 사진인지 확인 (저장소 삭제 권한 판단용)
create or replace function public.is_pending_image_delete(p_path text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.pending_image_deletes where path = p_path);
$$;

-- 4) 접속한 멤버의 앱이 목록을 받아 파일을 지우고, 실제로 지워진 것만 목록에서 뺌
create or replace function public.list_pending_image_deletes()
returns setof text
language sql stable security definer
set search_path = ''
as $$
  select path from public.pending_image_deletes
  where public.is_member()
  order by created_at
  limit 500;
$$;

create or replace function public.ack_image_deletes()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_member() then
    return;
  end if;
  delete from public.pending_image_deletes p
  where not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'chat-images' and o.name = p.path
  );
end;
$$;

revoke all on function public.is_pending_image_delete(text) from public, anon;
revoke all on function public.list_pending_image_deletes() from public, anon;
revoke all on function public.ack_image_deletes() from public, anon;
grant execute on function public.is_pending_image_delete(text) to authenticated;
grant execute on function public.list_pending_image_deletes() to authenticated;
grant execute on function public.ack_image_deletes() to authenticated;

-- 5) 저장소 삭제 권한: 본인 사진, 마스터, 또는 "지워야 할 목록"에 오른 사진은 멤버 누구나
drop policy if exists "chat_images_delete" on storage.objects;
create policy "chat_images_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (
      ((storage.foldername(name))[1] = auth.uid()::text and public.is_member())
      or public.is_admin()
      or (public.is_member() and public.is_pending_image_delete(name))
    )
  );

-- 6) 이미 메시지 없이 남아 있는 사진도 목록에 올려서 정리
insert into public.pending_image_deletes (path)
select o.name from storage.objects o
where o.bucket_id = 'chat-images'
  and not exists (select 1 from public.messages m where m.image_path = o.name)
on conflict (path) do nothing;
