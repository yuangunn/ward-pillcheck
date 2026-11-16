import { test, expect, type Locator, type Page } from '@playwright/test';

// 키보드가 시트·팝업 입력칸을 가리던 문제 회귀 방지.
// 헤드리스 브라우저엔 가상 키보드가 없어 visualViewport 를 대역으로 바꿔 "336px 키보드가 덮음"을 흉내 낸다
// (iOS 사파리·안드로이드 크롬이 실제로 알려주는 값과 같은 형태).
const KB = 336;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ward-pillcheck:onboarded', '1');
    localStorage.setItem('ward-pillcheck:disclaimer-v1', '1');
    const vv = Object.assign(new EventTarget(), {
      height: window.innerHeight,
      width: window.innerWidth,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    (window as unknown as { __kb: (px: number) => void }).__kb = (px: number) => {
      vv.height = window.innerHeight - px;
      vv.dispatchEvent(new Event('resize'));
    };
  });
});

const keyboard = (page: Page, px: number) => page.evaluate((n) => (window as unknown as { __kb: (px: number) => void }).__kb(n), px);
const bottomOf = async (l: Locator) => {
  const b = await l.boundingBox();
  return b ? b.y + b.height : Number.POSITIVE_INFINITY;
};

test('환자 추가: 키보드가 올라오면 입력칸·추가 버튼이 키보드 위에 보이고, 닫히면 원래대로', async ({ page }) => {
  await page.goto('/');
  const fullH = await page.evaluate(() => window.innerHeight);
  const kbTop = fullH - KB;
  await page.getByRole('button', { name: '새 환자 추가' }).click();
  const sheet = page.getByRole('dialog', { name: '새 환자' });
  const input = sheet.getByLabel('병상번호');
  await expect(input).toBeFocused(); // 시트가 올라온 뒤 자동 포커스 → 실제 기기에선 이때 키보드가 뜸

  await keyboard(page, KB);
  await expect.poll(() => bottomOf(input)).toBeLessThanOrEqual(kbTop);
  await expect.poll(() => bottomOf(sheet.getByRole('button', { name: '추가', exact: true }))).toBeLessThanOrEqual(kbTop);
  expect(await page.evaluate(() => document.getElementById('root')!.getBoundingClientRect().height)).toBe(kbTop);

  // 입력하고 추가까지 정상
  await input.fill('12-3');
  await keyboard(page, 0);
  await expect.poll(() => page.evaluate(() => document.getElementById('root')!.getBoundingClientRect().height)).toBe(fullH);
  await sheet.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByText('12-3')).toBeVisible();
});

test('가운데 팝업(Teams 대상 입력)도 키보드 위로', async ({ page }) => {
  await page.goto('/');
  const kbTop = (await page.evaluate(() => window.innerHeight)) - KB;
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();
  await page.getByRole('button', { name: '공유하기' }).click();
  await page.getByRole('button', { name: 'Teams로 보내기' }).click();
  const prompt = page.getByRole('dialog', { name: 'Teams 대상 입력' });
  await expect(prompt.getByLabel('Teams 대상 이메일')).toBeFocused();

  await keyboard(page, KB);
  await expect.poll(() => bottomOf(prompt.getByRole('button', { name: '저장하고 보내기' }))).toBeLessThanOrEqual(kbTop);
  await expect.poll(() => bottomOf(prompt.getByLabel('Teams 대상 이메일'))).toBeLessThanOrEqual(kbTop);
});

test('입력 중이 아니면 보이는 영역이 줄어도 화면을 줄이지 않는다(도구막대 등)', async ({ page }) => {
  await page.goto('/');
  const fullH = await page.evaluate(() => window.innerHeight);
  await keyboard(page, KB);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => document.getElementById('root')!.getBoundingClientRect().height)).toBe(fullH);
});
