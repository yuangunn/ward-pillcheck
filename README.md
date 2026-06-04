```
 __      __            _    ____  _ _ _    _               _
 \ \    / /_ _ _ _ __ | |  |  _ \(_) | |  / _|___ ___ _ __| |_
  \ \/\/ / _` | '_/ _` |  | |_) | | | | | (__/ _ / -_) '_ | / /
   \_/\_/\__,_|_| \__,_|  |  __/|_|_|_|  \___\___\___| .__|_\_\
                          |_|        💊             |_|
        ward-pillcheck — 병동 지참약 식별 PWA
```

# ward-pillcheck · 병동 지참약 식별 PWA

> 병동 간호사가 환자가 **가져온 약(지참약)** 을 현장에서 빠르게 식별·정리하는 모바일 PWA.
> 약 이름을 몰라도 **색 + 모양 + 각인 + 마크**로 거꾸로 찾고, 주사제·수기 약도 더해
> 환자별 복약 리스트를 만들어 정렬·금기점검·인계 복사까지. 데이터는 **기기에만**.

🔗 **앱**: https://yuangunn.github.io/ward-pillcheck/

## About

병동에서 입원 환자의 **지참약(가져온 약)** 을 식별하고 복약 리스트로 정리해 인계까지
돕는 **모바일 PWA**입니다. 지참약은 보통 이름표 없이 낱알만 오므로, 식약처 공공데이터를
활용해 **색·모양·각인·마크(그림)** 같은 겉모습으로 거꾸로 찾는 데 초점을 맞췄습니다.

- 🔍 **식별 방법**: ① 실물검색(색·모양·각인·마크 갤러리) ② 이름검색 ③ 주사제(이름) ④ 직접입력(수기)
- 🗂 **데이터**: 식약처 낱알식별·허가정보·e약은요·DUR. 낱알·주사제·마크는 **기기에 번들**로
  내려받아 오프라인·즉시 검색(매일 자동 갱신)
- 🛡 **안전**: 환자 리스트에 대해 **DUR 금기·중복 점검**(병용금기·임부·노인·연령·효능군중복)
- 🔒 **개인정보**: 실명·주민번호·등록번호 입력란 **없음**(익명 라벨만), 모든 기록은
  기기 **localStorage** 에만 — 외부 서버 전송 없음
- 📱 **UX**: 모바일 세로 우선, 한 손 조작. 홈(환자) → 환자(복약 리스트) → 검색 흐름,
  Toss 스타일 디자인, **라이트/다크**(기기 설정 자동), 설치형 PWA(오프라인 셸)
- ⚖️ **주의**: 처방·복약지도 자동화가 아닌 **식별 보조** 도구이며 **최종 확인은 의료진 책임**

## 기능

| 기능 | 설명 |
|---|---|
| 실물 검색 | 색 스와치 + 모양 칩 + 앞면 각인으로 거꾸로 찾기(기본 탭). 각인은 **실제 인쇄 각인**만(마크는 별도) |
| 마크로 찾기(골라서) | 약에 새겨진 **그림(마크)을 이미지 갤러리에서 골라** 검색(번들 마크 이미지 431종) |
| 마크로 찾기(그려서) | 캔버스에 **마크를 그리면** 번들 마크와 **온디바이스 형상 유사도**로 닮은 후보 제시(서버·API 0) |
| 이름 검색 | 품목명으로 검색 |
| 주사제 검색 | 인슐린 등 주사제를 **이름**으로 검색(허가정보 번들). 색·모양 없는 약 대응 |
| 직접 입력 | 목록에 없는 약·주사제를 **수기**로(이름 + 용량 단위 T/U/mL/회분/포 + 용법·시점) |
| 결과 카드 | 품목명·업체·색/모양/각인(앞·뒤, 검색어 강조)·분할선·제형. **약 글리프 탭 → 확대**(실사진 원본 링크) |
| 상세 정보 | **실물사진 + 외형요약**(분류·구분·제형·색·모양·각인·분할선) + 효능·용법·주의·**상호작용**·이상반응·보관(e약은요→허가정보 폴백, **출처 표시**) + 사진 원본 링크 |
| 환자 리스트 추가 | 정제수(0.5 단위)·용법·복용시점. 색/모양/각인 자동채움(수정 가능) |
| 복용시점 多 | 용법에 맞춰 시점 칸 자동 — QD=1, **BID=2, TID=3, QID=4** + 직접입력 |
| 환자 관리 | 익명 라벨 추가/전환, 제목 옆 **`>`** 또는 ⋯ 로 이름변경·삭제 |
| 정렬 | 기본순 / 용법순 / 시점순 (환자별 저장) |
| 인계 복사/공유 | 복약 리스트를 한 줄 포맷 텍스트로 클립보드 복사(지원 시 시스템 공유) |
| 금기·중복 점검(DUR) | 리스트에 대해 **병용금기·임부·노인·연령 금기·효능군 중복** 자동 점검 |
| DB 정보·업데이트 | 홈에서 약품 데이터 **건수·최근 업데이트일** 표시 + 수동 **업데이트** |
| 다크 모드 | 헤더 🌙/☀️ 토글, 기기 설정 자동 감지 |

저장 항목 한 줄 표시 포맷:
```
아스피린장용정100mg 1T QD 아침식후 (흰/원형/Bayer)
메트포르민500mg 1T BID 아침식후,저녁식후 (흰/원형/MF500)
란투스주솔로스타펜 10U BID 아침식전,저녁식전
```

## 기술 스택 / 구조

Vite + React + TypeScript · `vite-plugin-pwa` · `@dnd-kit` · 상태는 Context + `useReducer`
+ localStorage. 데이터 접근은 **추상화 계층(`src/api`)** 뒤에 두고, 검색은 기기 번들
데이터셋(IndexedDB/정적파일), 상세·이미지는 Cloudflare Worker 프록시로 분리.

```
src/
  api/        types · workerClient · bundledClient · mockClient · index(팩토리)
              dataset(번들 낱알/마크 IndexedDB) · dur(금기점검) · permit(주사제·허가)
              marksim(그려서 마크 찾기 — 온디바이스 형상 유사도)
  domain/     models · format(한 줄 포맷) · sort(정렬)
  constants/  frequency(용법·시점칸) · timing · appearance(색/모양)
  state/      store(Context+reducer) · persist(localStorage) · useDataset
  design/     theme(토큰·라이트/다크) · Icon(+PillGlyph/MarkGlyph) · ui · screens · sheets
