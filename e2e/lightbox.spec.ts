import { test, expect } from '@playwright/test';

// 회귀 방지: 약 사진/글리프 탭 → 라이트박스가 크래시 없이 열리고, 탭하면 닫힌다.
// (Lightbox 가 조기 return 아래에서 훅을 호출해 "Rendered more hooks" 로 앱 전체가
//  까만 화면·먹통이 되던 버그 재발 방지.)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ward-pillcheck:onboarded', '1');
    localStorage.setItem('ward-pillcheck:disclaimer-v1', '1');
  });
});

test('약 이미지 확대(라이트박스): 훅 에러 없이 열리고 탭하면 닫힘', async ({ page }) => {
  const hookErrors: string[] = [];
  page.on('pageerror', (e) => {
    if (/hook/i.test(e.message)) hookErrors.push(e.message);
  });

  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await expect(page.getByText('아스피린장용정100mg')).toBeVisible();

  await page.getByRole('button', { name: '이미지 확대' }).first().click();
  const lb = page.getByRole('dialog', { name: '이미지 확대' });
  await expect(lb).toBeVisible();

  // 아무 곳이나 탭하면 닫힘(먹통 아님)
  await lb.click({ position: { x: 10, y: 10 } });
  await expect(lb).toBeHidden();

  expect(hookErrors, hookErrors.join('\n')).toEqual([]);
});
