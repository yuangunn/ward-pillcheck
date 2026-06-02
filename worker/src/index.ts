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
  ALLOW_ORIGIN?: string; // 기본 '*'. 운영 시 GitHub Pages 도메인으로 제한 권장.
}

const DEFAULT_PILL =
  'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03';
const DEFAULT_DETAIL =
  'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';

// 프론트가 보낼 수 있는 낱알식별 파라미터 화이트리스트
const PILL_PARAMS = [
  'item_name',
  'entp_name',
  'drug_shape',
  'color_class1',
  'print_front',
  'form_code_name',
  'pageNo',
  'numOfRows',
];

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

/** 다양한 공공데이터 JSON 봉투에서 items 배열을 안전하게 추출 */
function extractItems(payload: any): any[] {
  const items = payload?.body?.items ?? payload?.response?.body?.items;
  if (Array.isArray(items)) return items;
  if (items && typeof items === 'object') return [items]; // 단건이 객체로 올 때
  return [];
}

async function callUpstream(base: string, params: URLSearchParams, env: Env): Promise<Response> {
  if (!env.SERVICE_KEY) {
    return json({ error: 'SERVICE_KEY 미설정' }, env, 500);
  }
  params.set('serviceKey', env.SERVICE_KEY);
  params.set('type', 'json');

  const upstream = `${base}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(upstream);
  } catch {
    return json({ error: 'upstream fetch 실패' }, env, 502);
  }
  if (!res.ok) {
    return json({ error: `upstream ${res.status}` }, env, 502);
  }

  let payload: any;
  try {
    payload = await res.json();
  } catch {
    // 일부 오류는 XML 로 옴 → 그대로 에러 처리
    return json({ error: 'upstream non-JSON 응답', items: [] }, env, 502);
  }

  // 프론트가 기대하는 { body: { items } } 형태로 정규화
  return json({ body: { items: extractItems(payload) } }, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors(env) });
    }
    const url = new URL(request.url);

    if (url.pathname === '/api/pills') {
      const params = new URLSearchParams();
      for (const key of PILL_PARAMS) {
        const v = url.searchParams.get(key);
        if (v) params.set(key, v);
      }
      return callUpstream(env.PILL_ENDPOINT ?? DEFAULT_PILL, params, env);
    }

    if (url.pathname === '/api/detail') {
      const itemSeq = url.searchParams.get('itemSeq');
      if (!itemSeq) return json({ error: 'itemSeq 필요', body: { items: [] } }, env, 400);
      const params = new URLSearchParams({ itemSeq, pageNo: '1', numOfRows: '1' });
      return callUpstream(env.DETAIL_ENDPOINT ?? DEFAULT_DETAIL, params, env);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'ward-pillcheck-proxy' }, env);
    }

    return json({ error: 'not found' }, env, 404);
  },
};
