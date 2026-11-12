-- =========================================================
-- 3차: 사진 전송 + 마스터 채팅 전체 삭제
-- 002_admin.sql 실행 후에 실행. 여러 번 실행해도 안전함
-- =========================================================

-- 1) 메시지에 사진 경로 칸 추가 (글 없이 사진만 보내도 됨)
alter table public.messages add column if not exists image_path text;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check (
  char_length(content) <= 500
  and (char_length(content) > 0 or image_path is not null)
);

-- 사진 경로는 반드시 본인 폴더(내 사용자 ID/...)여야 보낼 수 있음
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member()
    and (image_path is null or split_part(image_path, '/', 1) = auth.uid()::text)
  );

-- 2) 사진 저장소: 비공개 (멤버만 볼 수 있음), 1장 최대 5MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat_images_read" on storage.objects;
create policy "chat_images_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images' and public.is_member());

drop policy if exists "chat_images_upload" on storage.objects;
create policy "chat_images_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and public.is_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat_images_delete" on storage.objects;
create policy "chat_images_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (((storage.foldername(name))[1] = auth.uid()::text and public.is_member()) or public.is_admin())
  );

-- 3) 마스터: 채팅 전체 삭제 (지운 사진 경로를 돌려줘서 화면에서 파일도 정리)
create or replace function public.clear_messages()
returns setof text
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  return query
    delete from public.messages where id is not null
    returning image_path;
end;
$$;

revoke all on function public.clear_messages() from public, anon;
grant execute on function public.clear_messages() to authenticated;
