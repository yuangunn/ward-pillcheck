"""그려서찾기 A/B: HOG vs 출고 모델 vs 신규 모델을 '쉬운/어려운' 두 합성 분포에서 비교.

- 템플릿: 원본 마크 임베딩. 쿼리: synth.augment 로 만든 held-out 손그림(seed 777).
- 쉬운 분포(hard=False): 기존 벤치와 동일 → 신규 모델이 리그레션 없는지 확인.
- 어려운 분포(hard=True): 전단·강한 왜곡·획 생략·스케치 윤곽 → robustness 비교(포화 해소).
- 두 ONNX 모델은 모두 224·3ch ImageNet 전처리(현 출고/신규 동일 구조).

⚠️ 합성 분포라 우열의 '경향'만 본다. 실사용 우열은 실데이터로만 증명된다.
"""
from __future__ import annotations
import argparse
import os
import numpy as np
from PIL import Image
import onnxruntime as ort

from synth import list_marks, load_base, augment, augment2
from run_experiment import hog_feat, _l2  # 검증된 HOG numpy 포팅 재사용

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], np.float32).reshape(3, 1, 1)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], np.float32).reshape(3, 1, 1)


def onnx_embedder(path: str, size: int = 224, channels: int = 3):
    """ONNX 임베딩 함수(224·3ch ImageNet 정규화 기본)."""
    sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0].name

    def embed(img_l: Image.Image) -> np.ndarray:
        a = np.asarray(img_l.convert("L").resize((size, size), Image.BILINEAR), np.float32) / 255.0
        if channels == 1:
            x = a[None, None]
        else:
            a3 = (np.repeat(a[None], 3, 0) - IMAGENET_MEAN) / IMAGENET_STD
            x = a3[None]
        return sess.run(None, {inp: x.astype(np.float32)})[0][0].reshape(-1)

    return embed


def recall(name, templ, embed_q, eval_imgs, eval_lbl):
    T = np.stack([_l2(t) for t in templ])
    r1 = r3 = 0
    for img, lbl in zip(eval_imgs, eval_lbl):
        q = _l2(embed_q(img))
        order = np.argsort(-(T @ q))
        if order[0] == lbl:
            r1 += 1
        if lbl in order[:3]:
            r3 += 1
    n = len(eval_imgs)
    print(f"  {name:24s} Recall@1 {r1/n*100:5.1f}%  @3 {r3/n*100:5.1f}%")
    return r1 / n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--marks", default="public/data/marks")
    ap.add_argument("--marks-json", default="public/data/marks.json")
    ap.add_argument("--models", default="출고=public/models/markembed.onnx,신규=ml/out/markembed.onnx",
                    help="비교할 모델들 'name=path' 콤마 구분(모두 224·3ch)")
    ap.add_argument("--eval-q", type=int, default=8)
    args = ap.parse_args()

    marks = list_marks(args.marks, args.marks_json)
    bases = [load_base(p) for _, _, p in marks]
    N = len(marks)

    embedders: list = [("HOG(현재 기본)", hog_feat)]
    for spec in args.models.split(","):
        spec = spec.strip()
        if "=" not in spec:
            continue
        nm, pth = (s.strip() for s in spec.split("=", 1))
        if os.path.exists(pth):
            embedders.append((nm, onnx_embedder(pth)))
        else:
            print("스킵(파일 없음):", spec)

    # 템플릿은 모델별로 1회만 임베딩(원본 마크)
    templates = {name: [emb(b) for b in bases] for name, emb in embedders}

    # 쉬운/어려운(v1) + 극악(v2 t=1.3, 학습에 안 쓴 강도 → 정직한 일반화 측정)
    levels = [
        ("쉬운", lambda b, r: augment(b, r, hard=False)),
        ("어려운", lambda b, r: augment(b, r, hard=True)),
        ("극악(미학습)", lambda b, r: augment2(b, r, t=1.3)),
    ]
    for lname, aug in levels:
        qrng = np.random.default_rng(777)
        eval_imgs, eval_lbl = [], []
        for ci, base in enumerate(bases):
            for _ in range(args.eval_q):
                eval_imgs.append(aug(base, qrng))
                eval_lbl.append(ci)
        print(f"\n=== {lname} 분포 · 마크 {N}종 · 쿼리 {len(eval_imgs)}장 (seed 777) ===")
        for name, emb in embedders:
            recall(name, templates[name], emb, eval_imgs, eval_lbl)


if __name__ == "__main__":
    main()
