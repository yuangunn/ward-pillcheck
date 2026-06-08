import { describe, it, expect, beforeEach } from 'vitest';
import {
  teamsDeepLink,
  getTeamsTarget,
  setTeamsTarget,
  isAllowedTeamsTarget,
  setAllowedDomains,
  getAllowedDomains,
} from './teamsTarget';

describe('teamsTarget', () => {
  beforeEach(() => localStorage.clear());

  it('대상 있으면 users + message prefill', () => {
    const u = new URL(teamsDeepLink('아스피린 1T QD', 'ward3@h.org'));
    expect(u.origin + u.pathname).toBe('https://teams.microsoft.com/l/chat/0/0');
    expect(u.searchParams.get('users')).toBe('ward3@h.org');
    expect(u.searchParams.get('message')).toBe('아스피린 1T QD');
  });

  it('대상 없으면 users 생략, message 만', () => {
    const u = new URL(teamsDeepLink('인계 내용'));
    expect(u.searchParams.has('users')).toBe(false);
    expect(u.searchParams.get('message')).toBe('인계 내용');
  });

  it('저장된 대상을 기본으로 사용', () => {
    setTeamsTarget(' a@b.org ');
    expect(getTeamsTarget()).toBe('a@b.org'); // 트림
    expect(new URL(teamsDeepLink('x')).searchParams.get('users')).toBe('a@b.org');
  });

  it('빈 값 저장 시 제거', () => {
    setTeamsTarget('a@b.org');
    setTeamsTarget('');
    expect(getTeamsTarget()).toBe('');
  });

  it('공백은 +가 아니라 %20으로 인코딩 (Teams 띄어쓰기 깨짐 방지)', () => {
    const url = teamsDeepLink('아스피린 1T QD 아침식후');
    const query = url.split('?')[1];
    expect(query).toContain('%20');
    expect(query).not.toContain('+');
  });
});

describe('isAllowedTeamsTarget (대상 도메인 제한)', () => {
  beforeEach(() => localStorage.clear());

  it('.ac.kr / .ac 로 끝나는 대학·대학병원 계정은 허용', () => {
    expect(isAllowedTeamsTarget('ward7@snu.ac.kr')).toBe(true);
    expect(isAllowedTeamsTarget('me@bbb.ac')).toBe(true);
    expect(isAllowedTeamsTarget('  ME@Hosp.AC.KR ')).toBe(true); // 대소문자·공백 무시
  });

  it('원외 일반 계정은 차단', () => {
    expect(isAllowedTeamsTarget('me@gmail.com')).toBe(false);
    expect(isAllowedTeamsTarget('me@hospital.org')).toBe(false);
    expect(isAllowedTeamsTarget('not-an-email')).toBe(false);
    expect(isAllowedTeamsTarget('@ac.kr')).toBe(false); // 로컬파트 없음
    expect(isAllowedTeamsTarget('me@')).toBe(false);
  });

  it('설정에 등록한 병원 도메인은 허용(서브도메인 포함)', () => {
    setAllowedDomains('snuh.org, amc.seoul.kr');
    expect(getAllowedDomains()).toEqual(['snuh.org', 'amc.seoul.kr']);
    expect(isAllowedTeamsTarget('nurse@snuh.org')).toBe(true);
    expect(isAllowedTeamsTarget('nurse@mail.snuh.org')).toBe(true); // 서브도메인
    expect(isAllowedTeamsTarget('nurse@other.org')).toBe(false);
  });
});
