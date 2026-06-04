// 주사제 등 낱알식별에 없는 약 — 식약처 「의약품 제품 허가정보」 이름검색.
// Worker /api/drugsearch 경유. 워커 없으면(목 모드) 데모 주사제 목록.

export interface PermitDrug {
  itemSeq: string;
  itemName: string;
  entpName: string;
  ingredient?: string;
  etcOtcName?: string;
  itemImage?: string;
}

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();

const MOCK_INJECTIONS: PermitDrug[] = [
  { itemSeq: 'inj-lantus', itemName: '란투스주솔로스타펜', entpName: '한국사노피', ingredient: '인슐린글라진', etcOtcName: '전문의약품' },
  { itemSeq: 'inj-humalog', itemName: '휴마로그퀵펜주', entpName: '한국릴리', ingredient: '인슐린리스프로', etcOtcName: '전문의약품' },
  { itemSeq: 'inj-novorapid', itemName: '노보래피드플렉스펜주', entpName: '노보노디스크', ingredient: '인슐린아스파트', etcOtcName: '전문의약품' },
  { itemSeq: 'inj-tresiba', itemName: '트레시바플렉스터치주', entpName: '노보노디스크', ingredient: '인슐린데글루덱', etcOtcName: '전문의약품' },
  { itemSeq: 'inj-cefazolin', itemName: '세파졸린나트륨주', entpName: '종근당', ingredient: '세파졸린나트륨', etcOtcName: '전문의약품' },
];

function includesCI(h: string, n: string) {
  return h.toLowerCase().includes(n.toLowerCase());
}

/** 주사제 이름검색 (실패/빈입력 시 빈 배열) */
export async function searchInjections(name: string): Promise<PermitDrug[]> {
  const q = name.trim();
  if (!q) return [];
  if (!apiBase) {
    return MOCK_INJECTIONS.filter((d) => includesCI(d.itemName, q) || includesCI(d.ingredient || '', q));
  }
  try {
    const res = await fetch(
      `${apiBase.replace(/\/$/, '')}/api/drugsearch?inj=1&item_name=${encodeURIComponent(q)}`,
    );
    if (!res.ok) return [];
    const d = (await res.json()) as { body?: { items?: PermitDrug[] } };
    return (d.body?.items ?? []).filter((x) => x.itemSeq);
  } catch {
    return [];
  }
}
