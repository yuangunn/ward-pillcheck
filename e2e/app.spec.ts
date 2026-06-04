import { test, expect } from '@playwright/test';

// 데모(목) 모드로 동작 — 인증키 없이 실제 브라우저에서 리디자인 핵심 흐름 검증.

test('홈: 제목 + 기본 환자 카드', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '지참약 식별' })).toBeVisible();
  await expect(page.getByText('환자1')).toBeVisible();
});

test('환자 열기 → 검색 → 추가 → 리스트에 표시', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();

  // 빈 상태 → 검색 진입
  await expect(page.getByText(/아직 추가된 약이 없어요/)).toBeVisible();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();

  // 실물 검색 기본 탭
  await expect(page.getByRole('tab', { name: '실물 검색' })).toHaveAttribute('aria-selected', 'true');

  // 각인 검색 → 결과 → 추가
  await page.getByLabel('각인').fill('Bayer');
  await expect(page.getByText('아스피린장용정100mg')).toBeVisible();
  await page.getByText('아스피린장용정100mg').click();

  const sheet = page.getByRole('dialog', { name: '리스트에 추가' });
  await sheet.getByRole('button', { name: '환자 리스트에 추가' }).click();

  // 환자 화면으로 돌아와 약 행 표시
  await expect(page.locator('ul.med-list .med-name')).toContainText('아스피린장용정100mg');
});

test('이름 검색 탭 전환', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByRole('tab', { name: '이름 검색' }).click();
  await page.getByLabel('품목명').fill('타이레놀');
  await expect(page.getByText('타이레놀정500mg')).toBeVisible();
});

test('새 환자 추가 → 환자2 화면', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 환자 추가' }).click();
  // 환자명은 이름수정 버튼으로 표시
  await expect(page.getByRole('button', { name: '이름 수정' })).toContainText('환자2');
});

test('외용·주사제 탭: 이름검색 → 추가', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByRole('tab', { name: '외용·주사제' }).click();
  await page.getByLabel('외용·주사제 이름').fill('란투스');
  await page.getByText('란투스주솔로스타펜').click();
  const sheet = page.getByRole('dialog', { name: '직접 입력' });
  await expect(sheet.getByLabel('약 이름')).toHaveValue('란투스주솔로스타펜');
  await sheet.getByRole('button', { name: '환자 리스트에 추가' }).click();
  await expect(page.locator('ul.med-list .med-name')).toContainText('란투스주솔로스타펜');
});

test('직접 입력으로 주사약 추가', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByRole('button', { name: /직접 입력/ }).click();
  const sheet = page.getByRole('dialog', { name: '직접 입력' });
  await sheet.getByLabel('약 이름').fill('란투스주');
  await sheet.getByRole('button', { name: '단위 U' }).click();
  await sheet.getByRole('button', { name: '환자 리스트에 추가' }).click();
  await expect(page.locator('ul.med-list .med-name')).toContainText('란투스주');
});

test('그려서 마크 찾기 시트 열림', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  // 실물 검색 탭에서 마크 "그려서 찾기"
  await page.getByRole('button', { name: '그려서 찾기' }).click();
  const sheet = page.getByRole('dialog', { name: '그려서 마크 찾기' });
  await expect(sheet.getByLabel('마크 그리기 캔버스')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '지우기' })).toBeVisible();
});

test('의약품 검색 탭: 경구약 검색 → 상세 보기', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '의약품 검색' }).click();
  await page.getByLabel('의약품 이름 검색').fill('타이레놀');
  await page.getByText('타이레놀정500mg').click();
  const sheet = page.getByRole('dialog', { name: '약 상세 정보' });
  await expect(sheet.getByText('타이레놀정500mg')).toBeVisible();
});

test('환자 약 그림 탭 → 상세 보기', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();
  // 리스트의 약 그림 탭 → 상세 시트
  await page.locator('ul.med-list button[aria-label="약 상세 정보"]').first().click();
  await expect(page.getByRole('dialog', { name: '약 상세 정보' })).toBeVisible();
});

test('다크 모드 토글', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: '테마 전환' }).click();
  await expect
    .poll(async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .not.toBe(before);
});
