import { test, expect } from '@playwright/test';

// 데모(목) 모드로 동작 — 인증키 없이 실제 브라우저에서 리디자인 핵심 흐름 검증.

// 기본은 온보딩·면책 게이트를 끈 상태로(첫 실행 오버레이가 클릭을 가리지 않도록). 전용 케이스에서 검증.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ward-pillcheck:onboarded', '1');
    localStorage.setItem('ward-pillcheck:disclaimer-v1', '1');
  });
});

test('환자 많아도 스크롤되고, 하단 액션바는 스크롤 영역 밖에 고정', async ({ page }) => {
  await page.addInitScript(() => {
    const patients = Array.from({ length: 12 }, (_, i) => ({
      id: 'p' + i,
      label: '환자' + (i + 1),
      meds: [],
      sortMode: 'manual',
      updatedAt: Date.now() - i * 1000,
    }));
    localStorage.setItem(
      'ward-pillcheck:v1',
      JSON.stringify({ schemaVersion: 2, patients, activePatientId: 'p0' }),
    );
  });
  await page.goto('/');
  await expect(page.getByText('환자 12명')).toBeVisible();
  // 하단 '새 환자 추가' 바는 스크롤 컨테이너(.screen-scroll) 밖에 있어야 함(iOS 스크롤 깨짐 방지)
  const addBtn = page.getByRole('button', { name: '새 환자 추가' });
  await expect(addBtn).toBeVisible();
  const insideScroller = await addBtn.evaluate((el) => !!el.closest('.screen-scroll'));
  expect(insideScroller).toBe(false);
  // 끝까지 스크롤하면 마지막 환자 보임
  await page.evaluate(() => {
    (document.querySelector('.screen-scroll') as HTMLElement).scrollTop = 99999;
  });
  await expect(page.getByRole('button', { name: /환자12/ })).toBeVisible();
});

test('첫 실행: 온보딩 가이드 → 건너뛰기', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ward-pillcheck:onboarded');
    // 설치형(standalone)에선 기능 온보딩이 인트로로 뜬다(미설치 브라우저는 설치 가이드가 인트로).
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
  });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: '사용 가이드' })).toBeVisible();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByText('환자1')).toBeVisible();
});

test('온보딩: 10장 카드 진행 → 시작하기', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ward-pillcheck:onboarded');
    // 설치형(standalone)에선 기능 온보딩이 인트로로 뜬다(미설치 브라우저는 설치 가이드가 인트로).
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
  });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: '사용 가이드' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('01 / 10')).toBeVisible();
  for (let k = 0; k < 9; k++) await dialog.getByRole('button', { name: '다음' }).click();
  await expect(dialog.getByText('10 / 10')).toBeVisible();
  await dialog.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByText('환자1')).toBeVisible();
});

test('온보딩: 점(dot)으로 특정 카드 이동', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ward-pillcheck:onboarded');
    // 설치형(standalone)에선 기능 온보딩이 인트로로 뜬다(미설치 브라우저는 설치 가이드가 인트로).
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
  });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: '사용 가이드' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '5번째 카드' }).click();
  await expect(dialog.getByText('05 / 10')).toBeVisible();
});

test('첫 실행: 면책 게이트 → 이해했습니다 → 진입', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('ward-pillcheck:disclaimer-v1'));
  await page.goto('/');
  const gate = page.getByRole('dialog', { name: '사용 전 확인' });
  await expect(gate).toBeVisible();
  // 데모(목) 모드는 받을 데이터가 없어 즉시 활성화
  const ack = gate.getByRole('button', { name: '이해했습니다' });
  await expect(ack).toBeEnabled();
  await ack.click();
  await expect(gate).toBeHidden();
  await expect(page.getByText('환자1')).toBeVisible();
});

test('첫 실행(미설치 브라우저): 설치 가이드가 인트로로', async ({ page }) => {
  // standalone 이 아니고 인앱도 아닌 일반 브라우저 첫 실행 → 온보딩 대신 설치 가이드가 인트로.
  await page.addInitScript(() => localStorage.removeItem('ward-pillcheck:onboarded'));
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: '앱 설치 가이드' })).toBeVisible();
});

test('설치 배너 → 설치 가이드 열림 + 브라우저 전환', async ({ page }) => {
  // 비standalone(브라우저)에선 홈 상단에 설치 배너 노출
  await page.goto('/');
  await page.getByRole('button', { name: /홈 화면 앱으로 설치/ }).click();
  const guide = page.getByRole('dialog', { name: '앱 설치 가이드' });
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: '크롬' }).click();
  await expect(guide.getByText(/안드로이드 크롬/)).toBeVisible();
  await guide.getByRole('button', { name: '따라 했어요 · 닫기' }).click();
  await expect(guide).not.toBeVisible();
});

