# ward-pillcheck · 병동 지참약 식별 PWA

병동 간호사가 환자 **지참약(가져온 약)** 을 빠르게 식별·정리하기 위한 모바일 웹앱(PWA).
이름을 모르는 약도 **색 + 모양 + 각인**으로 역방향 검색하고, 환자별 복약 리스트를
만들어 정렬·편집할 수 있습니다.

- **모바일 세로 화면 우선**, 한 손 조작, 큰 탭 영역, 최소 입력
- **데이터는 기기 localStorage 에만** 저장 — 외부 서버로 환자정보 전송 없음
- 실명·주민번호·환자등록번호 입력란 **없음**. 환자는 `환자1`, `환자2` … 익명 라벨만
- 설치 가능 PWA(오프라인 셸 캐싱). 데이터는 항상 네트워크에서 fresh fetch

## 기능

| 기능 | 설명 |
|---|---|
| 실물 역방향 검색(기본 탭) | 색/모양 칩 + 앞면 각인 텍스트 조합으로 검색 |
| 이름 검색 | 품목명으로 검색 |
| 결과 카드 | 낱알이미지·품목명·업체·색/모양/각인·제형, 탭 시 e약은요 상세(효능/용법/주의…) 펼침 |
| 환자 리스트 추가 | 정제수(0.5 단위)·용법·복용시점 입력. 색/모양/각인 자동채움(수정 가능) |
| 환자 관리 | 익명 라벨 추가/전환/이름변경(탭)/삭제(길게/우클릭) |
| 정렬 | 드래그 수동정렬 + 자동정렬(용법순·복용시점순). 모드는 환자별 저장 |
| 편집/삭제 | 저장 항목 탭 → 수정·삭제 |

저장 항목 표시 포맷(한 줄):
```
아스피린장용정100mg 1T QD 아침식후 (흰/원형/Bayer)
자나팜 0.25mg 0.5T QD 자기전 (흰/타원/MYUNGIN 25)
```

## 기술 스택

Vite + React + TypeScript · `vite-plugin-pwa` · `@dnd-kit/sortable`(터치 드래그) ·
상태는 Context + `useReducer` + localStorage. API 호출은 **추상화 계층**(`src/api`)
뒤에 두어, Cloudflare Worker 프록시를 추후 "번들 데이터셋" 등으로 교체 가능.

```
src/
  api/        DrugApi 인터페이스 + workerClient / mockClient (팩토리: index.ts)
  domain/     models · format(한 줄 포맷) · sort(정렬 로직)
  constants/  frequency · timing(정렬 가중치) · appearance(색/모양 칩)
  state/      store(Context+reducer) · persist(localStorage)
  components/  search/ · meds/ · patient/ · ui/
worker/       Cloudflare Worker 프록시 (인증키 보관 + CORS)
```

## 로컬 개발

```bash
npm install
npm run dev        # http://localhost:5173 (VITE_API_BASE 없으면 데모/목 모드)
npm run build      # 타입체크 + 프로덕션 빌드 (dist/)
```

`VITE_API_BASE` 가 비어 있으면 **목(mock) 클라이언트**가 동작해 인증키 없이도
UI/정렬/저장 흐름을 확인할 수 있습니다(샘플 약품 8종 내장). 실제 식약처 데이터를 쓰려면 아래 Worker를
배포하고 `.env`(또는 GitHub Pages용 repo Variable)에 Worker URL을 넣으세요.

```bash
cp .env.example .env
# VITE_API_BASE=https://ward-pillcheck-proxy.<your-subdomain>.workers.dev
```

## 테스트

```bash
npm test           # Vitest: 도메인/리듀서/목 클라이언트 + App 통합(jsdom) 42케이스
npm run e2e        # Playwright(실제 브라우저): 검색→추가→드래그 정렬→자동정렬 흐름
```

- **단위/통합**(`src/**/*.test.ts(x)`): 정렬·포맷 로직, 스토어 리듀서, 목 클라이언트,
  그리고 `StoreProvider`로 감싼 `App` 전체를 렌더해 검색→추가→편집→삭제→정렬 흐름 검증.
