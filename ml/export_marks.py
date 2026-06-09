"""학습된 임베딩 ONNX 로 224개 마크의 임베딩을 추출 → embeddings.json (앱 투입용).

앱(src/api/markEmbed.ts)이 이 임베딩을 마크 DB 로 쓰고, 질의(그림)도 같은 모델로
임베딩해 코사인 랭킹한다. 전처리(224, ImageNet 정규화)는 train.py 와 동일해야 한다.

⚠️ onnxruntime 필요. 이 저장소 CI 에선 실행하지 않는다(로컬 실행).
"""
from __future__ import annotations
import argparse
import json
import numpy as np
from PIL import Image
import onnxruntime as ort

from synth import list_marks, load_base, OUT

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)


def tensor(img_l: Image.Image) -> np.ndarray:
    a = np.asarray(img_l.convert("L").resize((OUT, OUT), Image.BILINEAR), dtype=np.float32) / 255.0
    a = np.repeat(a[None, :, :], 3, axis=0)  # 3ch
    a = (a - MEAN) / STD
    return a[None].astype(np.float32)  # 1x3xHxW


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--onnx", default="ml/out/markembed.onnx")
    ap.add_argument("--marks", default="public/data/marks")
    ap.add_argument("--marks-json", default="public/data/marks.json")
    ap.add_argument("--out", default="ml/out/embeddings.json")
    args = ap.parse_args()

    sess = ort.InferenceSession(args.onnx, providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0].name
    marks = list_marks(args.marks, args.marks_json)
    out = []
    for imgId, code, path in marks:
        v = sess.run(None, {inp: tensor(load_base(path))})[0][0]
        v = v / (np.linalg.norm(v) or 1.0)
        out.append({"imgId": imgId, "code": code, "vec": [round(float(x), 5) for x in v]})
    dim = len(out[0]["vec"]) if out else 0
    # markEmbed.ts 로더가 기대하는 래핑 포맷 {img, emb, marks}. (run_experiment.py 와 동일)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"img": OUT, "emb": dim, "marks": out}, f, ensure_ascii=False)
    print(f"임베딩 {len(out)}종 × {dim}d → {args.out}")


if __name__ == "__main__":
    main()
