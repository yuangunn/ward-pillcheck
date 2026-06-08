// Teams 인계 보내기 대상(공용계정/그룹채팅 이메일) — 병동별로 설정 ⚙️에서 지정.
// 딥링크로 Teams 를 열어 인계 텍스트를 입력창에 자동으로 채운다(전송은 사용자가 탭).

const KEY = 'ward-pillcheck:teamsTarget';
const ALLOWED_KEY = 'ward-pillcheck:teamsAllowedDomains';

export function getTeamsTarget(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setTeamsTarget(v: string): void {
  try {
    const t = v.trim();
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** 설정에서 추가한 우리 병원 허용 도메인 목록(쉼표/공백 구분). 예: "snuh.org amc.seoul.kr" */
export function getAllowedDomains(): string[] {
  try {
    return (localStorage.getItem(ALLOWED_KEY) ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function setAllowedDomains(v: string): void {
  try {
    const t = v.trim();
    if (t) localStorage.setItem(ALLOWED_KEY, t);
    else localStorage.removeItem(ALLOWED_KEY);
  } catch {
    /* ignore */
  }
}

/** 대상 계정이 허용 도메인이 아닐 때 보여줄 안내 문구. */
export const TEAMS_TARGET_GUIDE =
  '병원 공용 Teams 혹은 본인 병원 Teams 계정을 입력하세요. (대학·대학병원 .ac.kr/.ac 또는 설정에 등록한 병원 도메인)';

/**
 * Teams 대상 허용 여부: 학교·대학병원(.ac.kr/.ac)으로 끝나거나,
 * 설정에 등록한 우리 병원 도메인으로 끝나면 허용. (원외 일반 계정 차단)
 */
export function isAllowedTeamsTarget(email: string): boolean {
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 1 || at === e.length - 1) return false; // 로컬·도메인이 모두 있어야 함
  const domain = e.slice(at + 1);
  if (/\.ac\.kr$/.test(domain) || /\.ac$/.test(domain)) return true;
  return getAllowedDomains().some((d) => domain === d || domain.endsWith('.' + d));
}

/**
 * Teams 딥링크. target(이메일)이 있으면 그 대화방을 열고, 없으면 새 채팅에 메시지만 채운다.
 * 모든 업무폰이 같은 공용계정으로 로그인돼 있으면 target=공용계정 → 자기 자신(공용계정)에게
 * 보내져 공용 인계 로그처럼 동작.
 */
export function teamsDeepLink(text: string, target?: string): string {
  const users = (target ?? getTeamsTarget()).trim();
  // URLSearchParams는 공백을 '+'로 인코딩하는데, Teams 딥링크는 '+'를 리터럴 문자로
  // 받아 인계문의 띄어쓰기가 전부 '+'로 깨진다. encodeURIComponent는 공백을 %20으로
  // 인코딩하므로 직접 쿼리스트링을 조립한다.
  const parts: string[] = [];
  if (users) parts.push(`users=${encodeURIComponent(users)}`);
  parts.push(`message=${encodeURIComponent(text)}`);
  return `https://teams.microsoft.com/l/chat/0/0?${parts.join('&')}`;
}
