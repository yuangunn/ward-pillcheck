import { test, expect } from '@playwright/test';

// 성분 중복(중복투약) 점검 e2e (목 모드).
// 노바스크(암로디핀) + 아모잘탄(암로디핀+로사르탄)을 한 환자에 담으면
// "금기·중복 점검"에서 암로디핀 성분중복이 잡혀야 한다.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ward-pillcheck:onboarded', '1');
    localStorage.setItem('ward-pillcheck:disclaimer-v1', '1');
  });
});

test('성분 중복: 노바스크 + 아모잘탄 → 암로디핀 중복 경고', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();

  // 1) 노바스크(암로디핀) 추가 — 빈 환자 화면의 진입 버튼
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('NOVASC');
  await page.getByText('노바스크정5mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();

  // 2) 아모잘탄(암로디핀+로사르탄) 추가 — 약이 있으면 '약 추가'
  await page.getByRole('button', { name: '약 추가' }).click();
  await page.getByLabel('각인').fill('AML');
  await page.getByText('아모잘탄정5/50mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();

  // 3) 금기·중복 점검 → 성분중복(암로디핀)
  await page.getByRole('button', { name: '금기 점검' }).click();
  const sheet = page.getByRole('dialog', { name: '금기·중복 점검' });
  await expect(sheet.getByText('성분중복')).toBeVisible();
  await expect(sheet.getByText(/Amlodipine/)).toBeVisible();
  await expect(sheet.getByText('노바스크정5mg + 아모잘탄정5/50mg')).toBeVisible();
});
