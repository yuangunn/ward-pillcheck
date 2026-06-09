"""그려서찾기 cross-domain 임베딩 학습 (MobileNetV3-small).

합성 손그림(synth.augment)을 온더플라이로 생성해 분류 학습하고, 임베딩부를 ONNX 로 export.
선택적으로 앱에서 모은 진짜 손그림(#67 내보내기 JSON)을 --real 로 함께 학습한다.

⚠️ 이 저장소 CI/샌드박스에선 torch 미설치로 실행 검증되지 않았다. 로컬(GPU 권장)에서 실행.
    합성만으론 HOG 를 넘으리란 보장이 없다 — 실데이터를 충분히 모아 함께 쓰는 게 핵심.

사용 예: README.md 참고.
"""
from __future__ import annotations
import argparse
import base64
import glob
import io
import json
import os
from typing import List, Tuple

import numpy as np
from PIL import Image

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import torchvision

from synth import list_marks, load_base, augment, OUT

IMAGENET_MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
IMAGENET_STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)


def to_tensor(img_l: Image.Image) -> torch.Tensor:
    """'L'(흰배경 잉크) → 3ch ImageNet 정규화 텐서."""
    a = torch.from_numpy(np.asarray(img_l.convert("L"), dtype=np.float32) / 255.0)
    a = a.unsqueeze(0).repeat(3, 1, 1)  # 1ch → 3ch
    return (a - IMAGENET_MEAN) / IMAGENET_STD


class MarkDataset(Dataset):
    """온더플라이 합성 + 선택적 실데이터. 라벨 = 마크 클래스 index."""

    def __init__(self, marks: List[Tuple[str, str, str]], real: List[Tuple[Image.Image, int]],
                 per_class: int, seed: int = 0):
        self.bases = [load_base(p) for _, _, p in marks]
        self.codes = [c for _, c, _ in marks]
        self.per_class = per_class
        self.real = real
        self.n_synth = len(self.bases) * per_class
        self.seed = seed

    def __len__(self) -> int:
        return self.n_synth + len(self.real)

    def __getitem__(self, idx: int):
        if idx < self.n_synth:
            cls = idx % len(self.bases)
            rng = np.random.default_rng(self.seed * 1_000_003 + idx)
            img = augment(self.bases[cls], rng)
            return to_tensor(img), cls
        img, cls = self.real[idx - self.n_synth]
        return to_tensor(img.resize((OUT, OUT), Image.BILINEAR)), cls


class EmbedNet(nn.Module):
    """MobileNetV3-small → L2 정규화 임베딩. (export 대상)"""

    def __init__(self, emb_dim: int):
        super().__init__()
        m = torchvision.models.mobilenet_v3_small(weights=torchvision.models.MobileNet_V3_Small_Weights.DEFAULT)
        self.features = m.features
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.proj = nn.Linear(576, emb_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.pool(self.features(x)).flatten(1)
        x = self.proj(x)
        return nn.functional.normalize(x, dim=1)


def load_real(paths: List[str], imgid_to_cls: dict) -> List[Tuple[Image.Image, int]]:
    """#67 내보내기 JSON(들) → [(PIL 'L', clsIdx)]. 매핑 안 되는 마크는 건너뜀."""
    out: List[Tuple[Image.Image, int]] = []
    for pat in paths:
        for fp in glob.glob(pat):
            with open(fp, encoding="utf-8") as f:
                data = json.load(f)
            for s in data.get("samples", []):
                cls = imgid_to_cls.get(s.get("markImgId"))
                if cls is None:
                    continue
                b64 = s["png"].split(",", 1)[-1]
                img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("L")
                out.append((img, cls))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--marks", default="public/data/marks")
    ap.add_argument("--marks-json", default="public/data/marks.json")
    ap.add_argument("--real", nargs="*", default=[])
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--per-class", type=int, default=150)
    ap.add_argument("--emb-dim", type=int, default=256)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--out", default="ml/out")
    ap.add_argument("--workers", type=int, default=0, help="DataLoader workers (Windows 권장 0; 속도 필요시 4)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    marks = list_marks(args.marks, args.marks_json)
    imgid_to_cls = {m[0]: i for i, m in enumerate(marks)}
    real = load_real(args.real, imgid_to_cls) if args.real else []
    print(f"마크 {len(marks)}종 · 합성 {len(marks)*args.per_class} · 실데이터 {len(real)} · device={device}")

    ds = MarkDataset(marks, real, args.per_class)
    dl = DataLoader(ds, batch_size=args.batch, shuffle=True, num_workers=args.workers, drop_last=True)

    net = EmbedNet(args.emb_dim).to(device)
    head = nn.Linear(args.emb_dim, len(marks)).to(device)
    opt = torch.optim.AdamW(list(net.parameters()) + list(head.parameters()), lr=args.lr)
    lossf = nn.CrossEntropyLoss()

    for ep in range(args.epochs):
        net.train(); head.train()
        tot, correct, run = 0, 0, 0.0
        for x, y in dl:
            x, y = x.to(device), y.to(device)
            emb = net(x)
            logits = head(emb)
            loss = lossf(logits, y)
            opt.zero_grad(); loss.backward(); opt.step()
            run += loss.item() * x.size(0)
            correct += (logits.argmax(1) == y).sum().item(); tot += x.size(0)
        print(f"epoch {ep+1}/{args.epochs}  loss {run/tot:.3f}  acc {correct/tot:.3f}")

    # 임베딩부만 ONNX export (추론용)
    net.eval()
    dummy = torch.randn(1, 3, OUT, OUT, device=device)
    onnx_path = os.path.join(args.out, "markembed.onnx")
    torch.onnx.export(
        net, dummy, onnx_path, input_names=["input"], output_names=["embedding"],
        opset_version=17, dynamic_axes={"input": {0: "batch"}, "embedding": {0: "batch"}},
        dynamo=False,
    )
    with open(os.path.join(args.out, "classes.json"), "w", encoding="utf-8") as f:
        json.dump([{"imgId": m[0], "code": m[1]} for m in marks], f, ensure_ascii=False)
    print(f"저장: {onnx_path} (+ classes.json)")


if __name__ == "__main__":
    main()