test('Teams 보내기: 대상 미지정 시 입력 팝업', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  // 약 1건 추가
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();
  // 공유하기 → Teams로 보내기 → 대상 미지정이라 입력 팝업
  await page.getByRole('button', { name: '공유하기' }).click();
  await page.getByRole('button', { name: 'Teams로 보내기' }).click();
  const prompt = page.getByRole('dialog', { name: 'Teams 대상 입력' });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByLabel('Teams 대상 이메일')).toBeVisible();
  await expect(prompt.getByRole('button', { name: '저장하고 보내기' })).toBeDisabled();
  // 원외 일반 도메인(.org)은 차단 — 안내 뜨고 버튼 비활성
  await prompt.getByLabel('Teams 대상 이메일').fill('ward7@hospital.org');
  await expect(prompt.getByRole('button', { name: '저장하고 보내기' })).toBeDisabled();
  await expect(prompt.getByText(/병원 공용 Teams/)).toBeVisible();
  // 대학·대학병원(.ac.kr) 계정은 허용
  await prompt.getByLabel('Teams 대상 이메일').fill('ward7@hospital.ac.kr');
  await expect(prompt.getByRole('button', { name: '저장하고 보내기' })).toBeEnabled();
});

test('복사하기: 개인정보 유출 확인 팝업 → 가린 채 복사', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();
  await page.getByRole('button', { name: '공유하기' }).click();
  await page.getByRole('dialog', { name: '인계용 텍스트' }).getByRole('button', { name: '복사하기' }).click();
  // 확인 팝업이 뜨고, 확인하면 '복사됐어요'
  const confirm = page.getByRole('dialog', { name: '개인정보 유출 주의' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '가린 채 복사' }).click();
  await expect(page.getByRole('button', { name: '복사됐어요' })).toBeVisible();
});

test('공유 상세설정: 겉모습 토글 → 미리보기 반영', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();
  await page.getByRole('button', { name: '공유하기' }).click();
  const sheet = page.getByRole('dialog', { name: '인계용 텍스트' });
  const pre = sheet.locator('pre');
  await expect(pre).toContainText('('); // 겉모습 기본 포함
  await sheet.getByRole('button', { name: '공유 상세설정' }).click();
  await sheet.getByRole('switch', { name: '겉모습 표시' }).click();
  await expect(pre).not.toContainText('('); // 겉모습 제외됨
});

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
  await expect(page.locator('.med-list .med-name')).toContainText('아스피린장용정100mg');
});

test('실물 검색: 분할선(일자) 필터로 좁히기', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await expect(page.getByRole('tab', { name: '실물 검색' })).toHaveAttribute('aria-selected', 'true');
  // 분할선 '일자' 칩 → 분할선 있는 약(타이레놀)만
  await page.getByRole('button', { name: '일자', exact: true }).click();
  await expect(page.getByText('타이레놀정500mg')).toBeVisible();
});

test('이름 검색 탭 전환', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByRole('tab', { name: '이름 검색' }).click();
  await page.getByLabel('품목명').fill('타이레놀');
  await expect(page.getByText('타이레놀정500mg')).toBeVisible();
});

test('새 환자 추가 → 이름 입력 시트 → 입력한 이름으로 환자 생성', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 환자 추가' }).click();
  // 이름 입력 시트
  const sheet = page.getByRole('dialog', { name: '새 환자' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('환자 이름').fill('301-1');
  await sheet.getByRole('button', { name: '추가' }).click();
  // 환자명은 이름수정 버튼으로 표시
  await expect(page.getByRole('button', { name: '이름 수정' })).toContainText('301-1');
});

test('새 환자 추가: 라벨 비우면 기본 환자2', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '새 환자 추가' }).click();
  await page.getByRole('dialog', { name: '새 환자' }).getByRole('button', { name: '추가' }).click();
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
  // 주사·외용약도 약 상세 정보 버튼 노출(itemSeq 보유)
  await expect(sheet.getByRole('button', { name: '약 상세 정보' })).toBeVisible();
  await sheet.getByRole('button', { name: '환자 리스트에 추가' }).click();
  await expect(page.locator('.med-list .med-name')).toContainText('란투스주솔로스타펜');
});

