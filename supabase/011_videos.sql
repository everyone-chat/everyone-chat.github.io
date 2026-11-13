-- =========================================================
-- 11차: 동영상 보내기 (같은 비공개 저장소 chat-images 사용)
-- 무료 플랜의 파일 1개 최대 크기 50MB에 맞춤. 여러 번 실행해도 안전함
-- =========================================================
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
                                  'video/mp4', 'video/quicktime', 'video/webm']
 where id = 'chat-images';
