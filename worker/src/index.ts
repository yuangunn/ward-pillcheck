// Cloudflare Worker: 식약처 공공데이터 프록시.
// - serviceKey(인증키)를 환경변수(SERVICE_KEY)로 보관, 프론트에 노출하지 않음.
// - CORS 헤더를 부여해 브라우저 직접호출(CORS 차단) 문제를 해결.
// - 프론트는 이 Worker 의 /api/pills, /api/detail 만 호출.
//
// 공공데이터 엔드포인트(활용가이드 기준, 버전 suffix는 변경될 수 있어 env로 덮어쓰기 가능):
//   낱알식별:  https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03
//   e약은요:   https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList

export interface Env {
  SERVICE_KEY: string; // data.go.kr 일반 인증키(디코딩값). wrangler secret 으로 주입.
  PILL_ENDPOINT?: string;
  DETAIL_ENDPOINT?: string;
  PERMIT_ENDPOINT?: string;
  DUR_BASE?: string;
  ALLOW_ORIGIN?: string; // 기본 '*'. 운영 시 GitHub Pages 도메인으로 제한 권장.
}

const DEFAULT_PILL =
  'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03';
const DEFAULT_DETAIL =
  'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';
// 의약품 제품 허가정보(15095677) — e약은요에 없는 약(전문약 등) 상세 폴백용
const DEFAULT_PERMIT =
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService06/getDrugPrdtPrmsnDtlInq05';
// DUR 품목정보(15059486) — 병용금기/임부/노인/연령/효능군중복 점검
const DEFAULT_DUR_BASE = 'https://apis.data.go.kr/1471000/DURPrdlstInfoService03';
const DUR_OPS = {
  combo: 'getUsjntTabooInfoList03', // 병용금기
  pregnancy: 'getPwnmTabooInfoList03', // 임부금기
  elderly: 'getOdsnAtentInfoList03', // 노인주의
  age: 'getSpcifyAgrdeTabooInfoList03', // 특정연령대금기
  dup: 'getEfcyDplctInfoList03', // 효능군중복
} as const;

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN ?? '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env) },
  });
}

/** 허가정보 효능/용법/주의 필드는 XML 문서 문자열 — 태그 제거 후 평문화 */
function stripDoc(s: unknown): string | undefined {
  if (typeof s !== 'string' || !s.trim()) return undefined;
  const text = s
    .replace(/<[^>]+>/g, ' ') // 태그 제거
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || undefined;
}

/** 다양한 공공데이터 JSON 봉투에서 items 배열을 안전하게 추출 */
function extractItems(payload: any): any[] {
  const items = payload?.body?.items ?? payload?.response?.body?.items;
  if (Array.isArray(items)) return items;
  if (items && typeof items === 'object') return [items]; // 단건이 객체로 올 때
  return [];
}

type FetchResult = { items: any[] } | { error: Response };

/** 상위 API 한 번 호출 → items 배열 또는 에러 Response */
async function fetchItems(base: string, params: URLSearchParams, env: Env): Promise<FetchResult> {
  if (!env.SERVICE_KEY) return { error: json({ error: 'SERVICE_KEY 미설정' }, env, 500) };
  params.set('serviceKey', env.SERVICE_KEY);
  params.set('type', 'json');

  let res: Response;
  try {
    res = await fetch(`${base}?${params.toString()}`);
  } catch {
    return { error: json({ error: 'upstream fetch 실패' }, env, 502) };
  }
  if (!res.ok) return { error: json({ error: `upstream ${res.status}` }, env, 502) };
  try {
    return { items: extractItems(await res.json()) };
  } catch {
    return { error: json({ error: 'upstream non-JSON 응답', items: [] }, env, 502) };
  }
}

/** 낱알식별 검색 파라미터(프론트가 보내는 스네이크 표기) */
interface PillQuery {
  item_name?: string;
  entp_name?: string;
  drug_shape?: string;
  color_class1?: string;
  print_front?: string;
  form_code_name?: string;
  numOfRows: number;
}

/** 상위 API 에 보낼 파라미터(스네이크+카멜 동시 전송 — 어느 쪽을 받든 동작). */
function buildPillParams(q: PillQuery, pageNo: number, pageSize: number): URLSearchParams {
  const p = new URLSearchParams();
  const setBoth = (snake: string, camel: string, v?: string) => {
    if (v) {
      p.set(snake, v);
      p.set(camel, v);
    }
  };
  setBoth('item_name', 'itemName', q.item_name);
  setBoth('entp_name', 'entpName', q.entp_name);
  setBoth('drug_shape', 'drugShape', q.drug_shape);
  setBoth('color_class1', 'colorClass1', q.color_class1);
  setBoth('print_front', 'printFront', q.print_front);
  setBoth('form_code_name', 'formCodeName', q.form_code_name);
  p.set('pageNo', String(pageNo));
  p.set('numOfRows', String(pageSize));
  return p;
}

/** 외형 조건(색/모양/각인)으로 한 건이 일치하는지 — 상위 API 가 필터를 무시할 때의 안전망 */
function matchesAppearance(item: any, q: PillQuery): boolean {
  if (q.color_class1) {
    const c1 = item.COLOR_CLASS1 ?? '';
    const c2 = item.COLOR_CLASS2 ?? '';
    if (!c1.includes(q.color_class1) && !c2.includes(q.color_class1)) return false;
  }
  if (q.drug_shape && (item.DRUG_SHAPE ?? '') !== q.drug_shape) return false;
  if (q.print_front) {
    const needle = q.print_front.toUpperCase();
    // 각인(앞/뒤) + 마크 분석 텍스트(앞/뒤)까지 포함
    const hay = [
      item.PRINT_FRONT,
      item.PRINT_BACK,
      item.MARK_CODE_FRONT_ANAL,
      item.MARK_CODE_BACK_ANAL,
    ]
      .map((v: unknown) => (typeof v === 'string' ? v.toUpperCase() : ''))
      .join(' ');
    if (!hay.includes(needle)) return false;
  }
  return true;
}