test('직접 입력으로 주사약 추가', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByRole('button', { name: /직접 입력/ }).click();
  const sheet = page.getByRole('dialog', { name: '직접 입력' });
  await sheet.getByLabel('약 이름').fill('란투스주');
  await sheet.getByLabel('용량 단위').selectOption('U');
  await sheet.getByRole('button', { name: '환자 리스트에 추가' }).click();
  await expect(page.locator('.med-list .med-name')).toContainText('란투스주');
});

test('용법 필요시 → 사유 입력 모달 → 투약시점에 필요시 자동 체크', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  const sheet = page.getByRole('dialog', { name: '리스트에 추가' });
  // 용법 '필요시' 칩(서브라벨 PRN 으로 식별) → "어떨 때 복용하는 약인가요?" 모달
  await sheet.getByRole('button', { name: /PRN/ }).click();
  const modal = page.getByRole('dialog', { name: '어떨 때 복용하는 약인가요?' });
  await expect(modal).toBeVisible();
  await modal.getByRole('textbox').fill('통증 시');
  await modal.getByRole('button', { name: '확인' }).click();
  await expect(modal).not.toBeVisible();
  // 투약시점에 '필요시' 자동 체크 (정확 일치로 용법칩 '필요시 PRN'과 구분)
  await expect(sheet.getByRole('button', { name: '필요시', exact: true, pressed: true })).toBeVisible();
});

test('용법 QD: 투약시점이 라디오(1개)로 작동', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  const sheet = page.getByRole('dialog', { name: '리스트에 추가' });
  // QD 기본 → 아침식후 1개 체크. 다른 시점 누르면 교체(라디오)
  await sheet.getByRole('button', { name: '점심식후' }).click();
  await expect(sheet.getByRole('button', { name: '점심식후', pressed: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: '아침식후', pressed: false })).toBeVisible();
});

test('용법 주 1회 → 요일 선택 모달', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  const sheet = page.getByRole('dialog', { name: '리스트에 추가' });
  await sheet.getByRole('button', { name: /QW/ }).click();
  const modal = page.getByRole('dialog', { name: '어느 요일에 투여하나요?' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: '확인' })).toBeDisabled();
  await modal.getByRole('button', { name: '월', exact: true }).click();
  await expect(modal.getByRole('button', { name: '확인' })).toBeEnabled();
  await modal.getByRole('button', { name: '확인' }).click();
  await expect(modal).not.toBeVisible();
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

test('상세 성분: 한글 주성분을 앞세우고 영문을 보조 표기', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '의약품 검색' }).click();
  await page.getByLabel('의약품 이름 검색').fill('노바스크');
  await page.getByText('노바스크정5mg').click();
  const sheet = page.getByRole('dialog', { name: '약 상세 정보' });
  await expect(sheet.getByText('암로디핀베실산염')).toBeVisible(); // 한글 주성분
  await expect(sheet.getByText('Amlodipine Besylate')).toBeVisible(); // 영문 병기
});

test('환자 약 행 탭 → 수정 시트', async ({ page }) => {
  await page.goto('/');
  await page.getByText('환자1').click();
  await page.getByRole('button', { name: '약 검색해서 추가' }).click();
  await page.getByLabel('각인').fill('Bayer');
  await page.getByText('아스피린장용정100mg').click();
  await page.getByRole('dialog', { name: '리스트에 추가' }).getByRole('button', { name: '환자 리스트에 추가' }).click();
  // 텍스트(인계형) 뷰의 약 행을 탭하면 수정 시트가 열리고, 약 상세 정보 섹션도 제공한다.
  await page.locator('.med-list button').first().click();
  const editSheet = page.getByRole('dialog', { name: '약 수정' });
  await expect(editSheet).toBeVisible();
  await expect(editSheet.getByRole('button', { name: '약 상세 정보' })).toBeVisible();
});

test('설정: 오프라인 데이터 화면 열림', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '설정' }).click();
  const sheet = page.getByRole('dialog', { name: '설정' });
  await expect(sheet.getByText('오프라인 데이터')).toBeVisible();
  await expect(sheet.getByText(/허가사항 상세/)).toBeVisible();
  await expect(sheet.getByText(/금기점검\(DUR\)/)).toBeVisible();
  await expect(sheet.getByText(/실물사진 \(선택/)).toBeVisible();
  await expect(sheet.getByLabel('Teams 대상 이메일')).toBeVisible();
});

test('다크 모드 토글', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: '테마 전환' }).click();
  await expect
    .poll(async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .not.toBe(before);
});
