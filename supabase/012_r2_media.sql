-- =========================================================
-- 12차: 사진·동영상을 Cloudflare R2(무료 10GB)로 (worker/media-worker.js)
-- 새 파일 경로: <사용자 id>/r2/<무작위>.<확장자>  (기존 Supabase 사진은 그대로)
-- 여러 번 실행해도 안전함
-- =========================================================

-- R2 파일은 Supabase 저장소 목록에 없으므로, Worker가 실제로 지운 뒤에만 정리 목록에서 뺌
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
  where p.path not like '%/r2/%'
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'chat-images' and o.name = p.path
    );
end;
$$;

create or replace function public.ack_media_delete(p_path text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_member() then
    return;
  end if;
  delete from public.pending_image_deletes where path = p_path and path like '%/r2/%';
end;
$$;

revoke all on function public.ack_media_delete(text) from public, anon;
grant execute on function public.ack_media_delete(text) to authenticated;

-- Worker가 쓰는 확인 함수 (이미 있으면 권한만 확인)
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_pending_image_delete(text) to authenticated;
