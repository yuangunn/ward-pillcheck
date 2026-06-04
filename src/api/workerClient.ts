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

    async getDetail(itemSeq: string): Promise<DrugDetail | null> {
      const params = new URLSearchParams({ itemSeq, pageNo: '1', numOfRows: '1' });
      // 1) e약은요
      const env = await fetchJson<RawDetailItem>(`${base}/api/detail?${params}`);
      const item = env.body?.items?.[0];
      const easy = item ? toDrugDetail(item) : null;
      if (easy && hasDetailContent(easy)) return { ...easy, source: 'e약은요' };

      // 2) 제품 허가정보 폴백 (전문약 등 e약은요에 없는 약)
      try {
        const penv = await fetchJson<RawPermitItem>(`${base}/api/permit?${params}`);
        const p = penv.body?.items?.[0];
        const permit: DrugDetail | null = p
          ? { itemSeq, efcy: p.efcy, useMethod: p.useMethod, atpn: p.atpn, source: '허가사항' }
          : null;
        if (permit && hasDetailContent(permit)) return permit;
      } catch {
        /* 폴백 실패 — e약은요 결과(없으면 null) 반환 */
      }
      return easy;
    },
  };
}

/** efcy/useMethod/atpn/intrc/se/deposit 중 하나라도 내용이 있으면 true */
function hasDetailContent(d: DrugDetail): boolean {
  return [d.efcy, d.useMethod, d.atpn, d.intrc, d.se, d.deposit].some((v) => v && v.trim());
}
