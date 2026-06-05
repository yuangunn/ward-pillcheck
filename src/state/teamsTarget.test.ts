import { describe, it, expect, beforeEach } from 'vitest';
import { teamsDeepLink, getTeamsTarget, setTeamsTarget } from './teamsTarget';

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
});
