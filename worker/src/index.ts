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
  PERMIT_LIST_ENDPOINT?: string;
  DUR_BASE?: string;
  ALLOW_ORIGIN?: string; // 기본 '*'. 운영 시 GitHub Pages 도메인으로 제한 권장.
}

const DEFAULT_PILL =
  'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03';
const DEFAULT_DETAIL =
  'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';
// 의약품 제품 허가정보(15095677) — e약은요에 없는 약(전문약 등) 상세 폴백용.
// 효능/용법/주의 문서(EE/UD/NB_DOC_DATA)는 "허가 상세정보" 오퍼레이션에 있다.
// data.go.kr 확인: 베이스 DrugPrdtPrmsnInfoService07, 상세 op = getDrugPrdtPrmsnDtlInq06.
const PERMIT_CANDIDATES = [
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06',
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService06/getDrugPrdtPrmsnDtlInq06',
];
// DUR 품목정보(15059486) — 병용금기/임부/노인/연령/효능군중복 점검
// 허가정보 목록(이름검색) — 주사제 포함 전 품목
const DEFAULT_PERMIT_LIST =
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq07';
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

/** 허가사항 문서(XML/CDATA) → 가독 평문화. 표·문단은 줄바꿈 보존. */
function stripDoc(s: unknown): string | undefined {
  if (typeof s !== 'string' || !s.trim()) return undefined;
  const text = s
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:article|section|paragraph|title|table|tr|tbody|thead|li|p|div)\s*>/gi, '\n')
    .replace(/<\/(?:td|th)\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&#x?[0-9a-fA-F]+;/g, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
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

/**
 * 주성분 조회 — 허가 목록(getDrugPrdtPrmsnInq07)에서.
 * item_name 으로 받아 ITEM_SEQ 가 정확히 일치하는 건만 채택(이름검색이 신뢰도 높고,
 * seq 일치로 오매칭을 막는다). itemName 이 없으면 item_seq 필터로 시도.
 */
async function fetchIngredient(itemSeq: string, itemName: string | undefined, env: Env): Promise<string | undefined> {
  const ep = env.PERMIT_LIST_ENDPOINT ?? DEFAULT_PERMIT_LIST;
  const p = new URLSearchParams({ pageNo: '1', numOfRows: '30' });
  if (itemName) {
    p.set('item_name', itemName);
    p.set('itemName', itemName);
  } else {
    p.set('item_seq', itemSeq);
    p.set('itemSeq', itemSeq);
  }
  const r = await fetchItems(ep, p, env);
  if ('error' in r || !r.items.length) return undefined;
  const exact = r.items.find((it: any) => String(it.ITEM_SEQ) === itemSeq);
  const hit: any = exact ?? (itemName ? undefined : r.items[0]);
  if (!hit) return undefined;
  const ingr = (hit.ITEM_INGR_NAME || hit.MAIN_ITEM_INGR || '').toString().trim();
  return ingr || undefined;
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

    // 제품 허가정보(효능/용법/주의 + 주성분) — e약은요 폴백 / 성분 보강
    if (url.pathname === '/api/permit') {
      const itemSeq = url.searchParams.get('itemSeq');
      if (!itemSeq) return json({ error: 'itemSeq 필요', body: { items: [] } }, env, 400);
      const itemName = url.searchParams.get('item_name') || undefined;
      const params = new URLSearchParams({
        item_seq: itemSeq,
        itemSeq, // 스네이크+카멜 동시
        pageNo: '1',
        numOfRows: '1',
      });
      const pick = (it: any, ...names: string[]): string | undefined => {
        for (const n of names) {
          const v = stripDoc(it[n]);
          if (v) return v;
        }
        return undefined;
      };

      // 0) 주성분: 허가 목록에서 — 이름으로 받아 ITEM_SEQ 정확히 일치하는 건만 채택(오매칭 방지)
      let ingredient = await fetchIngredient(itemSeq, itemName, env);

      const candidates = env.PERMIT_ENDPOINT ? [env.PERMIT_ENDPOINT] : PERMIT_CANDIDATES;
      const debug = url.searchParams.get('debug');
      const tried: unknown[] = [];

      // 1) 후보 상세 엔드포인트를 순서대로 시도해 문서가 나오는 것을 채택
      for (const ep of candidates) {
        const r = await fetchItems(ep, new URLSearchParams(params), env);
        if ('error' in r) {
          if (debug) tried.push({ ep, error: true });
          continue;
        }
        const it: any = r.items[0] ?? {};
        const norm = {
          itemSeq,
          efcy: pick(it, 'EE_DOC_DATA', 'EE_DOC', 'eeDocData', 'efcyQesitm'),
          useMethod: pick(it, 'UD_DOC_DATA', 'UD_DOC', 'udDocData', 'useMethodQesitm'),
          atpn: pick(it, 'NB_DOC_DATA', 'NB_DOC', 'nbDocData', 'atpnQesitm'),
          ingredient,
        };
        if (debug) tried.push({ ep, count: r.items.length, keys: Object.keys(it) });
        if (norm.efcy || norm.useMethod || norm.atpn) {
          return debug ? json({ debug: { tried, hit: ep } }, env) : json({ body: { items: [norm] } }, env);
        }
      }
      // 문서가 없어도 성분만이라도 반환
      return debug
        ? json({ debug: { tried, hit: null, ingredient } }, env)
        : json({ body: { items: [{ itemSeq, ingredient }] } }, env);
    }

    // DUR 점검: 병용금기/임부/노인/연령/효능군중복 (한 품목)
    if (url.pathname === '/api/dur') {
      const itemSeq = url.searchParams.get('itemSeq');
      if (!itemSeq) return json({ error: 'itemSeq 필요', dur: {} }, env, 400);
      return durForItem(itemSeq, env);
    }

    // 의약품 허가정보 이름검색(주사제 등 낱알식별에 없는 약). inj=1 시 주사제 위주 필터.
    if (url.pathname === '/api/drugsearch') {
      const name = url.searchParams.get('item_name');
      if (!name) return json({ body: { items: [] } }, env);
      const inj = url.searchParams.get('inj') === '1';
      const params = new URLSearchParams({ item_name: name, itemName: name, pageNo: '1', numOfRows: '30' });
      const r = await fetchItems(env.PERMIT_LIST_ENDPOINT ?? DEFAULT_PERMIT_LIST, params, env);
      if ('error' in r) return r.error;
      let items = r.items
        .map((it: any) => ({
          itemSeq: it.ITEM_SEQ ?? '',
          itemName: it.ITEM_NAME ?? '',
          entpName: it.ENTP_NAME ?? '',
          ingredient: it.ITEM_INGR_NAME || undefined,
          etcOtcName: it.SPCLTY_PBLC || undefined,
          itemImage: it.BIG_PRDT_IMG_URL || undefined,
        }))
        .filter((x: { itemSeq: string }) => x.itemSeq);
      if (inj) {
        // 외용약·주사제(낱알 모양 없는 비경구 약) 위주 필터
        const re = /(주사|주입|펜|카트리지|바이알|키트|프리필드|주사액|주사제|인슐린|플렉스|퀵펜|주\)|주$|흡입|에보할러|할러|디스커스|레스피맷|터부할러|네뷸|점안|점이|점비|좌제|좌약|질정|질좌|연고|크림|로션|겔|젤|패치|첩부|스프레이|분무|에어로|도포|외용|카타리)/;
        const filtered = items.filter((x: { itemName: string }) => re.test(x.itemName));
        if (filtered.length) items = filtered;
      }
      return json({ body: { items } }, env);
    }

    // 이미지 프록시(마크/낱알/제품 이미지). nedrug 가 charset 붙은 content-type·크로스사이트로
    // 모바일 브라우저에서 안 뜨는 문제 → 헤더 정리 + CORS 부여해 중계.
    if (url.pathname === '/api/img') {
      const u = url.searchParams.get('u');
      if (!u) return json({ error: 'u 필요' }, env, 400);
      let target: URL;
      try {
        target = new URL(u);
      } catch {
        return json({ error: 'bad url' }, env, 400);
      }
      if (target.hostname !== 'nedrug.mfds.go.kr') {
        return json({ error: 'forbidden host' }, env, 403);
      }
      let res: Response;
      try {
        // nedrug 은 브라우저 UA/Referer 없는 요청을 막는 경우가 있어 헤더를 부여
        res = await fetch(target.toString(), {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            Referer: 'https://nedrug.mfds.go.kr/',
            Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
          },
        });
      } catch {
        // 프록시 fetch 자체 실패 → 브라우저가 원본을 직접 받도록 리다이렉트(새 탭/이미지 모두 깨지지 않음)
        return Response.redirect(target.toString(), 302);
      }
      // nedrug↔CF 간 TLS 실패(525) 등 업스트림 5xx → JSON 대신 원본으로 폴백 리다이렉트.
      // (새 탭으로 열었을 때 {"error":"img 525"} 가 그대로 렌더되던 문제 방지)
      if (!res.ok) return Response.redirect(target.toString(), 302);
      const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      const body = await res.arrayBuffer();
      return new Response(body, {
        headers: {
          'Content-Type': ct || 'image/jpeg',
          'Cache-Control': 'public, max-age=604800',
          ...cors(env),
        },
      });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'ward-pillcheck-proxy' }, env);
    }

    return json({ error: 'not found' }, env, 404);
  },
};
