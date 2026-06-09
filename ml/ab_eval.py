"""실제 마크 기준 A/B 공정 비교: HOG vs 출고 TinyNet(96·1ch) vs 신규 MobileNetV3(224·3ch).

동일한 held-out 합성 손그림 쿼리(synth.augment, seed 777)로 세 방식의 Recall@1/@3 를 잰다.
각 ONNX 모델은 자기 전처리(입력 크기/채널/정규화)로 임베딩하고, 코사인 최근접 템플릿으로 랭킹.

⚠️ 평가 쿼리가 학습과 같은 augment 분포라 학습 모델에 유리(상한 과대평가). 진짜 우열은
   실제 손그림(설정 '그림 데이터 수집' 옵트인 수집분)으로 재평가해야 정직하다.
"""
from __future__ import annotations
import argparse
import os
import numpy as np
from PIL import Image
import onnxruntime as ort

from synth import list_marks, load_base, augment
from run_experiment import hog_feat, _l2  # 검증된 HOG numpy 포팅 재사용

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], np.float32).reshape(3, 1, 1)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], np.float32).reshape(3, 1, 1)


def onnx_embedder(path: str, size: int, channels: int):
    """ONNX 임베딩 함수. channels=1 → raw L/255(1ch); 3 → ImageNet 정규화(3ch)."""
    sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0].name

    def embed(img_l: Image.Image) -> np.ndarray:
        a = np.asarray(img_l.convert("L").resize((size, size), Image.BILINEAR), np.float32) / 255.0
        if channels == 1:
            x = a[None, None]  # 1x1xHxW
        else:
            a3 = np.repeat(a[None], 3, 0)
            a3 = (a3 - IMAGENET_MEAN) / IMAGENET_STD
            x = a3[None]  # 1x3xHxW
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
    print(f"  {name:30s} Recall@1 {r1/n*100:5.1f}%  @3 {r3/n*100:5.1f}%")
    return r1 / n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--marks", default="public/data/marks")
    ap.add_argument("--marks-json", default="public/data/marks.json")
    ap.add_argument("--tiny", default="public/models/markembed.onnx", help="출고 TinyNet 96·1ch")
    ap.add_argument("--mnet", default="ml/out/markembed.onnx", help="신규 MobileNetV3 224·3ch")
    ap.add_argument("--eval-q", type=int, default=10)
    args = ap.parse_args()

    marks = list_marks(args.marks, args.marks_json)
    bases = [load_base(p) for _, _, p in marks]
    N = len(marks)
    qrng = np.random.default_rng(777)
    eval_imgs, eval_lbl = [], []
    for ci, base in enumerate(bases):
        for _ in range(args.eval_q):
            eval_imgs.append(augment(base, qrng))
            eval_lbl.append(ci)
    print(f"마크 {N}종 · 평가쿼리 {len(eval_imgs)}장 (held-out 합성, seed 777)")

    recall("HOG(현재 기본)", [hog_feat(b) for b in bases], hog_feat, eval_imgs, eval_lbl)
    if os.path.exists(args.tiny):
        e = onnx_embedder(args.tiny, 96, 1)
        recall("TinyNet 96·1ch(출고)", [e(b) for b in bases], e, eval_imgs, eval_lbl)
    else:
        print("  TinyNet 스킵(파일 없음):", args.tiny)
    if os.path.exists(args.mnet):
        e = onnx_embedder(args.mnet, 224, 3)
        recall("MobileNetV3 224·3ch(신규)", [e(b) for b in bases], e, eval_imgs, eval_lbl)
    else:
        print("  MobileNetV3 스킵(파일 없음):", args.mnet)


if __name__ == "__main__":
    main()
