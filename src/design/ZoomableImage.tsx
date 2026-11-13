import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ZOOM_RESET, pan, pinch, toggleDoubleTap, type Pt, type ZoomState } from './zoom';

// 라이트박스 실물 사진: 두 손가락 핀치 확대, 확대 중 한 손가락 끌기, 두 번 탭 확대/원래대로.
// 화면 전체 핀줌은 막혀 있어(state/noPageZoom) 각인을 크게 보려면 여기서 확대한다.
// 사진 위 탭은 라이트박스를 닫지 않는다(바깥 탭·닫기 버튼으로 닫음).

const TAP_MOVE = 10; // px — 이보다 덜 움직이면 탭
const TAP_TIME = 300; // ms — 탭 길이, 두 번 탭 간격
const TAP_NEAR = 40; // px — 두 번 탭 위치 허용 오차

export function ZoomableImage({
  src,
  alt,
  onError,
  style,
}: {
  src: string;
  alt: string;
  onError?: () => void;
  style?: CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState<ZoomState>(ZOOM_RESET);
  const zRef = useRef(z);
  zRef.current = z;
  const pts = useRef(new Map<number, Pt>());
  const gesture = useRef<{ start: ZoomState; p0: Map<number, Pt> } | null>(null);
  const down = useRef<{ t: number; p: Pt; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; p: Pt } | null>(null);

  useEffect(() => setZ(ZOOM_RESET), [src]);

  /** 컨테이너 중심 기준 좌표 + 크기 */
  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current?.getBoundingClientRect();
    const w = r?.width ?? 0;
    const h = r?.height ?? 0;
    return { p: { x: e.clientX - (r?.left ?? 0) - w / 2, y: e.clientY - (r?.top ?? 0) - h / 2 }, w, h };
  };

  // 손가락 수가 바뀔 때마다 기준점을 다시 잡는다(핀치 ↔ 끌기 전환이 튀지 않게).
  const restart = () => {
    gesture.current = { start: zRef.current, p0: new Map(pts.current) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 일부 환경 미지원 */
    }
    const { p } = local(e);
    pts.current.set(e.pointerId, p);
    if (pts.current.size === 1) down.current = { t: performance.now(), p, moved: false };
    else if (down.current) down.current.moved = true; // 두 손가락이면 탭 아님
    restart();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId) || !gesture.current) return;
    const { p, w, h } = local(e);
    pts.current.set(e.pointerId, p);
    if (down.current && Math.hypot(p.x - down.current.p.x, p.y - down.current.p.y) > TAP_MOVE) down.current.moved = true;
    const g = gesture.current;
    const ids = [...pts.current.keys()];
    if (ids.length >= 2) {
      const [a, b] = ids;
      const a0 = g.p0.get(a);
      const b0 = g.p0.get(b);
      if (a0 && b0) setZ(pinch(g.start, a0, b0, pts.current.get(a)!, pts.current.get(b)!, w, h));
    } else if (g.start.s > 1) {
      const p0 = g.p0.get(e.pointerId);
      if (p0) setZ(pan(g.start, p0, p, w, h));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    const { p, w, h } = local(e);
    pts.current.delete(e.pointerId);
    if (pts.current.size > 0) {
      restart();
      return;
    }
    gesture.current = null;
    const d = down.current;
    down.current = null;
    const now = performance.now();
    if (!d || d.moved || now - d.t > TAP_TIME) return;
    const last = lastTap.current;
    if (last && now - last.t < TAP_TIME && Math.hypot(p.x - last.p.x, p.y - last.p.y) < TAP_NEAR) {
      lastTap.current = null;
      setZ((cur) => toggleDoubleTap(cur, p.x, p.y, w, h));
    } else {
      lastTap.current = { t: now, p };
    }
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    pts.current.delete(e.pointerId);
    down.current = null;
    if (pts.current.size) restart();
    else gesture.current = null;
  };

  const zoomed = z.s > 1.01;
  return (
    <div
      ref={box}
      data-testid="zoomable-photo"
      data-scale={z.s.toFixed(2)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(e) => e.stopPropagation()} // 사진 탭으로 라이트박스가 닫히지 않게
      style={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none', // 핀치·끌기를 브라우저가 아니라 여기서 처리
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: zoomed ? 'grab' : 'zoom-in',
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        draggable={false}
        onError={onError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`,
          transformOrigin: 'center center',
          transition: gesture.current ? 'none' : 'transform .18s ease-out',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
