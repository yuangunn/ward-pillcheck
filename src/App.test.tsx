import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { StoreProvider } from './state/store';

function renderApp() {
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

const medList = () => document.querySelector('.med-list') as HTMLElement | null;

describe('App 리디자인 통합 (목 모드)', () => {
  // 기본은 온보딩·면책 게이트를 끈 상태로(테스트 방해 방지). 전용 케이스에서 검증.
  beforeEach(() => {
    localStorage.setItem('ward-pillcheck:onboarded', '1');
    localStorage.setItem('ward-pillcheck:disclaimer-v1', '1');
  });

  it('홈: 제목 + 기본 환자(환자1) 카드 표시', () => {
    renderApp();
    expect(screen.getByRole('tab', { name: '지참약 식별' })).toBeInTheDocument();
    expect(screen.getByText('환자1')).toBeInTheDocument();
  });

  it('첫 실행: 면책 게이트 노출 → 이해했습니다(목 모드는 즉시 활성) → 진입', async () => {
    localStorage.removeItem('ward-pillcheck:disclaimer-v1');
    const user = userEvent.setup();
    renderApp();
    const gate = await screen.findByRole('dialog', { name: '사용 전 확인' });
    expect(gate).toBeInTheDocument();
    // 목 모드는 받을 데이터가 없어 즉시 활성화
    const ackBtn = within(gate).getByRole('button', { name: '이해했습니다' });
    expect(ackBtn).toBeEnabled();
    await user.click(ackBtn);
    expect(screen.queryByRole('dialog', { name: '사용 전 확인' })).not.toBeInTheDocument();
    expect(screen.getByText('환자1')).toBeInTheDocument();
  });

  it('첫 실행: 온보딩 가이드 노출 → 건너뛰기', async () => {
    localStorage.removeItem('ward-pillcheck:onboarded');
    const user = userEvent.setup();
    renderApp();
    const guide = await screen.findByRole('dialog', { name: '사용 가이드' });
    expect(guide).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(screen.queryByRole('dialog', { name: '사용 가이드' })).not.toBeInTheDocument();
  });

  it('의약품 검색 탭: 경구약 이름검색 → 약 누르면 상세 보기', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('tab', { name: '의약품 검색' }));
    // 경구약 기본 → 이름검색
    await user.type(screen.getByLabelText('의약품 이름 검색'), '타이레놀');
    const hit = await screen.findByText('타이레놀정500mg');
    await user.click(hit);
    // 읽기전용 상세 시트(제목 '약 상세 정보') — 안에 약명 표시
    const sheet = await screen.findByRole('dialog', { name: '약 상세 정보' });
    expect(within(sheet).getByText('타이레놀정500mg')).toBeInTheDocument();
  });

  it('환자 열기 → 빈 상태 → 검색 → 추가 → 리스트 표시', async () => {
    const user = userEvent.setup();
    renderApp();

    // 환자1 카드 열기
    await user.click(screen.getByText('환자1'));
    expect(await screen.findByText(/아직 추가된 약이 없어요/)).toBeInTheDocument();

    // 검색 화면으로
    await user.click(screen.getByRole('button', { name: '약 검색해서 추가' }));
    // 실물 검색 탭이 기본 선택
    expect(screen.getByRole('tab', { name: '실물 검색' })).toHaveAttribute('aria-selected', 'true');

    // 각인으로 검색
    await user.type(screen.getByLabelText('각인'), 'Bayer');
    const name = await screen.findByText('아스피린장용정100mg');
    await user.click(name);

    // 추가 시트 → 환자 리스트에 추가
    const sheet = await screen.findByRole('dialog', { name: '리스트에 추가' });
    await user.click(within(sheet).getByRole('button', { name: '환자 리스트에 추가' }));

    // 환자 화면으로 돌아와 약 행 표시
    await waitFor(() => {
      const line = medList()?.querySelector('.med-name') as HTMLElement;
      expect(line?.textContent).toContain('아스피린장용정100mg');
    });
  });

  it('이름 검색 탭으로 전환된다', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('환자1'));
    await user.click(screen.getByRole('button', { name: '약 검색해서 추가' }));
    await user.click(screen.getByRole('tab', { name: '이름 검색' }));
    expect(screen.getByLabelText('품목명')).toBeInTheDocument();
  });

  it('외용·주사제 탭: 이름검색 → 추가(이름 자동 채움)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('환자1'));
    await user.click(screen.getByRole('button', { name: '약 검색해서 추가' }));
    await user.click(screen.getByRole('tab', { name: '외용·주사제' }));
    await user.type(screen.getByLabelText('외용·주사제 이름'), '란투스');

    const result = await screen.findByText('란투스주솔로스타펜');
    await user.click(result);

    const sheet = await screen.findByRole('dialog', { name: '직접 입력' });
    expect(within(sheet).getByLabelText('약 이름')).toHaveValue('란투스주솔로스타펜');
    await user.click(within(sheet).getByRole('button', { name: '환자 리스트에 추가' }));

    await waitFor(() => {
      const line = medList()?.querySelector('.med-name') as HTMLElement;
      expect(line?.textContent).toContain('란투스주솔로스타펜');
    });
  });

  it('외용·주사제 탭: 외용약(흡입제) 검색', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('환자1'));
    await user.click(screen.getByRole('button', { name: '약 검색해서 추가' }));
    await user.click(screen.getByRole('tab', { name: '외용·주사제' }));
    await user.type(screen.getByLabelText('외용·주사제 이름'), '벤토린');
    expect(await screen.findByText('벤토린에보할러')).toBeInTheDocument();
  });

  it('직접 입력으로 주사약(인슐린) 추가', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('환자1'));
    await user.click(screen.getByRole('button', { name: '약 검색해서 추가' }));
    await user.click(screen.getByRole('button', { name: /직접 입력/ }));

    const sheet = await screen.findByRole('dialog', { name: '직접 입력' });
    await user.type(within(sheet).getByLabelText('약 이름'), '란투스주');
    await user.selectOptions(within(sheet).getByLabelText('용량 단위'), 'U');
    await user.click(within(sheet).getByRole('button', { name: '환자 리스트에 추가' }));

    await waitFor(() => {
      const line = medList()?.querySelector('.med-name') as HTMLElement;
      expect(line?.textContent).toContain('란투스주');
    });
  });

  it('새 환자 추가 후 해당 환자 화면으로 이동', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: '새 환자 추가' }));
    // 환자2 상세 화면(헤더 제목은 이름수정 버튼)
    const titleBtn = await screen.findByRole('button', { name: '이름 수정' });
    expect(titleBtn).toHaveTextContent('환자2');
  });
});
