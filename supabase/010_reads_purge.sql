-- =========================================================
-- 10차: 읽음 표시 + 마스터의 내보낸 멤버 영구 삭제
-- 여러 번 실행해도 안전함
-- =========================================================

-- 1) 읽음 기록: "나는 이 친구와의 대화를 몇 번 메시지까지 읽었다"
create table if not exists public.chat_reads (
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  peer_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_id bigint not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, peer_id)
);
alter table public.chat_reads enable row level security;
revoke all on public.chat_reads from anon;
grant select, insert, update on public.chat_reads to authenticated;

-- 내 기록, 그리고 친구가 "나와의 대화"를 어디까지 읽었는지만 보임
drop policy if exists "chat_reads_select" on public.chat_reads;
create policy "chat_reads_select" on public.chat_reads
  for select to authenticated
  using (user_id = auth.uid() or (peer_id = auth.uid() and public.are_friends(user_id, auth.uid())));

drop policy if exists "chat_reads_insert" on public.chat_reads;
create policy "chat_reads_insert" on public.chat_reads
  for insert to authenticated
  with check (user_id = auth.uid() and public.are_friends(auth.uid(), peer_id));

drop policy if exists "chat_reads_update" on public.chat_reads;
create policy "chat_reads_update" on public.chat_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_reads') then
    alter publication supabase_realtime add table public.chat_reads;
  end if;
end $$;
alter table public.chat_reads replica identity full;

-- 2) 마스터: 내보낸 멤버 영구 삭제 (계정·프로필·대화·사진·방 전부)
--    사진은 메시지 삭제 트리거(004)가 정리 목록에 올리고 앱이 파일을 지움
create or replace function public.purge_member(p_user uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_purge_self';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and banned and not is_admin) then
    raise exception 'not_banned';
  end if;
  delete from public.messages where user_id = p_user or room_a = p_user or room_b = p_user;
  delete from public.profiles where id = p_user;
  delete from auth.users where id = p_user;
end;
$$;

revoke all on function public.purge_member(uuid) from public, anon;
grant execute on function public.purge_member(uuid) to authenticated;
