import { test, expect, type Page } from '@playwright/test';

// A4 출력용 PDF: 만들기 → 폰 공유 창(Web Share) / 공유 불가 브라우저는 파일 저장.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ward-pillcheck:onboarded', '1');
    localStorage.setItem('ward-pillcheck:disclaimer-v1', '1');
  });
});

async function addBayerAndOpenShare(page: Page) {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();
  await page.getByRole('button', { name: '공유하기' }).click();
  return page.getByRole('dialog', { name: '인계용 텍스트' });
}

test('A4 PDF: 만들기 → 공유 창에 PDF 파일 1개(파일명에 환자 라벨 없음)', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown };
    w.__shared = null;
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (d: ShareData) => !!d?.files?.length,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: ShareData) => {
        const f = d.files![0];
        const buf = new Uint8Array(await f.arrayBuffer());
        const s = Array.from(buf, (c) => String.fromCharCode(c)).join('');
        w.__shared = {
          count: d.files!.length,
          name: f.name,
          type: f.type,
          head: s.slice(0, 8),
          pages: (s.match(/\/Type \/Page /g) || []).length,
          size: f.size,
        };
      },
    });
  });
  const sheet = await addBayerAndOpenShare(page);
  await sheet.getByRole('button', { name: 'A4 출력용 PDF 만들기' }).click();
  const send = sheet.getByRole('button', { name: /PDF 보내기 \(1쪽\)/ });
  await expect(send).toBeVisible({ timeout: 20_000 });
  await send.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)).not.toBeNull();
  const shared = (await page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)) as {
    count: number;
    name: string;
    type: string;
    head: string;
    pages: number;
    size: number;
  };
  expect(shared.count).toBe(1);
  expect(shared.type).toBe('application/pdf');
  expect(shared.head).toBe('%PDF-1.4');
  expect(shared.pages).toBe(1);
  expect(shared.name).toMatch(/^지참약확인표_\d{8}_\d{4}\.pdf$/);
  expect(shared.name).not.toContain('환자');
  expect(shared.size).toBeGreaterThan(20_000); // 실제로 그려진 A4 JPEG
});

test('A4 PDF: 공유를 못 하는 브라우저는 파일로 저장하고 안내', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    // 브라우저에 넘긴 파일명 기록(크로미움의 suggestedFilename 은 OS 로캘이 UTF-8 이 아니면 'download' 로 바뀜)
    const w = window as unknown as { __dlName: string };
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download) w.__dlName = this.download;
      return orig.call(this);
    };
  });
  const sheet = await addBayerAndOpenShare(page);
  await sheet.getByRole('button', { name: 'A4 출력용 PDF 만들기' }).click();
  const send = sheet.getByRole('button', { name: /PDF 보내기/ });
  await expect(send).toBeVisible({ timeout: 20_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), send.click()]);
  const name = await page.evaluate(() => (window as unknown as { __dlName: string }).__dlName);
  expect(name).toMatch(/^지참약확인표_\d{8}_\d{4}\.pdf$/);
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
  await expect(sheet.getByRole('status')).toContainText('파일로 저장했어요');
});