worker/       Cloudflare Worker(인증키 보관 + CORS + 이미지 프록시)
scripts/      build-dataset.mjs(낱알·주사제·마크 번들 생성)
```

## 로컬 개발 / 테스트

```bash
npm install
npm run dev        # http://localhost:5173 (VITE_API_BASE 없으면 데모/목 모드)
npm run build      # 타입체크 + 프로덕션 빌드
npm test           # Vitest 단위/통합 (60+ 케이스)
npm run e2e        # Playwright 실브라우저 E2E (최초 1회 npx playwright install chromium)
```

`VITE_API_BASE` 가 비어 있으면 **목(mock) 모드** — 인증키 없이 샘플 데이터로 UI/흐름 확인.
**CI**(`.github/workflows/ci.yml`): PR/푸시마다 typecheck + Vitest + 빌드 + E2E.

## 배포

### 1) data.go.kr 인증키 (5종 API, 하나의 키)
[공공데이터포털](https://www.data.go.kr)에서 아래를 **활용신청**(개발계정·자동승인) 후,
마이페이지의 **일반 인증키(Decoding)** 를 사용합니다(코드/저장소엔 절대 넣지 않음).

| 데이터 | ID | 용도 |
|---|---|---|
| 의약품 낱알식별 정보 | 15057639 | 색·모양·각인·마크 검색 |
| 의약품개요정보(e약은요) | 15075057 | 효능/용법/주의 상세 |
| 의약품 제품 허가정보 | 15095677 | 주사제 이름검색 · 상세 폴백 |
| 의약품안전사용서비스(DUR) 품목정보 | 15059486 | 금기·중복 점검 |
| (선택) DUR 성분정보 | 15056780 | 성분 기준 보조 |

> 엔드포인트 버전 suffix 는 갱신될 수 있어 Worker 의 `*_ENDPOINT` 환경변수로 덮어쓸 수 있습니다.

### 2) Cloudflare Worker (인증키 보관 + 프록시)
```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put SERVICE_KEY   # data.go.kr Decoding 키
npm run deploy
```
출력된 `https://<name>.<subdomain>.workers.dev` 가 프론트의 `VITE_API_BASE` 값입니다.
운영 시 `wrangler.toml` 의 `ALLOW_ORIGIN` 을 Pages 도메인으로 제한 권장.

