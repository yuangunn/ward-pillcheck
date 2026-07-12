import { describe, it, expect } from 'vitest';
import { isInjectionName, isExternalOrInjectionName } from './permit';

describe('isInjectionName (주사제 판별)', () => {
  it('주사·펜주사·인슐린 등은 주사제', () => {
    expect(isInjectionName('란투스주솔로스타펜')).toBe(true); // …펜(끝)
    expect(isInjectionName('세파졸린나트륨주')).toBe(true);
    expect(isInjectionName('휴마로그퀵펜주')).toBe(true); // 펜주
  });
  it('경구·외용은 주사제 아님', () => {
    expect(isInjectionName('둘코락스좌약')).toBe(false);
    expect(isInjectionName('라미나지액')).toBe(false);
  });
  it("'펜' 경구약(부루펜·아세트아미노펜·펜잘)은 주사제로 오분류하지 않는다", () => {
    expect(isInjectionName('부루펜시럽')).toBe(false);
    expect(isInjectionName('아세트아미노펜정')).toBe(false);
    expect(isInjectionName('펜잘큐정')).toBe(false);
  });
});

describe('isExternalOrInjectionName (외용·주사제 판별 — 외용탭 필터)', () => {
  it('주사·흡입·좌약·점안·연고·겔·펜주사 등 비경구 약은 통과', () => {
    expect(isExternalOrInjectionName('세파졸린나트륨주')).toBe(true);
    expect(isExternalOrInjectionName('벤토린에보할러')).toBe(true);
    expect(isExternalOrInjectionName('둘코락스좌약')).toBe(true);
    expect(isExternalOrInjectionName('오트리빈점비액')).toBe(true);
    expect(isExternalOrInjectionName('테라마이신안연고')).toBe(true);
    expect(isExternalOrInjectionName('볼타렌에멀겔')).toBe(true); // …겔(끝) 외용 겔
    expect(isExternalOrInjectionName('리도카인겔제')).toBe(true); // 겔제
    expect(isExternalOrInjectionName('란투스주솔로스타펜')).toBe(true); // …펜(끝) 인슐린펜
  });
  it('경구 액/시럽/pack 약은 걸러진다(외용탭 오분류 방지)', () => {
    // 사용자 제보 예시 — 모두 경구약
    expect(isExternalOrInjectionName('라미나지액')).toBe(false);
    expect(isExternalOrInjectionName('시네추라시럽')).toBe(false);
    expect(isExternalOrInjectionName('볼그레액')).toBe(false);
  });
  it("'펜'·'겔' 경구약도 걸러진다(부루펜시럽·겔포스·알마겔)", () => {
    expect(isExternalOrInjectionName('부루펜시럽')).toBe(false);
    expect(isExternalOrInjectionName('아세트아미노펜정')).toBe(false);
    expect(isExternalOrInjectionName('펜타사서방정')).toBe(false);
    expect(isExternalOrInjectionName('겔포스엠현탁액')).toBe(false);
    expect(isExternalOrInjectionName('알마겔현탁액')).toBe(false);
  });
  it('일반 경구 고형제도 걸러진다', () => {
    expect(isExternalOrInjectionName('타이레놀정500mg')).toBe(false);
    expect(isExternalOrInjectionName('트라젠타정')).toBe(false);
  });
});
