// API 추상화 계층의 공용 타입.
// 식약처 응답 필드를 프론트 친화적인 정규화 형태로 변환해 노출한다.
// 추후 "번들 데이터셋 방식"으로 교체해도 이 타입들은 그대로 유지된다.

/** 낱알식별 검색 쿼리 (실물 역방향 검색 + 이름 검색 공용) */
export interface PillSearchQuery {
  itemName?: string; // 품목명
  entpName?: string; // 업체명
  drugShape?: string; // 모양 (drug_shape)
  colorClass1?: string; // 색 (color_class1) — 단일(하위호환)
  colors?: string[]; // 색 다중 선택(하나라도 일치)
  forms?: string[]; // 제형 부분일치 키워드(정/경질/연질 등) — 하나라도 일치
  printFront?: string; // 앞면 각인 (print_front)
  markCode?: string; // 마크 코드(갤러리 선택) — 번들 데이터셋 전용
  formCodeName?: string; // 제형
  pageNo?: number;
  numOfRows?: number;
}

/** 낱알식별 정규화 결과 1건 */
export interface PillResult {
  itemSeq: string; // 품목기준코드 (e약은요 연결 키)
  itemName: string; // 품목명
  entpName: string; // 업체명
  drugShape?: string; // 모양
  colorClass1?: string; // 색
  printFront?: string; // 앞면 각인
  printBack?: string; // 뒤면 각인
  lineFront?: string; // 앞면 분할선
  lineBack?: string; // 뒤면 분할선
  formCodeName?: string; // 제형
  itemImage?: string; // 낱알이미지 URL
  etcOtcName?: string; // 전문/일반
  className?: string; // 분류
  ingredient?: string; // 주성분(번들: 허가정보 ITEM_INGR_NAME 결합)
  markFrontImg?: string; // 앞면 마크 이미지 URL
  markBackImg?: string; // 뒤면 마크 이미지 URL
  markFrontAnal?: string; // 앞면 마크 분석 텍스트(마크 속 글자/기호)
  markBackAnal?: string; // 뒤면 마크 분석 텍스트
}

/** e약은요 상세 정보 (itemSeq 로 연결) */
export interface DrugDetail {
  itemSeq: string;
  itemName?: string;
  efcy?: string; // 효능 efcyQesitm
  useMethod?: string; // 용법 useMethodQesitm
  atpn?: string; // 주의 atpnQesitm
  intrc?: string; // 상호작용 intrcQesitm
  se?: string; // 부작용 seQesitm
  deposit?: string; // 보관법 depositMethodQesitm
  ingredient?: string; // 주성분(허가정보 ITEM_INGR_NAME)
  source?: 'e약은요' | '허가사항'; // 상세 출처 표시용
}

/**
 * 약품 데이터 소스 인터페이스.
 * 구현체: workerClient(Cloudflare Worker 프록시), mockClient(오프라인 데모),
 * 추후 bundledClient(번들 JSON) 등으로 교체 가능.
 */
export interface DrugApi {
  /** 낱알식별 검색 */
  searchPills(query: PillSearchQuery): Promise<PillResult[]>;
  /** 상세 (카드 탭 시 lazy 로드). itemName 주면 성분 조회 신뢰도↑. 없으면 null */
  getDetail(itemSeq: string, itemName?: string): Promise<DrugDetail | null>;
}

/** API 호출 실패 시 던지는 표준 에러 */
export class DrugApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'server' | 'config' = 'server',
  ) {
    super(message);
    this.name = 'DrugApiError';
  }
}
