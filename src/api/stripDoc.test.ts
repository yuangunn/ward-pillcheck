import { describe, it, expect } from 'vitest';
// @ts-ignore - 빌드 스크립트와 공유하는 JS 모듈(타입 없음)
import { stripDoc } from '../../scripts/strip-doc.mjs';

// 실제 식약처 허가사항 NB_DOC_DATA 형태(CDATA + 표 + 문단)를 본떠 회귀 테스트.
// 예전엔 CDATA 마커(]]>)가 남고 표가 한 줄로 뭉개져 깨져 보였음.
const SAMPLE_NB = `<DOC title="사용상의주의사항"><SECTION title="">` +
  `<ARTICLE title="2. 다음 환자에는 투여하지 말 것"><PARAGRAPH><![CDATA[1) 이 약의 성분에 과민증 환자]]></PARAGRAPH></ARTICLE>` +
  `<ARTICLE title="3. 이상반응"><PARAGRAPH>발현빈도는 다음과 같다.(6. 상호작용 항 참조)</PARAGRAPH>` +
  `<TABLE><TBODY>` +
  `<TR><TD>발현부위</TD><TD>발현빈도</TD><TD>발현증상</TD></TR>` +
  `<TR><TD>신경계 질환</TD><TD>흔하게</TD><TD>두통, 어지러움</TD></TR>` +
  `<TR><TD>위장관 질환</TD><TD>흔하지 않게</TD><TD>소화불량, 구토</TD></TR>` +
  `</TBODY></TABLE></ARTICLE></SECTION></DOC>`;

describe('stripDoc — 허가사항 평문화', () => {
  const out = stripDoc(SAMPLE_NB) as string;

  it('CDATA 마커(]]>, <![CDATA[)가 남지 않는다', () => {
    expect(out).not.toContain(']]>');
    expect(out).not.toContain('<![CDATA[');
  });

  it('XML 태그가 남지 않는다', () => {
    expect(out).not.toMatch(/<\/?[a-zA-Z]/);
  });

  it('표의 행이 줄로 분리되고 셀은 공백 구분된다', () => {
    expect(out).toContain('발현부위 발현빈도 발현증상');
    expect(out).toContain('신경계 질환 흔하게 두통, 어지러움');
    // 헤더행과 데이터행이 다른 줄
    expect(out).toMatch(/발현증상\n신경계 질환/);
  });

  it('문단 텍스트가 보존된다', () => {
    expect(out).toContain('이 약의 성분에 과민증 환자');
    expect(out).toContain('상호작용 항 참조');
  });

  it('한 줄로 뭉개지지 않는다(여러 줄)', () => {
    expect(out.split('\n').length).toBeGreaterThan(3);
  });

  it('빈/무의미 입력은 undefined', () => {
    expect(stripDoc('')).toBeUndefined();
    expect(stripDoc('   ')).toBeUndefined();
    expect(stripDoc(null)).toBeUndefined();
    expect(stripDoc('<DOC></DOC>')).toBeUndefined();
  });
});
