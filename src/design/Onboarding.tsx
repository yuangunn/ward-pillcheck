import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, PillGlyph, ShapeOutline, MarkGlyph } from './Icon';

// 카드뉴스형 온보딩(10장). 폰 크기 적응 · 좌우 스와이프 · 점 · 다음/시작하기.
// PWA standalone 첫 실행 시 표시, 마지막 카드는 설치 여부(standalone)로 분기.

export function isStandalone(): boolean {
  try {
    return (
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

// 작은 로고 글리프 (돋보기+알약)
function ObLogo({ size = 92 }: { size?: number }) {
  const lensCx = 232,
    lensCy = 224,
    lensR = 132,
    ringW = 36;
  const ang = Math.PI / 4,
    hStart = lensR + ringW / 2 - 8,
    hEnd = lensR + ringW / 2 + 70;
  const hx1 = lensCx + Math.cos(ang) * hStart,
    hy1 = lensCy + Math.sin(ang) * hStart;
  const hx2 = lensCx + Math.cos(ang) * hEnd,
    hy2 = lensCy + Math.sin(ang) * hEnd;
  const k = 0.18,
    c = 0.42,
    S = 512;
  const sq = [
    `M ${(S * k).toFixed(1)},0`,
    `L ${(S * (1 - k)).toFixed(1)},0`,
    `C ${(S * (1 - k * c)).toFixed(1)},0 ${S},${(S * k * c).toFixed(1)} ${S},${(S * k).toFixed(1)}`,
    `L ${S},${(S * (1 - k)).toFixed(1)}`,
    `C ${S},${(S * (1 - k * c)).toFixed(1)} ${(S * (1 - k * c)).toFixed(1)},${S} ${(S * (1 - k)).toFixed(1)},${S}`,
    `L ${(S * k).toFixed(1)},${S}`,
    `C ${(S * k * c).toFixed(1)},${S} 0,${(S * (1 - k * c)).toFixed(1)} 0,${(S * (1 - k)).toFixed(1)}`,
    `L 0,${(S * k).toFixed(1)}`,
    `C 0,${(S * k * c).toFixed(1)} ${(S * k * c).toFixed(1)},0 ${(S * k).toFixed(1)},0`,
    'Z',
  ].join(' ');
  const gid = `ob${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: 'block', filter: 'drop-shadow(0 8px 18px rgba(0,0,0,.25))' }} aria-hidden>
      <defs>
        <linearGradient id={`${gid}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b78ff" />
          <stop offset="1" stopColor="#2360ee" />
        </linearGradient>
        <linearGradient id={`${gid}cap`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#dbe7ff" />
        </linearGradient>
        <clipPath id={`${gid}sq`}>
          <path d={sq} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${gid}sq)`}>
        <rect width="512" height="512" fill={`url(#${gid}bg)`} />
        <line x1={hx1.toFixed(1)} y1={hy1.toFixed(1)} x2={hx2.toFixed(1)} y2={hy2.toFixed(1)} stroke="#fff" strokeWidth="46" strokeLinecap="round" />
        <circle cx={lensCx} cy={lensCy} r={lensR - ringW / 2 - 2} fill="#fff" />
        <g transform={`rotate(-38 ${lensCx} ${lensCy})`}>
          <rect x={lensCx - 86} y={lensCy - 30} width="172" height="60" rx="30" fill="#bcd2ff" />
          <path d={`M ${lensCx - 86} ${lensCy - 30} h 86 v 60 h -86 a30 30 0 0 1 -30 -30 a30 30 0 0 1 30 -30 z`} fill={`url(#${gid}cap)`} />
          <rect x={lensCx - 3} y={lensCy - 30} width="6" height="60" fill="#fff" opacity="0.85" />
        </g>
        <circle cx={lensCx} cy={lensCy} r={lensR} fill="none" stroke="#fff" strokeWidth={ringW} />
      </g>
    </svg>
  );
}

function ObKicker({ n, children, onBlue }: { n: ReactNode; children: ReactNode; onBlue?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, background: onBlue ? 'rgba(255,255,255,.2)' : 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
      <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.3, whiteSpace: 'nowrap', color: onBlue ? 'rgba(255,255,255,.85)' : 'var(--primary-ink)' }}>{children}</span>
    </div>
  );
}
function ObH2({ children, onBlue }: { children: ReactNode; onBlue?: boolean }) {
  return <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.25, fontWeight: 800, letterSpacing: -0.9, color: onBlue ? '#fff' : 'var(--text-strong)' }}>{children}</h2>;
}
function ObLead({ children, onBlue }: { children: ReactNode; onBlue?: boolean }) {
  return <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, fontWeight: 600, letterSpacing: -0.3, color: onBlue ? 'rgba(255,255,255,.9)' : 'var(--text-weak)' }}>{children}</p>;
}
function Em({ children, onBlue }: { children: ReactNode; onBlue?: boolean }) {
  return <span style={{ color: onBlue ? '#fff' : 'var(--primary)', fontWeight: 800 }}>{children}</span>;
}
function ObPillRow({ color, shape, marking, name, tags }: { color?: string; shape?: string; marking?: string; name: string; tags?: { label: string; pri?: boolean }[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 'var(--r-card)', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <PillGlyph color={color} shape={shape} marking={marking} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.4, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        {tags && (
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {tags.map((t, i) => (
              <span key={i} style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 7px', borderRadius: 7, whiteSpace: 'nowrap', background: t.pri ? 'var(--primary-weak)' : 'var(--fill)', color: t.pri ? 'var(--primary-ink)' : 'var(--text-weak)' }}>{t.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Slide {
  blue?: boolean;
  body: ReactNode;
}

function obSlides(standalone: boolean): Slide[] {
  const drawSvg = (
    <svg width="120" height="120" viewBox="0 0 220 220">
      <path d="M110 40 C 108 90 112 130 110 180" stroke="var(--text-strong)" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M44 110 C 90 108 130 112 176 110" stroke="var(--text-strong)" strokeWidth="14" fill="none" strokeLinecap="round" />
    </svg>
  );
  const chips: [string, boolean | string][] = [
    ['하양', true],
    ['노랑', false],
    ['원형', 'shape'],
    ['장방형', 'shape2'],
    ['육각형', 'shape3'],
  ];
  return [
    // 0 cover
    {
      blue: true,
      body: (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 26 }}>
            <ObLogo size={88} />
          </div>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.12, fontWeight: 800, letterSpacing: -1.4, color: '#fff' }}>
            쉽게 찾고,
            <br />
            쉽게 공유하세요.
          </h1>
          <p style={{ margin: '18px 0 0', fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: 'rgba(255,255,255,.88)', letterSpacing: -0.3 }}>
            색·모양만으로 30초 만에 찾고,
            <br />
            인계는 복사 한 번으로 끝내는 병동 도구
          </p>
        </div>
      ),
    },
    // 1 problem
    {
      body: (
        <>
          <ObKicker n="!">이런 적, 있으시죠?</ObKicker>
          <ObH2>
            이름표도 없는
            <br />
            알약 한 봉지.
          </ObH2>
          <ObLead>
            환자가 집에서 가져온 약 한 봉지.
            <br />
            <Em>EMR 켜고, 팜밴 켜고,</Em> 하나하나 식별해 일일이 옮겨 적으셨나요?
          </ObLead>
          <div style={{ marginTop: 22 }}>
            <ObPillRow color="하양" shape="원형" marking="" name="이게 무슨 약이지…?" />
          </div>
        </>
      ),
    },
    // 2 색·모양
    {
      body: (
        <>
          <ObKicker n="1">폰에서, 색·모양으로</ObKicker>
          <ObH2>
            본 대로 누르면
            <br />
            약이 나와요.
          </ObH2>
          <ObLead>
            PC도 팜밴도 필요 없이, <Em>폰에서 보이는 대로 탭</Em>하면 후보가 좁혀져요. 약 이름을 몰라도 괜찮아요.
          </ObLead>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
            {chips.map((c, i) => {
              const sel = i === 0 || i === 2;
              return (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 'var(--r-chip)', fontSize: 14, fontWeight: 600, border: sel ? '1.5px solid var(--primary)' : '1.5px solid var(--border)', background: sel ? 'var(--primary-weak)' : 'var(--card)', color: sel ? 'var(--primary-ink)' : 'var(--text-weak)' }}>
                  {i === 0 ? (
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', border: '1.5px solid var(--border)' }} />
                  ) : i === 1 ? (
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#f4d03f' }} />
                  ) : (
                    <ShapeOutline shape={c[0]} size={16} stroke={sel ? 'var(--primary)' : 'var(--text-weaker)'} />
                  )}
                  {c[0]}
                </span>
              );
            })}
          </div>
        </>
      ),
    },
    // 3 그려서 찾기
    {
      body: (
        <>
          <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: -0.3, padding: '8px 14px', borderRadius: 999, marginBottom: 16, whiteSpace: 'nowrap', boxShadow: '0 6px 16px rgba(47,107,255,.3)' }}>✨ 이 앱만의 기능</div>
          <ObH2>
            각인이 흐릿해도,
            <br />
            그려서 찾기.
          </ObH2>
          <ObLead>
            <Em>폰에 손가락으로 쓱</Em> 그리면, 닮은 마크를 기기 안에서 찾아줘요. 키보드도, 정확한 각인도 필요 없어요.
          </ObLead>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22, justifyContent: 'center' }}>
            <div style={{ width: 124, height: 124, borderRadius: 20, background: '#fff', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>{drawSvg}</div>
            <Icon name="chevron" size={26} style={{ color: 'var(--text-weaker)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 14px', borderRadius: 16, border: '1.5px solid var(--primary)', background: 'var(--primary-weak)' }}>
              <MarkGlyph option={{ code: '+' }} size={40} />
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-ink)' }}>98%</span>
            </div>
          </div>
        </>
      ),
    },
    // 4 복약 리스트
    {
      body: (
        <>
          <ObKicker n="2">환자별 복약 리스트</ObKicker>
          <ObH2>
            찾은 약을
            <br />
            한곳에 정리.
          </ObH2>
          <ObLead>
            용법·투약시점·용량까지 담아 <Em>환자별로</Em> 모아요. 용법순·시점순 정렬도 한 번에.
          </ObLead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
            <ObPillRow color="하양" shape="원형" marking="Bayer" name="아스피린장용정100mg" tags={[{ label: '1T', pri: true }, { label: 'QD', pri: true }, { label: '아침식후' }]} />
            <ObPillRow color="분홍" shape="원형" marking="D5" name="트라젠타정(리나글립틴)" tags={[{ label: '1T', pri: true }, { label: 'QD', pri: true }, { label: '아침식후' }]} />
          </div>
        </>
      ),
    },
    // 5 인계
    {
      body: (
        <>
          <ObKicker n="3">인계는 복사 한 번</ObKicker>
          <ObH2>
            옮겨 적지
            <br />
            마세요.
          </ObH2>
          <ObLead>
            정리한 리스트가 <Em>시간대별 한 줄 텍스트</Em>로. 복사하거나 Teams로 바로 보내요.
          </ObLead>
          <pre style={{ margin: '18px 0 0', padding: 14, borderRadius: 'var(--r-card)', background: 'var(--fill)', color: 'var(--text)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{`[홍*동]
<8am>
아스피린장용정100mg 1T (하양/원형/Bayer)
트라젠타정 1T (분홍/원형/D5)`}</pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, borderRadius: 'var(--r-btn)', background: 'var(--primary)', color: '#fff', fontSize: 14.5, fontWeight: 800 }}>
              <Icon name="copy" size={18} />
              복사
            </div>
            <div style={{ flex: 1.3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 46, borderRadius: 'var(--r-btn)', background: '#5b5fc7', color: '#fff', fontSize: 14.5, fontWeight: 800 }}>
              <Icon name="send" size={18} />
              Teams로 보내기
            </div>
          </div>
        </>
      ),
    },
    // 6 DUR
    {
      body: (
        <>
          <ObKicker n="4">금기·중복 자동 점검</ObKicker>
          <ObH2>
            위험한 조합,
            <br />
            먼저 짚어줘요.
          </ObH2>
          <ObLead>
            리스트를 만들면 <Em>병용금기·중복·연령 주의</Em>를 식약처 기준으로 자동 확인해요.
          </ObLead>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--warn-weak)', borderRadius: 'var(--r-card)', padding: '16px 16px', marginTop: 20 }}>
            <Icon name="warn" size={24} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--warn-ink)', lineHeight: 1.5 }}>
              <b>병용금기</b> · 아스피린 + 와파린
              <br />
              함께 쓰면 출혈 위험이 커요.
            </div>
          </div>
          <ObLead>최종 판단은 의료진 책임이에요. 놓치기 쉬운 조합을 한 번 더 짚어주는 안전장치예요.</ObLead>
        </>
      ),
    },
    // 7 개인정보
    {
      body: (
        <>
          <ObKicker n="5">개인정보는 가리고 공유</ObKicker>
          <ObH2>
            이름은
            <br />
            가려서 보내요.
          </ObH2>
          <ObLead>
            공유할 땐 환자명 가운데를 <Em>자동으로 가려서</Em> 내보내요. 모든 기록은 이 기기에만 저장돼요.
          </ObLead>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--primary-weak)', borderRadius: 'var(--r-card)', padding: '18px 18px', marginTop: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="lock" size={22} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text-weaker)', whiteSpace: 'nowrap' }}>
              <span style={{ textDecoration: 'line-through' }}>홍길동</span>
              <Icon name="chevron" size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ color: 'var(--primary-ink)' }}>홍*동</span>
            </div>
          </div>
          <ObLead>서버 전송 없음 · 기기 저장 · 인터넷 없이(인트라넷)도 동작해요.</ObLead>
        </>
      ),
    },
    // 8 안전하게 쓰기
    {
      body: (
        <>
          <ObKicker n="6">쓰기 전에, 꼭</ObKicker>
          <ObH2>
            안전하게,
            <br />
            이렇게만.
          </ObH2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 22 }}>
            {(
              [
                ['①', '병원 공식 채널로만 공유', '개인 카톡·SNS 말고, 병원 관리 협업툴·폐쇄망에서요.'],
                ['②', '마스킹은 보조수단', '홍*동도 병동·약과 합치면 식별될 수 있어요.'],
                ['③', '진료·인계 목적으로만 사용', ''],
                ['④', '도입 전 개인정보보호 담당자 확인', ''],
              ] as [string, string, string][]
            ).map((r, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-weak)', color: 'var(--primary-ink)', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{r[0]}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4, color: 'var(--text-strong)' }}>{r[1]}</span>
                </div>
                {r[2] && <div style={{ marginLeft: 42, marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--text-weak)', lineHeight: 1.45 }}>{r[2]}</div>}
              </div>
            ))}
          </div>
          <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--text-weaker)', fontWeight: 600, lineHeight: 1.5 }}>※ 일반 안내이며 법적 자문이 아니에요. 최종 기준은 소속 기관 방침을 따라주세요.</p>
        </>
      ),
    },
    // 9 마무리 (분기)
    {
      blue: true,
      body: (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ObKicker n="★" onBlue>{standalone ? '준비 완료' : '지금 바로 시작'}</ObKicker>
          {standalone ? (
            <>
              <ObH2 onBlue>
                이제,
                <br />
                바로 시작해요.
              </ObH2>
              <ObLead onBlue>홈 화면 앱으로 잘 설치됐어요. 환자가 가져온 약을 바로 찾아보세요.</ObLead>
            </>
          ) : (
            <>
              <ObH2 onBlue>
                홈 화면에
                <br />
                추가하면 끝.
              </ObH2>
              <ObLead onBlue>
                앱스토어 설치 없이,
                <br />
                브라우저 ‘홈 화면에 추가’만 하면 앱처럼 써요.
              </ObLead>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 20 }}>
                {(
                  [
                    ['1', '링크 열기', '병동 공유 주소로 접속'],
                    ['2', '홈 화면에 추가', '브라우저 공유 메뉴에서'],
                    ['3', '아이콘 탭', '바로 검색 시작'],
                  ] as [string, string, string][]
                ).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 14, padding: '12px 15px' }}>
                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', color: 'var(--primary-ink)', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s[0]}</span>
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <b style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: -0.4, whiteSpace: 'nowrap' }}>{s[1]}</b>
                      <span style={{ color: 'rgba(255,255,255,.72)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{s[2]}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ObLogo size={50} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: -0.5, whiteSpace: 'nowrap' }}>지참약 식별</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.8)', marginTop: 2, whiteSpace: 'nowrap' }}>ward-pillcheck</div>
            </div>
          </div>
        </div>
      ),
    },
  ];
}

export function Onboarding({ onClose, standalone }: { onClose: () => void; standalone?: boolean }) {
  const [i, setI] = useState(0);
  const slides = obSlides(!!standalone);
  const N = slides.length;
  const last = i === N - 1;
  const sx = useRef<number | null>(null);
  const go = (n: number) => setI(Math.max(0, Math.min(N - 1, n)));
  const slide = slides[i];

  const containerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 260,
    background: slide.blue ? 'linear-gradient(165deg,#3b78ff,#1f53e0)' : 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'background .3s ease',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사용 가이드"
      onTouchStart={(e) => (sx.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (sx.current == null) return;
        const dx = e.changedTouches[0].clientX - sx.current;
        if (Math.abs(dx) > 45) go(i + (dx < 0 ? 1 : -1));
        sx.current = null;
      }}
      style={containerStyle}
    >
      {/* 상단: 카운터 + 건너뛰기 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 6px' }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.04em', color: slide.blue ? 'rgba(255,255,255,.7)' : 'var(--text-weaker)' }}>
          {String(i + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}
        </span>
        {!last && (
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 6, whiteSpace: 'nowrap', color: slide.blue ? 'rgba(255,255,255,.8)' : 'var(--text-weaker)', WebkitTapHighlightColor: 'transparent' }}>
            건너뛰기
          </button>
        )}
      </div>

      {/* 본문 */}
      <div key={i} className="screen-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 8px', display: 'flex', flexDirection: 'column', animation: 'obIn .32s cubic-bezier(.32,.72,0,1)' }}>
        {slide.body}
      </div>

      {/* 하단: 점 + 버튼 */}
      <div style={{ padding: '8px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
          {slides.map((_, idx) => (
            <button key={idx} type="button" onClick={() => go(idx)} aria-label={`${idx + 1}번째 카드`} style={{ width: idx === i ? 22 : 7, height: 7, borderRadius: 99, border: 'none', padding: 0, cursor: 'pointer', transition: 'all .25s', background: idx === i ? (slide.blue ? '#fff' : 'var(--primary)') : slide.blue ? 'rgba(255,255,255,.35)' : 'var(--border)' }} />
          ))}
        </div>
        <button type="button" onClick={() => (last ? onClose() : go(i + 1))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 54, borderRadius: 'var(--r-btn)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 17, fontWeight: 800, letterSpacing: -0.3, WebkitTapHighlightColor: 'transparent', background: slide.blue ? '#fff' : 'var(--primary)', color: slide.blue ? 'var(--primary-ink)' : '#fff' }}>
          {last ? '시작하기' : '다음'}
          {last && <Icon name="check" size={20} />}
        </button>
      </div>
    </div>
  );
}
