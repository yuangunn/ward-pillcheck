"""마크 이미지 → '가짜 손그림' 증강 생성기 (PIL/numpy 만 사용).

cross-domain 학습용. 깨끗한 인쇄 마크에 회전/스케일/이동 + 탄성왜곡(손떨림)
+ 획굵기 + 획누락(지우기) + 노이즈를 줘서 사람이 그린 스케치에 가깝게 만든다.
train.py 가 이 함수들을 온더플라이로 호출한다(디스크 저장 0).

주의: 합성은 진짜 손그림 분포와 다르다 — 향상의 상한이 있다. 실데이터 병행 권장.
"""
from __future__ import annotations
import argparse
import json
import os
from typing import List, Tuple
import numpy as np
from PIL import Image, ImageFilter

OUT = 224  # 모델 입력 크기
WORK = 256  # 작업 해상도


def list_marks(marks_dir: str, marks_json: str) -> List[Tuple[str, str, str]]:
    """[(imgId, code, path)] — marks.json(file,code) 기준, 실제 존재하는 파일만."""
    with open(marks_json, encoding="utf-8") as f:
        arr = json.load(f)
    out = []
    for m in arr:
        p = os.path.join(marks_dir, m["file"])
        if os.path.exists(p):
            out.append((m["file"].rsplit(".", 1)[0], m.get("code", ""), p))
    return out


def load_base(path: str, size: int = WORK) -> Image.Image:
    """마크 → 흰배경 contain 그레이스케일('L', 0=검정 잉크 ~ 255=흰 배경)."""
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    im = Image.alpha_composite(bg, im).convert("L")
    canvas = Image.new("L", (size, size), 255)
    r = min(size / im.width, size / im.height)
    w, h = max(1, int(im.width * r)), max(1, int(im.height * r))
    im = im.resize((w, h), Image.BILINEAR)
    canvas.paste(im, ((size - w) // 2, (size - h) // 2))
    return canvas


def _elastic(arr: np.ndarray, rng: np.random.Generator, alpha: float) -> np.ndarray:
    """저해상 랜덤 변위장을 업샘플해 픽셀을 재배치(손떨림). arr: HxW uint8."""
    h, w = arr.shape
    low = max(4, w // 16)
    def field() -> np.ndarray:
        f = (rng.random((low, low)).astype("float32") * 2 - 1)
        return np.asarray(Image.fromarray(f, mode="F").resize((w, h), Image.BILINEAR)) * alpha
    xx, yy = np.meshgrid(np.arange(w), np.arange(h))
    mapx = np.clip(xx + field(), 0, w - 1).astype(np.int32)
    mapy = np.clip(yy + field(), 0, h - 1).astype(np.int32)
    return arr[mapy, mapx]


def augment(base: Image.Image, rng: np.random.Generator) -> Image.Image:
    """base('L', WORK) → 증강된 'L'(OUT). 사람 손그림 흉내."""
    img = base
    # 1) 회전
    img = img.rotate(float(rng.uniform(-25, 25)), resample=Image.BICUBIC, fillcolor=255)
    # 2) 스케일 + 이동(흰 캔버스에 붙이기)
    s = float(rng.uniform(0.78, 1.18))
    w, h = max(1, int(WORK * s)), max(1, int(WORK * s))
    scaled = img.resize((w, h), Image.BILINEAR)
    canvas = Image.new("L", (WORK, WORK), 255)
    jx = int(rng.uniform(-1, 1) * (WORK - w) / 2) if w < WORK else 0
    jy = int(rng.uniform(-1, 1) * (WORK - h) / 2) if h < WORK else 0
    canvas.paste(scaled, ((WORK - w) // 2 + jx, (WORK - h) // 2 + jy))
    img = canvas
    # 3) 탄성 왜곡
    arr = _elastic(np.asarray(img, dtype=np.uint8), rng, alpha=float(rng.uniform(2, 7)))
    img = Image.fromarray(arr, mode="L")
    # 4) 획 굵기(잉크=어두움 → MinFilter 가 굵게, MaxFilter 가 얇게)
    r = rng.random()
    if r < 0.4:
        img = img.filter(ImageFilter.MinFilter(3))
    elif r > 0.75:
        img = img.filter(ImageFilter.MaxFilter(3))
    # 5) 획 누락(작은 사각 지우기)
    arr = np.asarray(img, dtype=np.uint8).copy()
    for _ in range(int(rng.integers(0, 3))):
        bw, bh = int(rng.integers(10, 45)), int(rng.integers(10, 45))
        x, y = int(rng.integers(0, WORK - bw)), int(rng.integers(0, WORK - bh))
        arr[y:y + bh, x:x + bw] = 255
    # 6) 소금후추 노이즈
    n = int(0.003 * WORK * WORK)
    ys = rng.integers(0, WORK, n); xs = rng.integers(0, WORK, n)
    arr[ys, xs] = np.where(rng.random(n) > 0.5, 40, 220).astype(np.uint8)
    img = Image.fromarray(arr, mode="L")
    return img.resize((OUT, OUT), Image.BILINEAR)


def has_ink(img: Image.Image) -> bool:
    a = np.asarray(img, dtype=np.uint8)
    return bool((a < 128).mean() > 0.002)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--marks", default="public/data/marks")
    ap.add_argument("--marks-json", default="public/data/marks.json")
    ap.add_argument("--preview", default="ml/_preview")
    ap.add_argument("--per-class", type=int, default=8)
    ap.add_argument("--classes", type=int, default=12, help="미리보기할 클래스 수")
    args = ap.parse_args()

    marks = list_marks(args.marks, args.marks_json)
    print(f"마크 {len(marks)}종 로드")
    os.makedirs(args.preview, exist_ok=True)
    rng = np.random.default_rng(20260609)
    made = 0
    for imgId, _code, path in marks[: args.classes]:
        base = load_base(path)
        for i in range(args.per_class):
            aug = augment(base, rng)
            aug.save(os.path.join(args.preview, f"{imgId}_{i}.png"))
            made += 1
    print(f"미리보기 {made}장 → {args.preview}")


if __name__ == "__main__":
    main()
