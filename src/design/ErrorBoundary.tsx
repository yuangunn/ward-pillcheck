import { Component, type ReactNode } from 'react';

// 렌더 중 예외가 앱 전체를 까만 화면·먹통으로 만들지 않도록 잡는 최후 방어선.
// (예: 훅 규칙 위반 등으로 React 트리가 throw 해도 복구 가능한 화면을 보여준다.)
interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // 콘솔에 남겨 디버깅에 활용(개인정보 없음).
    console.error('[ErrorBoundary]', error);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 28,
          textAlign: 'center',
          background: 'var(--bg, #fff)',
          color: 'var(--text, #1a1a1a)',
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>화면을 그리다 문제가 생겼어요</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-weak, #666)', maxWidth: 320, lineHeight: 1.5 }}>
          저장된 환자·약 데이터는 그대로 있어요. 아래 버튼으로 다시 시작하면 됩니다.
        </div>
        <button
          type="button"
          onClick={() => {
            this.setState({ error: null });
            window.location.reload();
          }}
          style={{
            marginTop: 4,
            height: 48,
            padding: '0 24px',
            borderRadius: 12,
            border: 'none',
            background: 'var(--primary, #2563eb)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: -0.3,
            cursor: 'pointer',
          }}
        >
          새로고침
        </button>
      </div>
    );
  }
}
