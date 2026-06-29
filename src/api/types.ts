// API 추상화 계층의 공용 타입.
// 식약처 응답 필드를 프론트 친화적인 정규화 형태로 변환해 노출한다.
// 추후 "번들 데이터셋 방식"으로 교체해도 이 타입들은 그대로 유지된다.

import type { SplitLineKind } from '../domain/splitLine';

/** 낱알식별 검색 쿼리 (실물 역방향 검색 + 이름 검색 공용) */
export interface PillSearchQuery {
  itemName?: string; // 품목명
  entpName?: string; // 업체명
  drugShape?: string; // 모양 (drug_shape) — 단일(하위호환)
  shapes?: string[]; // 모양 다중 선택(하나라도 일치) — 타원형/장방형처럼 분류 모호한 경우 대비
  colorClass1?: string; // 색 (color_class1) — 단일(하위호환)
  colors?: string[]; // 색 다중 선택(하나라도 일치)
  forms?: string[]; // 제형 부분일치 키워드(정/경질/연질 등) — 하나라도 일치
  lines?: SplitLineKind[]; // 분할선 종류(없음/일자/십자) — 하나라도 일치
  printFront?: string; // 앞면 각인 (print_front)
  markCode?: string; // 마크 코드(글자값) — 폴백/하위호환
  markImg?: string; // 마크 이미지 id(갤러리·그리기 선택) — 같은 "실제 마크 이미지"만 매칭
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
  chart?: string; // 성상(자연어 모양·색 설명) — '기타' 모양 세분화용
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
  /** 검색 매칭 주석: 각인이 '그대로'가 아니라 180° 뒤집어야 일치한 경우 true (예: SIH↔HIS). 결과카드 표시용 */
  printFlipMatch?: boolean;
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
  /**
   * itemSeq → 성분 문자열 매핑(성분 중복 점검용). 완전 오프라인.
   * 성분 데이터가 없는 구현(워커 등)은 미구현(선택)이며, 그 경우 성분중복은 점검하지 않는다.
   */
  getIngredients?(seqs: string[]): Promise<Map<string, string>>;
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
