-- 14차: 알림 "앱 보는 중" 판단을 기기별로 (PC로 보고 있어도 휴대폰 알림은 오게)
alter table public.push_subscriptions add column if not exists active_at timestamptz;
