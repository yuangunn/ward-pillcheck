import { test, expect, type Page } from '@playwright/test';

// 실물검색 개선 e2e (목 모드): ① 모양 다중선택 ② 각인 180° 뒤집힘 매칭.
// 온보딩·면책 게이트는 꺼서 첫 실행 오버레이가 클릭을 가리지 않게 한다.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ward-pillcheck:onboarded', '1');
    localStorage.setItem('ward-pillcheck:disclaimer-v1', '1');
  });
});

async function openSearch(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
}

test('모양 다중선택 — 타원형 + 장방형을 동시에 선택하면 둘 다 결과에 나온다', async ({ page }) => {
  await openSearch(page);

  // 모양 칩은 텍스트 라벨을 가진 button (exact 로 결과카드 버튼과 구분)
  const oval = page.getByRole('button', { name: '타원형', exact: true });
  const oblong = page.getByRole('button', { name: '장방형', exact: true });

  await oval.click();
  await expect(oval).toHaveAttribute('aria-pressed', 'true');
  // 타원형만 켰을 때: 장방형 약(타이레놀)은 아직 안 보임
  await expect(page.getByText('자나팜정0.25mg')).toBeVisible();
  await expect(page.getByText('타이레놀정500mg')).toHaveCount(0);

  await oblong.click();
  await expect(oblong).toHaveAttribute('aria-pressed', 'true');
  // 둘 다 켜면 타원형(자나팜) + 장방형(타이레놀)이 함께 나온다(하나라도 일치)
  await expect(page.getByText('자나팜정0.25mg')).toBeVisible();
  await expect(page.getByText('타이레놀정500mg')).toBeVisible();
});

test('각인 180° 뒤집힘 — HIS 로 검색하면 각인 SIH 약이 "거꾸로 보면 일치" 배지와 함께 나온다', async ({ page }) => {
  await openSearch(page);

  await page.getByLabel('각인').fill('HIS');
  await expect(page.getByText('미소론정')).toBeVisible();
  await expect(page.getByText('거꾸로 보면 일치')).toBeVisible();

  // 그대로(SIH) 검색은 배지 없이 동일 약이 나온다
  await page.getByLabel('각인').fill('SIH');
  await expect(page.getByText('미소론정')).toBeVisible();
  await expect(page.getByText('거꾸로 보면 일치')).toHaveCount(0);
});
