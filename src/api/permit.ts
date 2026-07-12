// 외용약·주사제 등 낱알식별에 없는(모양 없는) 약 검색.
// 1) 번들 injections.json(빌드 때 허가정보에서 추림) — 오프라인·즉시
// 2) 없으면 Worker /api/drugsearch(라이브)
// 3) 둘 다 없으면(목 모드) 데모 목록

export interface PermitDrug {
  itemSeq: string;
  itemName: string;
  entpName: string;
  ingredient?: string;
  etcOtcName?: string;
  itemImage?: string;
}

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
const BASE = (import.meta.env.BASE_URL as string | undefined) ?? '/';

const MOCK_INJECTIONS: PermitDrug[] = [
  { itemSeq: 'inj-lantus', itemName: '란투스주솔로스타펜', entpName: '한국사노피', ingredient: '인슐린글라진', etcOtcName: '전문의약품' },
  { itemSeq: 'inj-humalog', itemName: '휴마로그퀵펜주', entpName: '한국릴리', ingredient: '인슐린리스프로', etcOtcName: '전문의약품' },
  { itemSeq: 'inj-novorapid', itemName: '노보래피드플렉스펜주', entpName: '노보노디스크', ingredient: '인슐린아스파트', etcOtcName: '전문의약품' },
  { itemSeq: 'inj-tresiba', itemName: '트레시바플렉스터치주', entpName: '노보노디스크', ingredient: '인슐린데글루덱', etcOtcName: '전문의약품' },
  { itemSeq: 'inj-cefazolin', itemName: '세파졸린나트륨주', entpName: '종근당', ingredient: '세파졸린나트륨', etcOtcName: '전문의약품' },
  { itemSeq: 'ext-ventolin', itemName: '벤토린에보할러', entpName: '글락소스미스클라인', ingredient: '살부타몰황산염', etcOtcName: '전문의약품' },
  { itemSeq: 'ext-dulcolax', itemName: '둘코락스좌약', entpName: '한국베링거인겔하임', ingredient: '비사코딜', etcOtcName: '일반의약품' },
  { itemSeq: 'ext-otrivin', itemName: '오트리빈점비액', entpName: '글락소스미스클라인', ingredient: '자일로메타졸린염산염', etcOtcName: '일반의약품' },
];

function includesCI(h: string, n: string) {
  return h.toLowerCase().includes(n.toLowerCase());
}

// 주사제(비경구 주입) 판별 — 나머지(흡입/좌약/연고/점안 등)는 외용약으로 분류.
// '펜'은 펜주사(…펜주/끝의 펜)만 — 부루펜·아세트아미노펜·펜잘 등 경구약 오분류 방지.
const INJECTION_RE = /(주사|주입|주사액|주사제|펜(?=주|$)|카트리지|바이알|키트|프리필드|플렉스|퀵펜|인슐린|주\)|주$)/;
export function isInjectionName(name: string): boolean {
  return INJECTION_RE.test(name || '');
}

// 외용약·주사제(비경구) 판별 — build-dataset.mjs / worker 의 필터와 동일 값 유지.
// 이름검색 라이브 폴백이 경구 액/시럽/pack 약(라미나지액·시네추라시럽·볼그레액·부루펜시럽 등)을
// 외용·주사제 탭에 흘리지 않도록, 이 키워드에 걸리는 비경구 약만 통과시킨다.
// '펜'은 펜주사만(…펜주/끝의 펜), '겔'은 끝(…겔)·겔제만 — 부루펜·겔포스·알마겔 등 경구약 제외.
const EXTERNAL_INJ_RE = /(주사|주입|주사액|주사제|펜(?=주|$)|카트리지|바이알|키트|프리필드|플렉스|퀵펜|인슐린|주\)|주$|흡입|에보할러|할러|디스커스|레스피맷|터부할러|네뷸|점안|점이|점비|좌제|좌약|질정|질좌|연고|크림|로션|겔(?=$|제)|젤|패치|첩부|스프레이|분무|에어로|도포|외용|카타리)/;
export function isExternalOrInjectionName(name: string): boolean {
  return EXTERNAL_INJ_RE.test(name || '');
}

// 번들 주사제 데이터(컴팩트 → PermitDrug) 1회 로드 캐시
let bundle: PermitDrug[] | null = null;
let bundleLoaded = false;
interface InjRecord {
  seq: string;
  name: string;
  entp: string;
  ingr?: string;
  otc?: string;
  img?: string;
}
async function loadBundle(): Promise<PermitDrug[]> {
  if (bundleLoaded) return bundle ?? [];
  try {
    const res = await fetch(`${BASE}data/injections.json`, { cache: 'no-cache' });
    if (res.ok) {
      const arr = (await res.json()) as InjRecord[];
      bundle = arr.map((r) => ({
        itemSeq: r.seq,
        itemName: r.name,
        entpName: r.entp,
        ingredient: r.ingr,
        etcOtcName: r.otc,
        itemImage: r.img,
      }));
    }
  } catch {
    /* 번들 없음 — 라이브/목으로 폴백 */
  }
  bundleLoaded = true;
  return bundle ?? [];
}

/** 주사제 이름검색 (빈입력 시 빈 배열) */
export async function searchInjections(name: string): Promise<PermitDrug[]> {
  const q = name.trim();
  if (!q) return [];

  // 1) 번들 우선 — 결과가 있으면 사용. 없으면(번들 누락 약, 예: 뮤코미스트액) 워커로 폴백.
  const b = await loadBundle();
  if (b.length) {
    const hit = b.filter((d) => includesCI(d.itemName, q) || includesCI(d.ingredient || '', q)).slice(0, 50);
    if (hit.length) return hit;
  }

  // 2) 워커 라이브 (전 품목 이름검색 — 번들에 없는 약도 온라인이면 검색됨)
  if (apiBase) {
    try {
      const res = await fetch(
        `${apiBase.replace(/\/$/, '')}/api/drugsearch?inj=1&item_name=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const d = (await res.json()) as { body?: { items?: PermitDrug[] } };
        // 워커가 이미 걸러주지만, 워커 재배포 전이거나 응답이 섞여 와도 경구약이 새지 않도록 한 번 더 필터.
        return (d.body?.items ?? []).filter((x) => x.itemSeq && isExternalOrInjectionName(x.itemName));
      }
    } catch {
      /* 폴백 */
    }
  }

  // 3) 목
  return MOCK_INJECTIONS.filter((d) => includesCI(d.itemName, q) || includesCI(d.ingredient || '', q));
}
