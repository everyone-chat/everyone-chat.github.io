# 우리 광장 (bondee-web)

친구들끼리 쓰는 본디 스타일 비공개 채팅 웹. GitHub Pages + Supabase 무료 플랜으로 운영.

- 주소: https://eunbyeol1112.github.io/bondee-web/
- 기능: 입장 코드, 닉네임·캐릭터·색 꾸미기, 친구 광장(상태·접속 표시), 실시간 공용 채팅(최근 200개 보관)

## 입장 코드 바꾸기

Supabase 대시보드 → SQL Editor에서 아래 한 줄 실행 (코드는 공개 저장소에 적지 말 것)

```sql
update private.settings set value = '새-코드' where key = 'invite_code';
```

이미 들어온 친구는 그대로 이용 가능하고, 새로 들어오는 사람만 새 코드가 필요함.

## 구조

| 파일 | 역할 |
|---|---|
| `supabase/setup.sql` | 테이블, 보안 정책(RLS), 입장 코드 검증 함수, 실시간 설정 |
| `src/config.ts` | Supabase 주소와 공개(publishable) 키 |
| `src/screens/` | 입장 / 광장 / 채팅 / 나 화면 |
| `.github/workflows/deploy.yml` | main에 올리면 자동 빌드·배포 |

## 무료 운영 참고

- Supabase 무료 프로젝트는 일정 기간 접속이 없으면 일시정지될 수 있음 → 대시보드에서 무료로 다시 켜면 됨
- 채팅은 최근 200개만 보관해서 DB 용량 걱정 없음
- 계정은 브라우저에 저장됨 → 브라우저 데이터 삭제·기기 변경 시 새로 입장
