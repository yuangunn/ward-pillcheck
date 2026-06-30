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

test('각인 혼동문자 — 50H 로 검색하면 각인 SOH 약이 "비슷한 각인" 배지와 함께 나온다', async ({ page }) => {
  await openSearch(page);

  await page.getByLabel('각인').fill('50H'); // S↔5, O↔0
  await expect(page.getByText('컨퓨즈데모정')).toBeVisible();
  await expect(page.getByText('비슷한 각인')).toBeVisible();

  // 정확(SOH) 검색은 배지 없이 동일 약
  await page.getByLabel('각인').fill('SOH');
  await expect(page.getByText('컨퓨즈데모정')).toBeVisible();
  await expect(page.getByText('비슷한 각인')).toHaveCount(0);
});

test('마크 글자 — G 로 검색하면 «ㄷㄱ,G» 마크 약이 나온다', async ({ page }) => {
  await openSearch(page);
  await page.getByLabel('마크 글자').fill('G'); // 식약처가 ㄷㄱ,G 로 적어둔 마크를 G 로 찾기
  await expect(page.getByText('동광오플록사신정')).toBeVisible();
});

test('마크 모양 단어 — 삼각형으로 복잡 로고 마크(바스티난)를 찾는다', async ({ page }) => {
  await openSearch(page);
  // 그려선 안 잡히는 복잡 로고도, 식약처 분류 단어 '삼각형'으로 찾힘
  await page.getByLabel('마크 글자').fill('삼각형');
  await expect(page.getByText('바스티난엠알서방정')).toBeVisible();
});
