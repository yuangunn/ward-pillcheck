import { describe, it, expect } from 'vitest';
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

/** 실물 검색으로 Bayer 약을 찾아 환자 리스트에 추가하는 공통 흐름 */
async function searchAndAddBayer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/각인/), 'Bayer');
  await user.click(screen.getByRole('button', { name: '검색' }));
  // 결과 카드 등장 대기
  await screen.findByText('아스피린장용정100mg');
  await user.click(screen.getByRole('button', { name: '환자 리스트에 추가' }));
  // 추가 시트의 제출 버튼
  const sheet = await screen.findByRole('dialog', { name: '환자 리스트에 추가' });
  await user.click(within(sheet).getByRole('button', { name: '추가' }));
}

function medList(): HTMLElement {
  // ul.med-list
  return document.querySelector('ul.med-list') as HTMLElement;
}

describe('App 통합', () => {
  it('첫 진입 시 기본 환자(환자1)가 존재한다', () => {
    renderApp();
    expect(screen.getByRole('button', { name: '환자1' })).toBeInTheDocument();
  });

  it('실물 검색 → 결과 카드 → 환자 리스트 추가 → 한 줄 포맷 표시', async () => {
    const user = userEvent.setup();
    renderApp();
    await searchAndAddBayer(user);

    await waitFor(() => expect(medList()).toBeInTheDocument());
    const line = medList().querySelector('.med-name') as HTMLElement;
    expect(line.textContent).toContain('아스피린장용정100mg');
    expect(line.textContent).toContain('1T');
    expect(line.textContent).toContain('QD');
    expect(line.textContent).toContain('아침식후');
  });

  it('결과 카드 탭 시 e약은요 상세를 펼쳐 로드한다', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText(/각인/), 'Bayer');
    await user.click(screen.getByRole('button', { name: '검색' }));
    const name = await screen.findByText('아스피린장용정100mg');
    await user.click(name); // 카드 본문 탭 → 상세 펼침
    expect(await screen.findByText('효능')).toBeInTheDocument();
    expect(await screen.findByText(/혈전 생성 억제/)).toBeInTheDocument();
  });

  it('저장 항목 편집: 정제수/용법 수정이 반영된다', async () => {
    const user = userEvent.setup();
    renderApp();
    await searchAndAddBayer(user);
    await waitFor(() => expect(medList()).toBeInTheDocument());

    // 약물 한 줄 탭 → 편집 시트
    await user.click(medList().querySelector('.med-line') as HTMLElement);
    const editSheet = await screen.findByRole('dialog', { name: '항목 편집' });

    // 용법을 BID 칩으로 변경
    await user.click(within(editSheet).getByRole('button', { name: /BID/ }));
    // 정제수 0.5 증가(스테퍼 +)
    await user.click(within(editSheet).getByRole('button', { name: '0.5정 증가' }));
    await user.click(within(editSheet).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      const line = medList().querySelector('.med-name') as HTMLElement;
      expect(line.textContent).toContain('1.5T');
      expect(line.textContent).toContain('BID');
    });
  });

  it('저장 항목 삭제', async () => {
    const user = userEvent.setup();
    renderApp();
    await searchAndAddBayer(user);
    await waitFor(() => expect(medList()).toBeInTheDocument());

    await user.click(medList().querySelector('.med-line') as HTMLElement);
    const editSheet = await screen.findByRole('dialog', { name: '항목 편집' });
    await user.click(within(editSheet).getByRole('button', { name: '삭제' }));

    await screen.findByText(/아직 추가된 약이 없습니다/);
  });

  it('자동정렬: 용법순 버튼이 활성(aria-pressed) 상태가 된다', async () => {
    const user = userEvent.setup();
    renderApp();
    await searchAndAddBayer(user);

    const sortBtn = screen.getByRole('button', { name: '용법순' });
    expect(sortBtn).toHaveAttribute('aria-pressed', 'false');
    await user.click(sortBtn);
    expect(sortBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('환자 추가 버튼으로 환자2 생성 및 전환', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: '환자 추가' }));
    expect(screen.getByRole('button', { name: '환자2' })).toBeInTheDocument();
    // 새 환자가 active → 약 없음 안내
    expect(screen.getByText(/아직 추가된 약이 없습니다/)).toBeInTheDocument();
  });

  it('데모(목) 모드 배너가 표시된다', () => {
    renderApp();
    expect(screen.getByText(/데모\(목\) 모드/)).toBeInTheDocument();
  });
});
