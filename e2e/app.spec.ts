import { test, expect, type Page } from '@playwright/test';

// 데모(목) 모드로 동작하므로 인증키 없이 실제 브라우저에서 전 흐름을 검증한다.

async function addByMarking(page: Page, marking: string, expectName: string) {
  await page.getByRole('tab', { name: '실물 검색' }).click();
  await page.getByLabel(/각인/).fill(marking);
  await page.getByRole('button', { name: '검색' }).click();
  await expect(page.getByText(expectName)).toBeVisible();
  await page.getByRole('button', { name: '환자 리스트에 추가' }).click();
  const sheet = page.getByRole('dialog', { name: '환자 리스트에 추가' });
  await sheet.getByRole('button', { name: '추가', exact: true }).click();
  await expect(sheet).toBeHidden();
}

async function addByName(page: Page, name: string, expectName: string) {
  await page.getByRole('tab', { name: '이름 검색' }).click();
  await page.getByLabel('품목명').fill(name);
  await page.getByRole('button', { name: '검색' }).click();
  await expect(page.getByText(expectName)).toBeVisible();
  await page.getByRole('button', { name: '환자 리스트에 추가' }).click();
  const sheet = page.getByRole('dialog', { name: '환자 리스트에 추가' });
  await sheet.getByRole('button', { name: '추가', exact: true }).click();
  await expect(sheet).toBeHidden();
}

const lineTexts = (page: Page) => page.locator('ul.med-list .med-name').allTextContents();

test('기본 화면: 환자1 + 데모 배너 + 실물 검색 기본 탭', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '환자1' })).toBeVisible();
  await expect(page.getByText(/데모\(목\) 모드/)).toBeVisible();
  // 실물 검색 탭이 기본 선택
  await expect(page.getByRole('tab', { name: '실물 검색' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('검색 → 추가 → 한 줄 포맷 표시', async ({ page }) => {
  await page.goto('/');
  await addByMarking(page, 'Bayer', '아스피린장용정100mg');
  const lines = await lineTexts(page);
  expect(lines[0]).toContain('아스피린장용정100mg');
  expect(lines[0]).toContain('1T QD 아침식후');
});

test('드래그앤드롭으로 수동 순서 변경(터치 포인터)', async ({ page }) => {
  await page.goto('/');
  await addByMarking(page, 'Bayer', '아스피린장용정100mg'); // 1번
  await addByName(page, '타이레놀', '타이레놀정500mg'); // 2번

  let lines = await lineTexts(page);
  expect(lines[0]).toContain('아스피린');
  expect(lines[1]).toContain('타이레놀');

  // 첫 항목 핸들을 두 번째 항목 아래로 드래그
  const handles = page.locator('.med-handle');
  const first = await handles.nth(0).boundingBox();
  const second = await handles.nth(1).boundingBox();
  if (!first || !second) throw new Error('핸들 위치를 찾지 못함');

  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  // dnd-kit PointerSensor 활성화(>6px) 위해 단계적으로 이동
  await page.mouse.move(first.x + first.width / 2, first.y + 20, { steps: 5 });
  await page.mouse.move(second.x + second.width / 2, second.y + second.height + 20, {
    steps: 10,
  });
  await page.mouse.up();

  await expect
    .poll(async () => (await lineTexts(page))[0])
    .toContain('타이레놀');
  lines = await lineTexts(page);
  expect(lines[1]).toContain('아스피린');
  // 드래그 후 수동 정렬로 고정
  await expect(page.locator('.sort-status')).toHaveText('수동 정렬');
});

test('자동정렬: 용법순으로 재배치', async ({ page }) => {
  await page.goto('/');
  // 타이레놀을 TID 로 추가
  await page.getByRole('tab', { name: '이름 검색' }).click();
  await page.getByLabel('품목명').fill('타이레놀');
  await page.getByRole('button', { name: '검색' }).click();
  await expect(page.getByText('타이레놀정500mg')).toBeVisible();
  await page.getByRole('button', { name: '환자 리스트에 추가' }).click();
  let sheet = page.getByRole('dialog', { name: '환자 리스트에 추가' });
  await sheet.getByRole('button', { name: 'TID · 1일 3회' }).click();
  await sheet.getByRole('button', { name: '추가', exact: true }).click();
  await expect(sheet).toBeHidden();

  // 아스피린을 QD 로 추가
  await addByMarking(page, 'Bayer', '아스피린장용정100mg');

  // 현재 수동 순서: [타이레놀(TID), 아스피린(QD)]
  let lines = await lineTexts(page);
  expect(lines[0]).toContain('타이레놀');

  // 용법순 정렬 → QD 가 먼저
  await page.getByRole('button', { name: '용법순' }).click();
  lines = await lineTexts(page);
  expect(lines[0]).toContain('아스피린');
  expect(lines[1]).toContain('타이레놀');
});
