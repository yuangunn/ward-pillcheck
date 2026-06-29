import {
  type DrugApi,
  type DrugDetail,
  type PillResult,
  type PillSearchQuery,
} from './types';
import { splitLineKind } from '../domain/splitLine';
import { imprintHas } from '../domain/imprint';

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
    ingredient: 'Amlodipine Besylate',
    itemImage: '',
  },
  {
    // 성분중복 데모: 아모잘탄(암로디핀+로사르탄)은 노바스크(암로디핀)와 암로디핀이 겹친다
    itemSeq: '201200777',
    itemName: '아모잘탄정5/50mg',
    entpName: '한미약품',
    drugShape: '타원형',
    colorClass1: '노랑',
    printFront: 'AML',
    printBack: '',
    formCodeName: '필름코팅정',
    etcOtcName: '전문의약품',
    className: '혈압강하제',
    ingredient: 'Amlodipine Camsylate/Losartan Potassium',
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
    lineFront: '-',
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
  {
    // 각인 180° 뒤집힘 데모: 각인 'SIH' → 거꾸로 'HIS' 로 검색해도 잡힘
    itemSeq: '202400318',
    itemName: '미소론정',
    entpName: '한국샘플',
    drugShape: '원형',
    colorClass1: '청록',
    printFront: 'SIH',
    printBack: '',
    formCodeName: '나정',
    etcOtcName: '전문의약품',
    className: '기타',
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
    intrc: '항응고제(와파린)·다른 NSAIDs 병용 시 출혈 위험 증가.',
    se: '속쓰림, 위장관 출혈 등.',
    deposit: '실온보관, 습기 주의.',
    ingredient: '아스피린(아세틸살리실산)',
    source: 'e약은요',
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

/** 앞/뒤 각인 합본(대문자) — 번들 filterRecords 와 동일 규칙 */
function imprintHay(p: PillResult): string {
  return [p.printFront, p.printBack].map((v) => (v ?? '').toUpperCase()).join(' ');
}

function matches(p: PillResult, q: PillSearchQuery): boolean {
  if (q.itemName && !includesCI(p.itemName, q.itemName)) return false;
  if (q.entpName && !includesCI(p.entpName, q.entpName)) return false;
  if (q.drugShape && p.drugShape !== q.drugShape) return false;
  if (q.shapes?.length && !q.shapes.includes(p.drugShape ?? '')) return false; // 모양 다중선택(하나라도 일치)
  if (q.colorClass1 && p.colorClass1 !== q.colorClass1) return false;
  if (q.colors?.length && !q.colors.some((c) => (p.colorClass1 ?? '').includes(c))) return false;
  if (q.forms?.length && !q.forms.some((f) => (p.formCodeName ?? '').includes(f))) return false;
  if (q.lines?.length && !q.lines.includes(splitLineKind(p.lineFront, p.lineBack))) return false;
  // 각인: 앞/뒤 합본에 그대로 또는 180° 뒤집어 일치(예: SIH ↔ HIS)
  if (q.printFront && !imprintHas(imprintHay(p), q.printFront.toUpperCase()).hit) return false;
  return true;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockClient(): DrugApi {
  return {
    async searchPills(query: PillSearchQuery): Promise<PillResult[]> {
      await delay(300); // 로딩 UI 확인용 지연
      const print = query.printFront?.toUpperCase();
      return SAMPLE.filter((p) => matches(p, query)).map((p) =>
        print && imprintHas(imprintHay(p), print).flipped ? { ...p, printFlipMatch: true } : p,
      );
    },
    async getDetail(itemSeq: string, _itemName?: string): Promise<DrugDetail | null> {
      await delay(200);
      return DETAILS[itemSeq] ?? null;
    },
    async getIngredients(seqs: string[]): Promise<Map<string, string>> {
      const want = new Set(seqs);
      const map = new Map<string, string>();
      for (const p of SAMPLE) {
        if (want.has(p.itemSeq) && p.ingredient) map.set(p.itemSeq, p.ingredient);
      }
      return map;
    },
  };
}

// 테스트용 노출
export const __mockSamples = SAMPLE;
export const __mockDetails = DETAILS;
