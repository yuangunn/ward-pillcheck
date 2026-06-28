// 각인 180° 뒤집힘(상하반전) 매칭.
// 낱알을 거꾸로 집으면 각인이 뒤집혀 보인다(예: 각인 "SIH" → 거꾸로 보면 "HIS").
// 각 글자를 180° 회전한 글자로 바꾸고 순서를 뒤집어 "거꾸로 읽은 각인"을 만든다.
// 회전했을 때 유효한 글자가 아닌 문자가 하나라도 있으면 null 을 돌려준다
// (= 거꾸로는 안 읽히는 각인 → 뒤집힘 후보를 만들지 않아 오매칭을 막는다. 예: "PAR"↔"RAP" 차단).

/**
 * 180° 회전 시 다른 (유효한) 글자로 보이는 매핑.
 * 대문자·숫자만(낱알 각인은 영숫자 대문자). 자기 자신으로 보이는 대칭 글자 + 6↔9, M↔W.
 * 2·3·4·5·7 등은 회전했을 때 깔끔한 글자가 아니므로 의도적으로 제외(오매칭 방지).
 */
const ROT180: Record<string, string> = {
  '0': '0',
  '1': '1',
  '8': '8',
  '6': '9',
  '9': '6',
  H: 'H',
  I: 'I',
  N: 'N',
  O: 'O',
  S: 'S',
  X: 'X',
  Z: 'Z',
  M: 'W',
  W: 'M',
  ' ': ' ',
};

/**
 * 각인 문자열을 180° 뒤집어 읽은 형태. 모든 글자가 회전 가능해야 하며,
 * 하나라도 회전 불가 글자가 있으면 null(거꾸로는 못 읽음). 빈 결과도 null.
 * 예: "SIH" → "HIS", "OS" → "SO", "PAR" → null, "25" → null.
 */
export function imprintFlip180(s: string): string | null {
  let out = '';
  for (const ch of s.toUpperCase()) {
    const m = ROT180[ch];
    if (m === undefined) return null;
    out = m + out; // 앞에 붙여 글자 순서를 뒤집는다
  }
  return out.trim() ? out : null;
}

/**
 * 각인 hay(앞/뒤 각인 합본, 대문자)에 term 이 '그대로' 또는 '180° 뒤집어' 들어있는지.
 * - hit: 둘 중 하나라도 포함
 * - flipped: 그대로는 없고 뒤집어야만 일치한 경우 true (표시/강조용)
 * term 은 대문자 가정(호출부에서 .toUpperCase()).
 */
export function imprintHas(hayUpper: string, termUpper: string): { hit: boolean; flipped: boolean } {
  if (!termUpper) return { hit: false, flipped: false };
  if (hayUpper.includes(termUpper)) return { hit: true, flipped: false };
  const f = imprintFlip180(termUpper);
  if (f && hayUpper.includes(f)) return { hit: true, flipped: true };
  return { hit: false, flipped: false };
}
