import { useEffect } from 'react';

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

/** 낱알이미지 전체화면 확대 보기. 아무 곳이나 탭하거나 Esc 로 닫힘. */
export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="이미지 확대" onClick={onClose}>
      <img className="lightbox-img" src={src} alt={alt ?? ''} />
      <button type="button" className="lightbox-close" aria-label="닫기" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
