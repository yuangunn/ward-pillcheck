import {
  type DrugApi,
  type DrugDetail,
  type PillResult,
  type PillSearchQuery,
} from './types';

// 인증키/Worker 없이 UI 와 로직을 검증하기 위한 오프라인 목 클라이언트.
// VITE_API_BASE 가 비어 있으면 자동 선택된다.

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
};

function matches(p: PillResult, q: PillSearchQuery): boolean {
  if (q.itemName && !p.itemName.includes(q.itemName)) return false;
  if (q.entpName && !p.entpName.includes(q.entpName)) return false;
  if (q.drugShape && p.drugShape !== q.drugShape) return false;
  if (q.colorClass1 && p.colorClass1 !== q.colorClass1) return false;
  if (q.printFront && !(p.printFront ?? '').toLowerCase().includes(q.printFront.toLowerCase()))
    return false;
  return true;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockClient(): DrugApi {
  return {
    async searchPills(query: PillSearchQuery): Promise<PillResult[]> {
      await delay(350); // 로딩 UI 확인용 지연
      return SAMPLE.filter((p) => matches(p, query));
    },
    async getDetail(itemSeq: string): Promise<DrugDetail | null> {
      await delay(250);
      return DETAILS[itemSeq] ?? null;
    },
  };
}
