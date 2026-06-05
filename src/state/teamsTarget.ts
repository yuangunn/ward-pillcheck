// Teams 인계 보내기 대상(공용계정/그룹채팅 이메일) — 병동별로 설정 ⚙️에서 지정.
// 딥링크로 Teams 를 열어 인계 텍스트를 입력창에 자동으로 채운다(전송은 사용자가 탭).

const KEY = 'ward-pillcheck:teamsTarget';

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

/**
 * Teams 딥링크. target(이메일)이 있으면 그 대화방을 열고, 없으면 새 채팅에 메시지만 채운다.
 * 모든 업무폰이 같은 공용계정으로 로그인돼 있으면 target=공용계정 → 자기 자신(공용계정)에게
 * 보내져 공용 인계 로그처럼 동작.
 */
export function teamsDeepLink(text: string, target?: string): string {
  const users = (target ?? getTeamsTarget()).trim();
  const params = new URLSearchParams();
  if (users) params.set('users', users);
  params.set('message', text);
  return `https://teams.microsoft.com/l/chat/0/0?${params.toString()}`;
}
