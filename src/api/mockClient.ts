import {
  type DrugApi,
  type DrugDetail,
  type PillResult,
  type PillSearchQuery,
} from './types';

// 인증키/Worker 없이 UI 와 로직을 검증·시연하기 위한 오프라인 목 클라이언트.
// VITE_API_BASE 가 비어 있으면 자동 선택된다.
// 실제 식약처 데이터와 동일한 필드 형태를 모사한 소규모 샘플.

const SAMPLE: PillResult[] = [
  {
    itemSeq: '195700020',
    itemName: '아스피린장용정100mg',
    entpName: '바이엘코리아',
    drugShape: '원형',
    colorClass1: '하양',
    printFront: 'Bayer',
    printBack: '',
    formCodeName: '장용정',
    etcOtcName: '일반의약품',
    className: '해열.진통.소염제',
    itemImage: '',
  },
  {
    itemSeq: '199301234',
    itemName: '자나팜정0.25mg',
    entpName: '명인제약',
    drugShape: '타원형',
    colorClass1: '하양',
    printFront: 'MYUNGIN 25',
    printBack: '',
    formCodeName: '나정',
    etcOtcName: '전문의약품',
    className: '항불안제',
    itemImage: '',
  },
  {
    itemSeq: '200005678',
    itemName: '노바스크정5mg',
    entpName: '한국화이자제약',
    drugShape: '팔각형',
    colorClass1: '하양',
    printFront: 'NOVASC 5',
    printBack: '',
    formCodeName: '나정',
    etcOtcName: '전문의약품',
    className: '혈압강하제',
    itemImage: '',
  },
  {
    itemSeq: '201103456',
    itemName: '리피토정10mg',
    entpName: '한국화이자제약',
    drugShape: '타원형',
    colorClass1: '하양',
    printFront: '10',
    printBack: 'PD 155',
    formCodeName: '필름코팅정',
    etcOtcName: '전문의약품',
    className: '동맥경화용제',
    itemImage: '',
  },
  {
    itemSeq: '199900111',
    itemName: '판콜에이내복액',
    entpName: '동화약품',
    drugShape: '기타',
    colorClass1: '갈색',
    printFront: '',
    printBack: '',
    formCodeName: '내용액제',
    etcOtcName: '일반의약품',
    className: '진해거담제',
    itemImage: '',
  },
  {
    itemSeq: '200712345',
    itemName: '타이레놀정500mg',
    entpName: '한국얀센',
    drugShape: '장방형',
    colorClass1: '하양',
    printFront: 'TYLENOL 500',
    printBack: '',
    formCodeName: '필름코팅정',
    etcOtcName: '일반의약품',
    className: '해열.진통.소염제',
    itemImage: '',
  },
  {
    itemSeq: '201498765',
    itemName: '란스톤엘에프디티정30mg',
    entpName: '제일약품',
    drugShape: '원형',
    colorClass1: '노랑',
    printFront: '30',
    printBack: '',
    formCodeName: '구강붕해정',
    etcOtcName: '전문의약품',
    className: '소화성궤양용제',
    itemImage: '',
  },
  {
    itemSeq: '200301122',
    itemName: '메가트루연질캡슐',
    entpName: '유한양행',
    drugShape: '장방형',
    colorClass1: '주황',
    printFront: '',
    printBack: '',
    formCodeName: '연질캡슐',
    etcOtcName: '일반의약품',
    className: '비타민제',
    itemImage: '',
  },
];

const DETAILS: Record<string, DrugDetail> = {
  '195700020': {
    itemSeq: '195700020',
    itemName: '아스피린장용정100mg',
    efcy: '혈전 생성 억제(심근경색·뇌경색 예방).',
    useMethod: '성인 1일 1회 1정을 충분한 물과 함께 복용.',
    atpn: '위장 장애·출혈 위험. 수술 전 복용 여부를 알리세요.',
    se: '속쓰림, 위장관 출혈 등.',
    deposit: '실온보관, 습기 주의.',
  },
  '199301234': {
    itemSeq: '199301234',
    itemName: '자나팜정0.25mg',
    efcy: '불안장애, 공황장애 완화.',
    useMethod: '의사 지시에 따라 복용. 보통 취침 전.',
    atpn: '졸음·어지럼. 운전 주의. 임의 중단 금지.',
    se: '졸림, 어지러움, 의존성.',
    deposit: '실온보관, 차광.',
  },
  '200005678': {
    itemSeq: '200005678',
    itemName: '노바스크정5mg',
    efcy: '고혈압, 협심증 치료.',
    useMethod: '성인 1일 1회 5mg 복용. 최대 10mg.',
    atpn: '갑작스러운 중단 금지. 어지럼 주의.',
    se: '안면홍조, 부종, 두통.',
    deposit: '실온보관.',
  },
  '200712345': {
    itemSeq: '200712345',
    itemName: '타이레놀정500mg',
    efcy: '감기로 인한 발열 및 통증, 두통, 근육통.',
    useMethod: '성인 1회 1~2정, 1일 3~4회 복용(최대 4000mg/일).',
    atpn: '간 손상 위험 — 음주 시 주의, 다른 아세트아미노펜 병용 금지.',
    se: '드물게 발진, 간기능 이상.',
    deposit: '실온보관.',
  },
};

function includesCI(haystack: string | undefined, needle: string): boolean {
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

function matches(p: PillResult, q: PillSearchQuery): boolean {
  if (q.itemName && !includesCI(p.itemName, q.itemName)) return false;
  if (q.entpName && !includesCI(p.entpName, q.entpName)) return false;
  if (q.drugShape && p.drugShape !== q.drugShape) return false;
  if (q.colorClass1 && p.colorClass1 !== q.colorClass1) return false;
  if (q.printFront && !includesCI(p.printFront, q.printFront)) return false;
  return true;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockClient(): DrugApi {
  return {
    async searchPills(query: PillSearchQuery): Promise<PillResult[]> {
      await delay(300); // 로딩 UI 확인용 지연
      return SAMPLE.filter((p) => matches(p, query));
    },
    async getDetail(itemSeq: string): Promise<DrugDetail | null> {
      await delay(200);
      return DETAILS[itemSeq] ?? null;
    },
  };
}

// 테스트용 노출
export const __mockSamples = SAMPLE;
export const __mockDetails = DETAILS;