- **E2E**(`e2e/`): 데모 모드로 실제 브라우저에서 **터치 포인터 드래그 정렬**까지 검증
  (jsdom 으로 불가능한 dnd-kit 드래그 포함). 최초 1회 `npx playwright install chromium` 필요.

## 1. data.go.kr 인증키 발급

두 개의 공공데이터(식약처) 오픈API를 사용합니다. **하나의 data.go.kr 계정/인증키**로
두 API 모두 신청합니다.

1. [공공데이터포털](https://www.data.go.kr) 회원가입 / 로그인
2. 아래 두 데이터에서 각각 **활용신청**(개발계정, 자동승인):
   - 의약품 낱알식별 정보 — <https://www.data.go.kr/data/15057639/openapi.do>
   - 의약품개요정보(e약은요) — <https://www.data.go.kr/data/15075057/openapi.do>
3. 마이페이지 → **오픈API → 인증키**에서 **일반 인증키(Decoding)** 값을 복사
   - Worker 에는 **Decoding(원본) 키**를 넣습니다(Worker가 자동 URL 인코딩).
4. 각 API의 **활용가이드/상세설명** 문서에서 엔드포인트·파라미터를 한 번 확인하세요.
   서비스 버전 suffix(`...Service03/getMdcinGrnIdntfcInfoList03` 등)는 갱신될 수 있어,
   Worker 의 `PILL_ENDPOINT` / `DETAIL_ENDPOINT` 변수로 덮어쓸 수 있게 했습니다.

> 개발계정 트래픽은 보통 일 10,000건. 운영계정 승인 시 상향됩니다.

## 2. Cloudflare Worker(프록시) 배포

브라우저에서 data.go.kr 직접 호출은 **CORS 로 차단**됩니다. Worker가
① 인증키를 환경변수로 보관하고 ② CORS 헤더를 부여해 중계합니다. 프론트는
Worker 엔드포인트(`/api/pills`, `/api/detail`)만 호출합니다.

```bash
cd worker
npm install
npx wrangler login                 # 최초 1회 Cloudflare 인증

# 인증키를 secret 으로 주입 (data.go.kr Decoding 키 붙여넣기)
npx wrangler secret put SERVICE_KEY

npm run deploy                     # = wrangler deploy
```

배포 후 출력되는 URL(예: `https://ward-pillcheck-proxy.<subdomain>.workers.dev`)이
프론트의 `VITE_API_BASE` 값입니다. 동작 확인:

```bash
curl "https://<worker-url>/api/pills?color_class1=하양&drug_shape=원형"
curl "https://<worker-url>/api/detail?itemSeq=195700020"
```

운영 시에는 `worker/wrangler.toml` 의 `ALLOW_ORIGIN` 을 GitHub Pages 도메인으로
제한하는 것을 권장합니다(기본값 `*`).

### Worker 엔드포인트

| 경로 | 매핑되는 식약처 API |
|---|---|
| `GET /api/pills?item_name=&entp_name=&drug_shape=&color_class1=&print_front=&pageNo=&numOfRows=` | 낱알식별 `getMdcinGrnIdntfcInfoList03` |
| `GET /api/detail?itemSeq=` | e약은요 `getDrbEasyDrugList` |

## 3. GitHub Pages 배포

`main` 브랜치 push 시 `.github/workflows/deploy.yml` 가 빌드 후 Pages 에 배포합니다.

1. repo **Settings → Pages → Source: GitHub Actions**
2. repo **Settings → Secrets and variables → Actions → Variables** 에
   `VITE_API_BASE` = Worker URL 추가 (미설정 시 데모/목 모드로 빌드)
3. `base` 경로는 저장소명 기준 `/ward-pillcheck/` (다르면 `VITE_BASE` 로 덮어쓰기)

## 데이터 소스 교체(향후)

`src/api/types.ts` 의 `DrugApi` 인터페이스만 구현하면 데이터 소스를 바꿀 수 있습니다.
예: 오프라인 번들 JSON 을 읽는 `bundledClient` 를 만들어 `src/api/index.ts` 의
팩토리에서 선택하도록 교체.

## 비목표

- 처방·복약 지도 자동화 아님. **식별 보조 도구**이며 최종 확인은 의료진 책임
- 환자 식별정보 수집/전송 없음