**Worker 엔드포인트**

| 경로 | 식약처 API / 역할 |
|---|---|
| `GET /api/pills` | 낱알식별 `getMdcinGrnIdntfcInfoList03` |
| `GET /api/detail?itemSeq=` | e약은요 `getDrbEasyDrugList` |
| `GET /api/permit?itemSeq=` | 제품 허가정보 상세(효능/용법/주의 폴백) |
| `GET /api/drugsearch?item_name=&inj=1` | 허가정보 이름검색(주사제) |
| `GET /api/dur?itemSeq=` | DUR 품목정보(병용금기·임부·노인·연령·효능군중복) |
| `GET /api/img?u=` | nedrug 이미지 프록시(헤더 정리 + CORS) |

### 3) GitHub Pages
`main` push 시 `.github/workflows/deploy.yml` 가 데이터셋 빌드 → 빌드 → 배포.
1. **Settings → Pages → Source: GitHub Actions**
2. **Settings → … → Variables**: `VITE_API_BASE` = Worker URL
3. **Settings → … → Secrets**: `SERVICE_KEY` = data.go.kr Decoding 키(데이터셋 빌드용)
4. base 경로는 저장소명 기준 `/ward-pillcheck/` (다르면 `VITE_BASE`)

## 번들 데이터셋 (오프라인 검색)

식약처 API는 색/모양/각인 검색 파라미터를 서버에서 무시하는 경우가 있어, **전체 데이터를
빌드 때 받아 기기에서 직접 검색**합니다. `scripts/build-dataset.mjs` 가 생성:

| 파일 | 내용 | 규모(예시) |
|---|---|---|
| `pills.json` | 낱알식별 전체(색/모양/각인/마크코드/분할선…) | ~25,000건 |
| `injections.json` | 허가정보에서 추린 주사제 | ~3,700건 |
| `marks.json` + `marks/*.gif` | 고유 마크 코드 + **마크 이미지 번들** | ~431종, ~수MB |

- 앱은 첫 실행 시 IndexedDB 에 캐시하고, 메타(생성일)가 바뀌면 자동 갱신(홈 "업데이트"로 수동도).
- **매일 cron(`0 18 * * *` UTC)** 으로 재생성·재배포.
- **이미지**: 마크는 번들(같은 출처)이라 오프라인·즉시 표시. **낱알 실사진(~2.4GB)** 은
  번들 불가 + Worker→nedrug 이미지 프록시가 간헐 TLS 오류라, 라이트박스의 **"원본 열기"
  링크**로 새 탭에서 보고 앱 내 식별은 색·모양·각인 글리프로 대체합니다.

## 비목표

- 처방·복약 지도 자동화 아님 — **식별 보조 도구**, 최종 확인은 의료진 책임
- 환자 식별정보(실명·등록번호 등) 수집/전송 없음
