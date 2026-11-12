-- =========================================================
-- 6차: 마스터가 내보낸 멤버 다시 들이기
-- =========================================================
create or replace function public.unban_member(p_user uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  update public.profiles
     set approved = true, banned = false
   where id = p_user and banned;
end;
$$;

revoke all on function public.unban_member(uuid) from public, anon;
grant execute on function public.unban_member(uuid) to authenticated;
