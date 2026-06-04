import {
  type DrugApi,
  DrugApiError,
  type DrugDetail,
  type PillResult,
  type PillSearchQuery,
} from './types';

// Cloudflare Worker 프록시를 통해 식약처 공공데이터를 호출하는 클라이언트.
// Worker 가 serviceKey 를 주입하고 CORS 헤더를 부여하므로,
// 프론트는 Worker 엔드포인트(VITE_API_BASE)만 알면 된다.
//
// Worker 경로 규약:
//   GET {base}/api/pills?item_name=&entp_name=&drug_shape=&color_class1=&print_front=&...
//   GET {base}/api/detail?itemSeq=...
// Worker 는 식약처 응답을 그대로 JSON 으로 중계한다(아래 파서가 정규화).

/** 식약처 낱알식별 raw item (필드명은 공공데이터 스펙) */
interface RawPillItem {
  ITEM_SEQ?: string;
  ITEM_NAME?: string;
  ENTP_NAME?: string;
  DRUG_SHAPE?: string;
  COLOR_CLASS1?: string;
  PRINT_FRONT?: string;
  PRINT_BACK?: string;
  LINE_FRONT?: string;
  LINE_BACK?: string;
  FORM_CODE_NAME?: string;
  ITEM_IMAGE?: string;
  ETC_OTC_NAME?: string;
  CLASS_NAME?: string;
  MARK_CODE_FRONT_IMG?: string;
  MARK_CODE_BACK_IMG?: string;
  MARK_CODE_FRONT_ANAL?: string;
  MARK_CODE_BACK_ANAL?: string;
}

/** e약은요 raw item */
interface RawDetailItem {
  itemSeq?: string;
  itemName?: string;
  efcyQesitm?: string;
  useMethodQesitm?: string;
  atpnQesitm?: string;
  intrcQesitm?: string;
  seQesitm?: string;
  depositMethodQesitm?: string;
}

/** 워커가 정규화해 주는 제품 허가정보 폴백 아이템 */
interface RawPermitItem {
  itemSeq?: string;
  efcy?: string;
  useMethod?: string;
  atpn?: string;
  ingredient?: string;
}

/** 식약처 공통 응답 봉투: body.items 배열 */
interface ServiceEnvelope<T> {
  body?: { items?: T[]; totalCount?: number };
  // 일부 응답은 header.resultCode 로 에러를 표현
  header?: { resultCode?: string; resultMsg?: string };
}

function toPillResult(r: RawPillItem): PillResult {
  return {
    itemSeq: r.ITEM_SEQ ?? '',
    itemName: r.ITEM_NAME ?? '',
    entpName: r.ENTP_NAME ?? '',
    drugShape: r.DRUG_SHAPE || undefined,
    colorClass1: r.COLOR_CLASS1 || undefined,
    printFront: r.PRINT_FRONT || undefined,
    printBack: r.PRINT_BACK || undefined,
    lineFront: r.LINE_FRONT || undefined,
    lineBack: r.LINE_BACK || undefined,
    formCodeName: r.FORM_CODE_NAME || undefined,
    itemImage: r.ITEM_IMAGE || undefined,
    etcOtcName: r.ETC_OTC_NAME || undefined,
    className: r.CLASS_NAME || undefined,
    markFrontImg: r.MARK_CODE_FRONT_IMG || undefined,
    markBackImg: r.MARK_CODE_BACK_IMG || undefined,
    markFrontAnal: r.MARK_CODE_FRONT_ANAL || undefined,
    markBackAnal: r.MARK_CODE_BACK_ANAL || undefined,
  };
}

function toDrugDetail(r: RawDetailItem): DrugDetail {
  return {
    itemSeq: r.itemSeq ?? '',
    itemName: r.itemName || undefined,
    efcy: r.efcyQesitm || undefined,
    useMethod: r.useMethodQesitm || undefined,
    atpn: r.atpnQesitm || undefined,
    intrc: r.intrcQesitm || undefined,
    se: r.seQesitm || undefined,
    deposit: r.depositMethodQesitm || undefined,
  };
}

async function fetchJson<T>(url: string): Promise<ServiceEnvelope<T>> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new DrugApiError('네트워크 연결에 실패했습니다.', 'network');
  }
  if (!res.ok) {
    throw new DrugApiError(`서버 오류 (${res.status})`, 'server');
  }
  try {
    return (await res.json()) as ServiceEnvelope<T>;
  } catch {
    throw new DrugApiError('응답을 해석할 수 없습니다.', 'server');
  }
}

export function createWorkerClient(apiBase: string): DrugApi {
  const base = apiBase.replace(/\/$/, '');

  return {
    async searchPills(query: PillSearchQuery): Promise<PillResult[]> {
      const params = new URLSearchParams();
      if (query.itemName) params.set('item_name', query.itemName);
      if (query.entpName) params.set('entp_name', query.entpName);
      if (query.drugShape) params.set('drug_shape', query.drugShape);
      if (query.colorClass1) params.set('color_class1', query.colorClass1);
      if (query.printFront) params.set('print_front', query.printFront);
      if (query.formCodeName) params.set('form_code_name', query.formCodeName);
      params.set('pageNo', String(query.pageNo ?? 1));
      params.set('numOfRows', String(query.numOfRows ?? 30));

      const env = await fetchJson<RawPillItem>(`${base}/api/pills?${params}`);
      return (env.body?.items ?? []).map(toPillResult).filter((p) => p.itemSeq);
    },

    async getDetail(itemSeq: string, itemName?: string): Promise<DrugDetail | null> {
      const dp = new URLSearchParams({ itemSeq, pageNo: '1', numOfRows: '1' });
      const pp = new URLSearchParams({ itemSeq, pageNo: '1', numOfRows: '1' });
      if (itemName) pp.set('item_name', itemName);

      // e약은요(상세) + 허가정보(성분·문서 폴백) 동시 조회
      const [er, pr] = await Promise.allSettled([
        fetchJson<RawDetailItem>(`${base}/api/detail?${dp}`),
        fetchJson<RawPermitItem>(`${base}/api/permit?${pp}`),
      ]);
      const easyItem = er.status === 'fulfilled' ? er.value.body?.items?.[0] : undefined;
      const easy = easyItem ? toDrugDetail(easyItem) : null;
      const permit = pr.status === 'fulfilled' ? pr.value.body?.items?.[0] : undefined;
      const ingredient = permit?.ingredient;

      // 1) e약은요에 내용이 있으면 그걸 본문으로, 성분만 허가정보에서 보강
      if (easy && hasDetailContent(easy)) return { ...easy, ingredient, source: 'e약은요' };

      // 2) 허가정보 문서 폴백(전문약 등)
      if (permit && (permit.efcy || permit.useMethod || permit.atpn)) {
        return { itemSeq, efcy: permit.efcy, useMethod: permit.useMethod, atpn: permit.atpn, ingredient, source: '허가사항' };
      }

      // 3) 문서가 전혀 없어도 성분이 있으면 그것만이라도 제공
      if (ingredient) return { itemSeq, ingredient, source: '허가사항' };
      return easy;
    },
  };
}

/** efcy/useMethod/atpn/intrc/se/deposit 중 하나라도 내용이 있으면 true */
function hasDetailContent(d: DrugDetail): boolean {
  return [d.efcy, d.useMethod, d.atpn, d.intrc, d.se, d.deposit].some((v) => v && v.trim());
}