/**
 * 낱알식별 검색. 상위 API 가 외형 파라미터를 무시하는 경우가 있어,
 * 외형 조건이 있으면 여러 페이지를 받아 워커에서 직접 필터링한다.
 */
async function searchPills(q: PillQuery, env: Env): Promise<Response> {
  const base = env.PILL_ENDPOINT ?? DEFAULT_PILL;
  const appearance = !!(q.color_class1 || q.drug_shape || q.print_front);
  const pageSize = appearance ? 100 : q.numOfRows;
  const maxPages = appearance ? 10 : 1; // 외형 검색은 최대 1000건까지 훑어 매칭

  const matches: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await fetchItems(base, buildPillParams(q, page, pageSize), env);
    if ('error' in r) {
      if (matches.length) break; // 일부라도 모았으면 그걸로 응답
      return r.error;
    }
    for (const it of r.items) {
      if (matchesAppearance(it, q)) matches.push(it);
    }
    if (matches.length >= q.numOfRows) break; // 충분히 모음
    if (r.items.length < pageSize) break; // 마지막 페이지
  }
  return json({ body: { items: matches.slice(0, q.numOfRows) } }, env);
}

/** DUR 한 품목 점검 — 5개 카테고리를 동시 조회해 정규화 */
async function durForItem(itemSeq: string, env: Env): Promise<Response> {
  const base = (env.DUR_BASE ?? DEFAULT_DUR_BASE).replace(/\/$/, '');
  const params = () => new URLSearchParams({ item_seq: itemSeq, itemSeq, pageNo: '1', numOfRows: '100' });

  const cats = Object.entries(DUR_OPS) as [keyof typeof DUR_OPS, string][];
  const results = await Promise.allSettled(
    cats.map(([, op]) => fetchItems(`${base}/${op}`, params(), env)),
  );

  const text = (it: any): string | undefined =>
    stripDoc(it.PROHBT_CONTENT ?? it.REMARK ?? it.NB_DOC_DATA ?? it.TYPE_NAME);

  const dur: Record<string, unknown[]> = {};
  results.forEach((res, i) => {
    const key = cats[i][0];
    const items = res.status === 'fulfilled' && 'items' in res.value ? res.value.items : [];
    if (key === 'combo') {
      dur.combo = items
        .map((it: any) => ({
          seq: it.MIXTURE_ITEM_SEQ ?? '',
          name: it.MIXTURE_ITEM_NAME ?? '',
          content: text(it),
        }))
        .filter((x: any) => x.seq || x.name);
    } else {
      dur[key] = items.map((it: any) => ({ content: text(it), name: it.ITEM_NAME })).filter((x: any) => x.content);
    }
  });

  return json({ body: { itemSeq, dur } }, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors(env) });
    }
    const url = new URL(request.url);

    if (url.pathname === '/api/pills') {
      const q = url.searchParams;
      const num = Number(q.get('numOfRows')) || 30;
      return searchPills(
        {
          item_name: q.get('item_name') || undefined,
          entp_name: q.get('entp_name') || undefined,
          drug_shape: q.get('drug_shape') || undefined,
          color_class1: q.get('color_class1') || undefined,
          print_front: q.get('print_front') || undefined,
          form_code_name: q.get('form_code_name') || undefined,
          numOfRows: Math.min(Math.max(num, 1), 100),
        },
        env,
      );
    }

    if (url.pathname === '/api/detail') {
      const itemSeq = url.searchParams.get('itemSeq');
      if (!itemSeq) return json({ error: 'itemSeq 필요', body: { items: [] } }, env, 400);
      const params = new URLSearchParams({ itemSeq, pageNo: '1', numOfRows: '1' });
      const r = await fetchItems(env.DETAIL_ENDPOINT ?? DEFAULT_DETAIL, params, env);
      return 'error' in r ? r.error : json({ body: { items: r.items } }, env);
    }

    // 제품 허가정보(효능/용법/주의) — e약은요 폴백
    if (url.pathname === '/api/permit') {
      const itemSeq = url.searchParams.get('itemSeq');
      if (!itemSeq) return json({ error: 'itemSeq 필요', body: { items: [] } }, env, 400);
      const params = new URLSearchParams({
        item_seq: itemSeq,
        itemSeq, // 스네이크+카멜 동시
        pageNo: '1',
        numOfRows: '1',
      });
      const r = await fetchItems(env.PERMIT_ENDPOINT ?? DEFAULT_PERMIT, params, env);
      if ('error' in r) return r.error;
      const it = r.items[0] ?? {};
      const norm = {
        itemSeq,
        efcy: stripDoc(it.EE_DOC_DATA),
        useMethod: stripDoc(it.UD_DOC_DATA),
        atpn: stripDoc(it.NB_DOC_DATA),
      };
      return json({ body: { items: [norm] } }, env);
    }

    // DUR 점검: 병용금기/임부/노인/연령/효능군중복 (한 품목)
    if (url.pathname === '/api/dur') {
      const itemSeq = url.searchParams.get('itemSeq');
      if (!itemSeq) return json({ error: 'itemSeq 필요', dur: {} }, env, 400);
      return durForItem(itemSeq, env);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'ward-pillcheck-proxy' }, env);
    }

    return json({ error: 'not found' }, env, 404);
  },
};
