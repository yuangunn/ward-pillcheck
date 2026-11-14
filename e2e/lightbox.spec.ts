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

test('화면 전체 핀줌 차단: 스크롤 영역 touch-action + iOS gesture 이벤트 막힘', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.screen-scroll').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const ev = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(ev);
    return {
      prevented: ev.defaultPrevented,
      scroller: getComputedStyle(document.querySelector('.screen-scroll')!).touchAction,
      body: getComputedStyle(document.body).touchAction,
    };
  });
  expect(r.prevented).toBe(true); // iOS 사파리 핀줌(뷰포트 user-scalable=no 무시) 차단
  expect(r.scroller).toBe('pan-x pan-y'); // 스크롤은 되고 핀치·두 번 탭 확대는 안 됨
  expect(r.body).toBe('pan-x pan-y');
});
