-- =========================================================
-- 7차: 마스터가 사이트에서 입장 코드 바꾸기
-- =========================================================
create or replace function public.set_invite_code(p_code text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  code text := trim(p_code);
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if char_length(code) < 4 or char_length(code) > 30 then
    raise exception 'invalid_code';
  end if;
  if exists (select 1 from private.settings where key = 'admin_code' and value = code) then
    raise exception 'same_as_admin';
  end if;
  update private.settings set value = code where key = 'invite_code';
end;
$$;

revoke all on function public.set_invite_code(text) from public, anon;
grant execute on function public.set_invite_code(text) to authenticated;
