# ward-pillcheck-proxy (Cloudflare Worker)

브라우저에서 data.go.kr(식약처) 공공데이터를 직접 호출하면 **CORS 로 차단**됩니다.
이 Worker 가 ① 인증키(`SERVICE_KEY`)를 환경변수로 보관하고 ② CORS 헤더를 부여해
중계합니다. 프론트는 이 Worker 의 `/api/pills`, `/api/detail` 만 호출합니다.

```
[브라우저(PWA)] → [CF Worker /api/*] → [data.go.kr 식약처 API]
                     ↑ SERVICE_KEY(secret) 주입 + CORS 헤더 부여
```

## 엔드포인트

| 경로 | 매핑되는 식약처 API |
|---|---|
| `GET /api/pills?item_name=&entp_name=&drug_shape=&color_class1=&print_front=&form_code_name=&pageNo=&numOfRows=` | 낱알식별 `getMdcinGrnIdntfcInfoList03` |
| `GET /api/detail?itemSeq=` | e약은요 `getDrbEasyDrugList` |
| `GET /health` | 헬스체크 |

응답은 `{"body":{"items":[...]}}` 형태로 정규화됩니다.

> **동작 메모(중요):** 식약처 낱알식별 API는 색/모양/각인 파라미터를 무시하고
> 첫 페이지를 그대로 돌려주는 경우가 있습니다. 그래서 Worker는
> ① 파라미터를 스네이크+카멜(`color_class1`/`colorClass1` 등) 양쪽으로 전송하고,
> ② 외형 조건이 있으면 여러 페이지(최대 1000건)를 받아 **Worker가 직접 필터링**해
> 일치 항목만 반환합니다. 이 동작을 적용하려면 최신 코드로 **재배포**해야 합니다.

---

## 0. 사전 준비물

1. **Cloudflare 계정**(무료) — <https://dash.cloudflare.com>
2. **data.go.kr 인증키 (Decoding 값)** — 마이페이지 → 오픈API → 인증키에서
   **"일반 인증키(Decoding)"** 복사
   - ⚠️ 반드시 **Decoding(원본)** 키를 사용. Worker 가 내부에서 `URLSearchParams` 로
     자동 인코딩하므로, 이미 인코딩된(Encoding) 키를 넣으면 **이중 인코딩**되어
     `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` 가 납니다.
   - 두 API(낱알식별 15057639 / e약은요 15075057) **모두 활용신청 승인** 상태여야 함.
3. **Node.js 18+**

---

## 1. 로컬에서 먼저 검증 (배포 전 권장)

```bash
cd worker
npm install
```

로컬 비밀값 파일 `worker/.dev.vars` 생성 (이미 `.gitignore` 에 포함 → 커밋 안 됨):

```
SERVICE_KEY=여기에_디코딩된_인증키_붙여넣기
```

로컬 실행:

```bash
npx wrangler dev          # → http://localhost:8787
```

동작 확인(다른 터미널):

```bash
curl "http://localhost:8787/health"
# → {"ok":true,"service":"ward-pillcheck-proxy"}

curl "http://localhost:8787/api/pills?color_class1=하양&drug_shape=원형&numOfRows=3"
curl "http://localhost:8787/api/detail?itemSeq=195700020"
```

`{"body":{"items":[...]}}` 가 나오면 성공.

---

## 2. 배포

```bash
cd worker
npx wrangler login                 # 최초 1회 Cloudflare 인증

npx wrangler secret put SERVICE_KEY # Decoding 키 붙여넣기 (운영 secret)

npm run deploy                     # = wrangler deploy
```

배포 후 출력되는 URL 이 프론트의 `VITE_API_BASE` 값입니다:

```
https://ward-pillcheck-proxy.<your-subdomain>.workers.dev
```

확인:

```bash
curl "https://ward-pillcheck-proxy.<subdomain>.workers.dev/api/pills?color_class1=하양&drug_shape=원형"
```

---

## 3. 프론트에 연결

**로컬 개발** — 저장소 루트 `.env`:

```
VITE_API_BASE=https://ward-pillcheck-proxy.<subdomain>.workers.dev
# (로컬 worker 를 쓸 경우) VITE_API_BASE=http://localhost:8787
```

**GitHub Pages 배포** — repo **Settings → Secrets and variables → Actions → Variables**:

```
이름: VITE_API_BASE
값:  https://ward-pillcheck-proxy.<subdomain>.workers.dev
```

이 값이 없으면 프론트는 자동으로 **데모(목) 모드**로 빌드됩니다.

---

## 4. 운영 시 보안 강화 (CORS 제한)

기본은 모든 출처 허용(`*`). 내 GitHub Pages 도메인만 허용하려면 `wrangler.toml` 의
`[vars]` 를 수정 후 재배포:

```toml
[vars]
ALLOW_ORIGIN = "https://<github-username>.github.io"
```

---

## 5. 엔드포인트 버전이 바뀌었을 때

식약처가 서비스 버전 suffix(`...Service03/...List03`)를 올리면 코드 수정 없이
`wrangler.toml` 에서 덮어쓸 수 있습니다:

```toml
[vars]
PILL_ENDPOINT = "https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService04/getMdcinGrnIdntfcInfoList04"
DETAIL_ENDPOINT = "https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList"
```

---

## 6. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `{"error":"SERVICE_KEY 미설정"}` (500) | secret 미주입. `wrangler secret put SERVICE_KEY`(배포본) 또는 `.dev.vars`(로컬) 확인 |
| `{"error":"upstream non-JSON 응답"}` (502) | 보통 **키 문제** — Encoding 키를 넣어 이중 인코딩됐거나 해당 API 활용신청 미승인. Decoding 키인지/승인됐는지 확인 |
| `{"error":"upstream 5xx"}` (502) | data.go.kr 일시 장애 또는 일일 호출한도 초과(개발계정 1만건/일) |
| 브라우저 콘솔 CORS 에러 | `ALLOW_ORIGIN` 이 실제 접속 도메인과 다름. `*` 로 두거나 정확한 도메인 지정 |
| 결과가 빈 배열(`items:[]`) | 검색 조건이 너무 좁음. 색/모양/각인 조합 완화 |

> 한글 파라미터(`color_class1=하양`)는 Worker 가 자동 URL 인코딩하므로 그대로 넣으면 됩니다.

## 무료 한도

- Cloudflare Workers 무료 플랜: 하루 100,000 요청
- data.go.kr 개발계정: 보통 일 10,000 건(운영계정 승인 시 상향)
