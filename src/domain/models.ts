// 도메인 데이터 모델.
// 실명/주민번호/환자등록번호 등 식별정보 필드는 절대 두지 않는다.
// 모든 데이터는 기기 localStorage 에만 존재한다.

/** 용법(1일 투여 패턴) 프리셋 + 자유입력 허용 */
export type FrequencyCode =
  | 'QD'
  | 'BID'
  | 'TID'
  | 'QID'
  | 'HS'
  | 'QOD'
  | 'PRN'
  | (string & {});

/** 복용시점 프리셋 + 자유입력 허용 */
export type TimingCode =
  | '아침식전'
  | '아침식후'
  | '점심식전'
  | '점심식후'
  | '저녁식전'
  | '저녁식후'
  | '자기전'
  | '필요시'
  | (string & {});

/** 환자 리스트에 저장되는 약물 1건 */
export interface MedItem {
  id: string; // 로컬 생성 uuid
  itemSeq: string; // 품목기준코드(e약은요 연결 키)
  name: string; // 품목명(용량 포함). 예) 아스피린장용정100mg
  imageUrl?: string; // 낱알이미지 URL
  color?: string; // API 자동채움(수정 가능)
  shape?: string;
  marking?: string; // 앞면 각인
  tabletCount: number; // 용량 수치(정제 수 등, 소수 허용)
  doseUnit?: string; // 용량 단위. 기본 'T'(정). 주사약 'U'(단위)·'mL'·'회분' 등
  frequency: FrequencyCode;
  timings: TimingCode[]; // 복용시점. 1일 투여횟수만큼(QD=1, BID=2, TID=3, QID=4)
  createdAt: number;
}

/** 리스트 정렬 모드 (환자별 저장) */
export type SortMode = 'manual' | 'byFrequency' | 'byTiming';

/** 익명 라벨로만 식별되는 환자 */
export interface Patient {
  id: string;
  label: string; // "환자1" 등 익명 라벨. 실명 금지.
  meds: MedItem[]; // manual 모드의 사용자 지정 순서를 보존
  sortMode: SortMode;
  updatedAt?: number; // 지참약을 마지막으로 추가/수정/삭제한 시각(ms). 목록 최신순 정렬·표시용
}

/** 앱 전체 영속 상태 */
export interface AppState {
  schemaVersion: number; // 마이그레이션 대비
  patients: Patient[];
  activePatientId: string | null;
}
