// Supabase 공개 키 (브라우저용 publishable key라 공개돼도 안전함.
// 실제 데이터 보호는 DB의 RLS 정책과 입장 코드 검증 함수가 담당)
export const SUPABASE_URL = 'https://uzzyadqvshwtrqsaexbr.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_eBXn4fB7b4fVbDQU9G6HGQ_erdnV2jq'

// 사진·동영상 저장소 (Cloudflare Worker 주소, worker/media-worker.js)
// 비워 두면 예전처럼 Supabase 저장소(1GB)에 올림
export const MEDIA_URL = 'https://media.everyone-chat-app.workers.dev'
