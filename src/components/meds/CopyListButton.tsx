import { useState } from 'react';
import type { MedItem } from '../../domain/models';
import { buildListText } from '../../domain/format';

interface Props {
  label: string;
  meds: MedItem[]; // 화면에 보이는 순서
}

/** 클립보드 복사(폴백 포함). 성공 여부 반환. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 폴백으로 진행 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 복약 리스트를 인계용 텍스트로 복사/공유. */
export function CopyListButton({ label, meds }: Props) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const onCopy = async () => {
    const text = buildListText(label, meds);
    if (await copyText(text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const onShare = async () => {
    try {
      await navigator.share({ title: `${label} 복약 리스트`, text: buildListText(label, meds) });
    } catch {
      /* 사용자가 취소했거나 미지원 — 무시 */
    }
  };

  return (
    <div className="copy-row">
      <button type="button" className="btn btn-ghost copy-btn" onClick={onCopy}>
        {copied ? '복사됨 ✓' : '리스트 복사'}
      </button>
      {canShare && (
        <button type="button" className="btn btn-ghost copy-btn" onClick={onShare}>
          공유
        </button>
      )}
      <span className="visually-hidden" aria-live="polite">
        {copied ? '리스트가 복사되었습니다' : ''}
      </span>
    </div>
  );
}
