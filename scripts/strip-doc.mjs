// 식약처 허가사항 문서(XML/CDATA) → 가독 평문화.
// 표·문단은 줄바꿈 보존, CDATA 마커 제거. build-dataset 와 테스트가 공유.

export function stripDoc(s) {
  if (typeof s !== 'string' || !s.trim()) return undefined;
  const text = s
    .replace(/<!\[CDATA\[/gi, '') // CDATA 시작
    .replace(/\]\]>/g, '') // CDATA 끝(남아서 ]]> 로 보이던 문제)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:article|section|paragraph|title|table|tr|tbody|thead|li|p|div)\s*>/gi, '\n') // 블록 끝 → 줄바꿈
    .replace(/<\/(?:td|th)\s*>/gi, ' ') // 표 셀 끝 → 공백
    .replace(/<[^>]+>/g, ' ') // 나머지 태그 제거
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&#x?[0-9a-fA-F]+;/g, ' ') // 기타 숫자 엔티티
    .replace(/[ \t ]+/g, ' ') // 가로공백 정리(줄바꿈 보존)
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n') // 빈줄 과다 정리
    .trim();
  return text || undefined;
}
