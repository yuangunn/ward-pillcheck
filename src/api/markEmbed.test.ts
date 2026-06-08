import { describe, it, expect, beforeEach } from 'vitest';
import { getEmbedMode, setEmbedMode } from './markEmbed';

// 실험 토글(localStorage 플래그)만 단위 검증. 실제 ONNX 추론은 브라우저(wasm)·CDN 전용이라 제외.
describe('markEmbed 토글', () => {
  beforeEach(() => localStorage.clear());

  it('기본은 꺼짐', () => {
    expect(getEmbedMode()).toBe(false);
  });
  it('켜고 끄기 저장', () => {
    setEmbedMode(true);
    expect(getEmbedMode()).toBe(true);
    setEmbedMode(false);
    expect(getEmbedMode()).toBe(false);
  });
});
