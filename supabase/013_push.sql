-- =========================================================
-- 13차: 휴대폰 알림 (웹 푸시). 문구는 사용자가 정함, 채팅 내용·보낸 사람은 알림에 안 나감
-- Edge Function "push" (supabase/functions/push/index.ts, JWT 확인 끔)와 같이 사용
-- 여러 번 실행해도 안전함
-- =========================================================
create extension if not exists pg_net with schema extensions;

-- 내 기기들의 알림 구독 정보
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists "push_subs_own" on public.push_subscriptions;
create policy "push_subs_own" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 내 알림 문구
create table if not exists public.push_prefs (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  enabled    boolean not null default true,
  title      text not null default '알림' check (char_length(title) <= 40),
  body       text not null default '새 소식이 {n}건 있어요' check (char_length(body) <= 100),
  updated_at timestamptz not null default now()
);
alter table public.push_prefs enable row level security;
revoke all on public.push_prefs from anon;
grant select, insert, update on public.push_prefs to authenticated;
drop policy if exists "push_prefs_own" on public.push_prefs;
create policy "push_prefs_own" on public.push_prefs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 서버 전용 (Edge Function만 읽고 씀): 알림 서명 키, 보낸 기록
create table if not exists public.push_server (
  id          int primary key,
  public_key  text not null,
  private_key text not null
);
alter table public.push_server enable row level security;
revoke all on public.push_server from anon, authenticated;

create table if not exists public.push_sent (
  message_id bigint primary key,
  at         timestamptz not null default now()
);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- 메시지가 들어오면 Edge Function에 번호만 알림 (함수가 다시 DB에서 확인 후 보냄)
create or replace function public.notify_push()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://uzzyadqvshwtrqsaexbr.supabase.co/functions/v1/push',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return null;
end;
$$;

drop trigger if exists messages_push on public.messages;
create trigger messages_push
  after insert on public.messages
  for each row execute function public.notify_push();
