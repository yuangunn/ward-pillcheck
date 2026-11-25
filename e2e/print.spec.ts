import { test, expect, type Page } from '@playwright/test';

// A4 출력용 식별표: 만들기 → PDF(출력용) 또는 쪽 이미지(미리보기용)를 폰 공유 창(Web Share)으로 / 공유 불가 브라우저는 파일 저장.

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

test('A4 이미지: 만들기 → 공유 창에 A4 JPEG 1장(파일명에 환자 라벨 없음)', async ({ page }) => {
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
        const head = Array.from(new Uint8Array(await f.slice(0, 3).arrayBuffer()));
        const bmp = await createImageBitmap(f);
        w.__shared = { count: d.files!.length, name: f.name, type: f.type, head, w: bmp.width, h: bmp.height, size: f.size };
      },
    });
  });
  const sheet = await addBayerAndOpenShare(page);
  await sheet.getByRole('button', { name: 'A4 출력용 식별표 만들기' }).click();
  const send = sheet.getByRole('button', { name: /식별표 이미지 보내기.*\(1장\)/ });
  await expect(send).toBeVisible({ timeout: 20_000 });
  await send.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)).not.toBeNull();
  const shared = (await page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)) as {
    count: number;
    name: string;
    type: string;
    head: number[];
    w: number;
    h: number;
    size: number;
  };
  expect(shared.count).toBe(1);
  expect(shared.type).toBe('image/jpeg');
  expect(shared.head).toEqual([0xff, 0xd8, 0xff]); // JPEG SOI
  expect([shared.w, shared.h]).toEqual([724, 1024]); // Teams 가 더 줄이지 않는 크기(긴 변 1024px)
  expect(shared.name).toMatch(/^지참약식별표_\d{8}_\d{4}\.jpg$/);
  expect(shared.name).not.toContain('환자');
  expect(shared.size).toBeGreaterThan(20_000); // 실제로 그려진 A4 JPEG
});

test('A4 이미지: 공유를 못 하는 브라우저는 파일로 저장하고 안내', async ({ page }) => {
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
  await sheet.getByRole('button', { name: 'A4 출력용 식별표 만들기' }).click();
  const send = sheet.getByRole('button', { name: /식별표 이미지 보내기/ });
  await expect(send).toBeVisible({ timeout: 20_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), send.click()]);
  const name = await page.evaluate(() => (window as unknown as { __dlName: string }).__dlName);
  expect(name).toMatch(/^지참약식별표_\d{8}_\d{4}\.jpg$/);
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile((await download.path())!);
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  await expect(sheet.getByRole('status')).toContainText('파일로 저장했어요');
});

test('A4 PDF: 출력용 — 공유 창에 PDF 파일 1개(같은 쪽 JPEG 을 A4 로 묶음, 파일명에 환자 라벨 없음)', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown };
    w.__shared = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: ShareData) => !!d?.files?.length });
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
          img: /\/Width 2940 \/Height 4158/.test(s),
        };
      },
    });
  });
  const sheet = await addBayerAndOpenShare(page);
  await sheet.getByRole('button', { name: 'A4 출력용 식별표 만들기' }).click();
  const send = sheet.getByRole('button', { name: /PDF로 보내기.*\(1쪽\)/ });
  await expect(send).toBeVisible({ timeout: 20_000 });
  await send.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)).not.toBeNull();
  const shared = (await page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)) as {
    count: number;
    name: string;
    type: string;
    head: string;
    pages: number;
    img: boolean;
  };
  expect(shared.count).toBe(1);
  expect(shared.type).toBe('application/pdf');
  expect(shared.head).toBe('%PDF-1.4');
  expect(shared.pages).toBe(1);
  expect(shared.img).toBe(true); // 쪽 이미지를 원본 해상도 그대로 담음
  expect(shared.name).toMatch(/^지참약식별표_\d{8}_\d{4}\.pdf$/);
});
