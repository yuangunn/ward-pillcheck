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
from PIL import Image, ImageFilter, ImageOps, ImageChops

OUT = 224  # 모델 입력 크기
WORK = 256  # 작업 해상도


def list_marks(marks_dir: str, marks_json: str) -> List[Tuple[str, str, str]]:
    """[(imgId, code, path)] — marks.json(file,code) 기준, 실제 존재하는 파일만.

    같은 이미지 파일을 가리키는 중복 항목(시각은 같고 코드만 다름)은 첫 항목만 남긴다.
    동일 이미지를 서로 다른 클래스로 학습시키면 분류가 깨지므로 '이미지 1장 = 1클래스'.
    (marks.json 431항목 ≈ 224 유니크 이미지)
    """
    with open(marks_json, encoding="utf-8") as f:
        arr = json.load(f)
    out: List[Tuple[str, str, str]] = []
    seen: set[str] = set()
    for m in arr:
        p = os.path.join(marks_dir, m["file"])
        if m["file"] in seen or not os.path.exists(p):
            continue
        seen.add(m["file"])
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


def augment(base: Image.Image, rng: np.random.Generator, hard: bool = False) -> Image.Image:
    """base('L', WORK) → 증강된 'L'(OUT). 사람 손그림 흉내.

    hard=True: 사람이 실제로 그리는 특성(더 큰 회전·전단(비율왜곡)·탄성왜곡, 획 생략↑,
    가는 스케치 윤곽)을 더 세게 시뮬 → 모델이 합성 분포를 외우지 못하게 해 cross-domain
    robustness 를 높인다. hard=False 는 기존과 동일(기존 벤치/하위호환 보존).
    """
    img = base
    # 1) 회전
    rot = 32.0 if hard else 25.0
    img = img.rotate(float(rng.uniform(-rot, rot)), resample=Image.BICUBIC, fillcolor=255)
    # 1b) 전단(hard) — 사람 손그림의 비율 왜곡
    if hard:
        shx, shy = float(rng.uniform(-0.18, 0.18)), float(rng.uniform(-0.18, 0.18))
        img = img.transform((WORK, WORK), Image.AFFINE, (1, shx, 0, shy, 1, 0),
                            resample=Image.BILINEAR, fillcolor=255)
    # 2) 스케일 + 이동(흰 캔버스에 붙이기)
    lo, hi = (0.62, 1.25) if hard else (0.78, 1.18)
    s = float(rng.uniform(lo, hi))
    w, h = max(1, int(WORK * s)), max(1, int(WORK * s))
    scaled = img.resize((w, h), Image.BILINEAR)
    canvas = Image.new("L", (WORK, WORK), 255)
    jx = int(rng.uniform(-1, 1) * (WORK - w) / 2) if w < WORK else 0
    jy = int(rng.uniform(-1, 1) * (WORK - h) / 2) if h < WORK else 0
    canvas.paste(scaled, ((WORK - w) // 2 + jx, (WORK - h) // 2 + jy))
    img = canvas
    # 3) 탄성 왜곡(손떨림)
    amax = 11.0 if hard else 7.0
    arr = _elastic(np.asarray(img, dtype=np.uint8), rng, alpha=float(rng.uniform(2, amax)))
    img = Image.fromarray(arr, mode="L")
    # 3b) 가는 스케치 윤곽(hard) — 채우지 않고 외곽선만 그리는 사람 흉내(형태 그래디언트)
    if hard and rng.random() < 0.22:
        ink = ImageOps.invert(img)  # 잉크=밝게
        grad = ImageChops.difference(ink.filter(ImageFilter.MaxFilter(3)),
                                     ink.filter(ImageFilter.MinFilter(3)))
        img = ImageOps.invert(grad)  # 외곽선=어둡게, 배경 흰색
    # 4) 획 굵기(잉크=어두움 → MinFilter 가 굵게, MaxFilter 가 얇게)
    r = rng.random()
    if r < 0.4:
        img = img.filter(ImageFilter.MinFilter(3))
    elif r > 0.75:
        img = img.filter(ImageFilter.MaxFilter(3))
    # 5) 획 누락(작은 사각 지우기) — hard 는 더 많이/크게(사람은 일부를 빠뜨림)
    arr = np.asarray(img, dtype=np.uint8).copy()
    nblk = int(rng.integers(0, 5 if hard else 3))
    bmax = 64 if hard else 45
    for _ in range(nblk):
        bw, bh = int(rng.integers(10, bmax)), int(rng.integers(10, bmax))
        x, y = int(rng.integers(0, WORK - bw)), int(rng.integers(0, WORK - bh))
        arr[y:y + bh, x:x + bw] = 255
    # 6) 소금후추 노이즈
    n = int((0.004 if hard else 0.003) * WORK * WORK)
    ys = rng.integers(0, WORK, n); xs = rng.integers(0, WORK, n)
    arr[ys, xs] = np.where(rng.random(n) > 0.5, 40, 220).astype(np.uint8)
    img = Image.fromarray(arr, mode="L")
    return img.resize((OUT, OUT), Image.BILINEAR)


def _find_coeffs(dst, src):
    """PIL PERSPECTIVE 8계수: 출력 dst 코너 ↔ 입력 src 코너 매핑."""
    m = []
    for (dx, dy), (sx, sy) in zip(dst, src):
        m.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        m.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
    A = np.array(m, dtype=np.float64)
    b = np.array(src, dtype=np.float64).reshape(8)
    return np.linalg.solve(A, b).tolist()


def augment2(base: Image.Image, rng: np.random.Generator, t: float = 1.0) -> Image.Image:
    """강화 v2 — 강도 t(0=약함 ~ 1.3=극악)로 회전·전단·원근·탄성·획스타일·부분획·부분crop·노이즈.
    학습은 샘플마다 t 랜덤(풀스펙트럼), 평가는 t 고정(extra-hard=학습 안 쓴 큰 t). v1 augment 상위호환."""
    img = base
    # 회전
    rr = 25 + 12 * t
    img = img.rotate(float(rng.uniform(-rr, rr)), resample=Image.BICUBIC, fillcolor=255)
    # 전단
    sh = 0.20 * t
    img = img.transform((WORK, WORK), Image.AFFINE,
                        (1, float(rng.uniform(-sh, sh)), 0, float(rng.uniform(-sh, sh)), 1, 0),
                        resample=Image.BILINEAR, fillcolor=255)
    # 원근(keystone) — 시점 변화
    if rng.random() < 0.6:
        d = 0.12 * t * WORK
        dst = [(0, 0), (WORK, 0), (WORK, WORK), (0, WORK)]
        src = [(rng.uniform(-d, d), rng.uniform(-d, d)),
               (WORK + rng.uniform(-d, d), rng.uniform(-d, d)),
               (WORK + rng.uniform(-d, d), WORK + rng.uniform(-d, d)),
               (rng.uniform(-d, d), WORK + rng.uniform(-d, d))]
        try:
            img = img.transform((WORK, WORK), Image.PERSPECTIVE, _find_coeffs(dst, src),
                                resample=Image.BILINEAR, fillcolor=255)
        except Exception:
            pass
    # 스케일 + 이동
    s = float(rng.uniform(0.78 - 0.20 * t, 1.18 + 0.12 * t))
    w, h = max(1, int(WORK * s)), max(1, int(WORK * s))
    scaled = img.resize((w, h), Image.BILINEAR)
    canvas = Image.new("L", (WORK, WORK), 255)
    jx = int(rng.uniform(-1, 1) * (WORK - w) / 2) if w < WORK else 0
    jy = int(rng.uniform(-1, 1) * (WORK - h) / 2) if h < WORK else 0
    canvas.paste(scaled, ((WORK - w) // 2 + jx, (WORK - h) // 2 + jy))
    img = canvas
    # 탄성 왜곡
    arr = _elastic(np.asarray(img, dtype=np.uint8), rng, alpha=float(rng.uniform(2, 7 + 6 * t)))
    img = Image.fromarray(arr, mode="L")
    # 스케치 윤곽(외곽선만)
    if t > 0.5 and rng.random() < 0.25:
        ink = ImageOps.invert(img)
        grad = ImageChops.difference(ink.filter(ImageFilter.MaxFilter(3)), ink.filter(ImageFilter.MinFilter(3)))
        img = ImageOps.invert(grad)
    # 획 굵기
    r = rng.random()
    if r < 0.4:
        img = img.filter(ImageFilter.MinFilter(3))
    elif r > 0.78:
        img = img.filter(ImageFilter.MaxFilter(3))
    # 부분 crop(일부만 그리기)
    if rng.random() < 0.25 * t:
        cw, ch = int(WORK * rng.uniform(0.55, 0.85)), int(WORK * rng.uniform(0.55, 0.85))
        cx, cy = int(rng.uniform(0, WORK - cw)), int(rng.uniform(0, WORK - ch))
        img = img.crop((cx, cy, cx + cw, cy + ch)).resize((WORK, WORK), Image.BILINEAR)
    # 획 누락 + 끊긴 획
    arr = np.asarray(img, dtype=np.uint8).copy()
    nblk = int(rng.integers(0, 1 + int(6 * t)))
    bmax = int(40 + 30 * t)
    for _ in range(nblk):
        bw, bh = int(rng.integers(8, bmax)), int(rng.integers(8, bmax))
        x, y = int(rng.integers(0, WORK - bw)), int(rng.integers(0, WORK - bh))
        arr[y:y + bh, x:x + bw] = 255
    # 노이즈
    n = int((0.003 + 0.003 * t) * WORK * WORK)
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
