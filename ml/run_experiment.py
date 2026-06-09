"""실제 마크 기준 공정 실험: HOG vs SqueezeNet(미학습) vs 학습 CNN.

같은 합성 손그림 쿼리(synth.augment, 실제 마크에서 생성)로 세 방식의 Recall@1/@3 를 잰다.
- HOG: marksim.ts 디스크립터의 numpy 포팅(intensity24 + coarse8 + HOG4x4x8, 블록 L2+가중).
- SqueezeNet: 미학습 ImageNet(임베딩=1000-d 출력) — 비교 기준선.
- 학습 CNN: 작은 임베딩 CNN 을 합성 손그림으로 분류 학습(백본 적응) → 임베딩.
끝나면 학습 모델을 ONNX + embeddings.json 으로 export.

CPU 전용. 가볍게 끝나도록 96px·작은 CNN·소수 epoch. 정직한 수치 출력이 목적.
"""
from __future__ import annotations
import argparse, json, os, time, urllib.request
import numpy as np
from PIL import Image, ImageFilter
import torch, torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from synth import list_marks, load_base, augment  # 검증된 증강 사용

# ── HOG 포팅 (marksim.ts extractFeature 와 동일 알고리즘) ──
GRID, COARSE, HCELL, HBIN = 24, 8, 4, 8
INK_BBOX, BLUR_R = 0.12, 2
W_INT, W_CO, W_HOG = 1.0, 0.6, 0.9

def _ink(arr):  # arr: HxW 'L' uint8 → ink 0..1 (어두울수록 1)
    return 1.0 - arr.astype(np.float32) / 255.0

def _intensity_grid(ink):
    ys, xs = np.where(ink > INK_BBOX)
    if len(xs) == 0:
        return None
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    side = max(bw, bh)
    ox, oy = x0 - (side - bw) / 2, y0 - (side - bh) / 2
    H, W = ink.shape
    out = np.zeros((GRID, GRID), np.float32)
    for gy in range(GRID):
        for gx in range(GRID):
            sx0, sx1 = ox + gx / GRID * side, ox + (gx + 1) / GRID * side
            sy0, sy1 = oy + gy / GRID * side, oy + (gy + 1) / GRID * side
            ix0, ix1 = int(np.floor(sx0)), int(np.ceil(sx1))
            iy0, iy1 = int(np.floor(sy0)), int(np.ceil(sy1))
            cx0, cy0 = max(0, ix0), max(0, iy0)
            cx1, cy1 = min(W, ix1), min(H, iy1)
            n = (ix1 - ix0) * (iy1 - iy0)
            s = ink[cy0:cy1, cx0:cx1].sum() if (cx1 > cx0 and cy1 > cy0) else 0.0
            out[gy, gx] = s / n if n else 0.0
    return out

def _box_blur(g, r):
    if r <= 0:
        return g
    k = 2 * r + 1
    pad = np.pad(g, r, mode="edge")
    h = np.zeros_like(g)
    for i in range(g.shape[0]):
        for j in range(g.shape[1]):
            h[i, j] = pad[i + r, j:j + k].mean()
    pad2 = np.pad(h, r, mode="edge")
    o = np.zeros_like(g)
    for i in range(g.shape[0]):
        for j in range(g.shape[1]):
            o[i, j] = pad2[i:i + k, j + r].mean()
    return o

def _coarse(fine):
    b = GRID // COARSE
    return fine.reshape(COARSE, b, COARSE, b).mean(axis=(1, 3))

def _hog(fine):
    out = np.zeros((HCELL, HCELL, HBIN), np.float32)
    cell = GRID / HCELL
    gx = np.zeros_like(fine); gy = np.zeros_like(fine)
    gx[:, 1:-1] = fine[:, 2:] - fine[:, :-2]
    gy[1:-1, :] = fine[2:, :] - fine[:-2, :]
    mag = np.hypot(gx, gy); ang = np.arctan2(gy, gx)
    ang[ang < 0] += np.pi
    for y in range(GRID):
        for x in range(GRID):
            if mag[y, x] < 1e-6:
                continue
            b = min(HBIN - 1, int(ang[y, x] / np.pi * HBIN))
            cy, cx = min(HCELL - 1, int(y / cell)), min(HCELL - 1, int(x / cell))
            out[cy, cx, b] += mag[y, x]
    return out.reshape(-1)

def _l2(v):
    n = np.linalg.norm(v)
    return v / n if n else v

def hog_feat(img_l: Image.Image) -> np.ndarray:
    ink = _ink(np.asarray(img_l.convert("L")))
    fine = _intensity_grid(ink)
    if fine is None:
        return np.zeros(GRID*GRID + COARSE*COARSE + HCELL*HCELL*HBIN, np.float32)
    fine = _box_blur(fine, BLUR_R)
    f = _l2(fine.reshape(-1)) * W_INT
    c = _l2(_coarse(fine).reshape(-1)) * W_CO
    h = _l2(_hog(fine)) * W_HOG
    return np.concatenate([f, c, h]).astype(np.float32)

def cos(a, b):
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) or 1.0))

# ── 작은 임베딩 CNN ──
class TinyNet(nn.Module):
    def __init__(self, emb=128):
        super().__init__()
        def blk(i, o):
            return nn.Sequential(nn.Conv2d(i, o, 3, 2, 1), nn.BatchNorm2d(o), nn.ReLU(inplace=True))
        self.body = nn.Sequential(blk(1, 24), blk(24, 48), blk(48, 96), blk(96, 128))
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.proj = nn.Linear(128, emb)
    def forward(self, x):
        x = self.pool(self.body(x)).flatten(1)
        return nn.functional.normalize(self.proj(x), dim=1)

def to_gray_tensor(img_l: Image.Image, size: int):
    a = np.asarray(img_l.convert("L").resize((size, size), Image.BILINEAR), np.float32) / 255.0
    return torch.from_numpy(a)[None]  # 1xHxW (잉크=어두움 그대로; 1채널)

class SynthDS(Dataset):
    def __init__(self, bases, per_class, img, seed=0):
        self.bases, self.per, self.img, self.seed = bases, per_class, img, seed
    def __len__(self):
        return len(self.bases) * self.per
    def __getitem__(self, i):
        cls = i % len(self.bases)
        rng = np.random.default_rng(self.seed * 1_000_003 + i)
        return to_gray_tensor(augment(self.bases[cls], rng), self.img), cls


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--marks", default="public/data/marks")
    ap.add_argument("--marks-json", default="public/data/marks.json")
    ap.add_argument("--img", type=int, default=96)
    ap.add_argument("--per-class", type=int, default=36)
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--batch", type=int, default=128)
    ap.add_argument("--emb", type=int, default=128)
    ap.add_argument("--eval-q", type=int, default=6)
    ap.add_argument("--out", default="ml/out")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    torch.manual_seed(0)

    marks = list_marks(args.marks, args.marks_json)
    bases = [load_base(p) for _, _, p in marks]
    codes = [c for _, c, _ in marks]
    ids = [i for i, _, _ in marks]
    N = len(marks)
    print(f"마크 {N}종 · img {args.img} · per-class {args.per_class} · epochs {args.epochs}")

    # 평가용 쿼리(학습과 다른 시드) 미리 생성: 클래스별 eval_q 장
    qrng = np.random.default_rng(777)
    eval_imgs, eval_lbl = [], []
    for ci, base in enumerate(bases):
        for _ in range(args.eval_q):
            eval_imgs.append(augment(base, qrng)); eval_lbl.append(ci)
    print(f"평가 쿼리 {len(eval_imgs)}장")

    def recall(name, templ, embed_q):
        T = np.stack([_l2(t) for t in templ])
        r1 = r3 = 0
        for img, lbl in zip(eval_imgs, eval_lbl):
            q = _l2(embed_q(img))
            sims = T @ q
            order = np.argsort(-sims)
            if order[0] == lbl: r1 += 1
            if lbl in order[:3]: r3 += 1
        n = len(eval_imgs)
        print(f"  {name:22s} Recall@1 {r1/n*100:5.1f}%  @3 {r3/n*100:5.1f}%")
        return r1 / n

    # ── 1) HOG (numpy 포팅) ──
    t0 = time.time()
    hog_templ = [hog_feat(b) for b in bases]
    recall("HOG(현재 방식)", hog_templ, lambda im: hog_feat(im))
    print(f"  (HOG eval {time.time()-t0:.0f}s)")

    # ── 2) SqueezeNet 미학습 ──
    try:
        import onnxruntime as ort
        mp = "/tmp/onnx/squeezenet.onnx"
        if not os.path.exists(mp):
            os.makedirs("/tmp/onnx", exist_ok=True)
            urllib.request.urlretrieve(
                "https://media.githubusercontent.com/media/onnx/models/main/validated/vision/classification/squeezenet/model/squeezenet1.0-7.onnx", mp)
        sess = ort.InferenceSession(mp, providers=["CPUExecutionProvider"])
        inn = sess.get_inputs()[0].name
        MEAN = np.array([0.485, 0.456, 0.406], np.float32).reshape(3, 1, 1)
        STD = np.array([0.229, 0.224, 0.225], np.float32).reshape(3, 1, 1)
        def sq_embed(im):
            a = np.asarray(im.convert("L").resize((224, 224), Image.BILINEAR), np.float32) / 255.0
            a = np.repeat(a[None], 3, 0); a = (a - MEAN) / STD
            return sess.run(None, {inn: a[None].astype(np.float32)})[0][0].reshape(-1)
        recall("SqueezeNet(미학습)", [sq_embed(b) for b in bases], sq_embed)
    except Exception as e:
        print("  SqueezeNet 스킵:", e)

    # ── 3) 학습 CNN ──
    dev = "cpu"
    net = TinyNet(args.emb).to(dev)
    head = nn.Linear(args.emb, N).to(dev)
    opt = torch.optim.AdamW(list(net.parameters()) + list(head.parameters()), lr=1e-3)
    lossf = nn.CrossEntropyLoss()
    dl = DataLoader(SynthDS(bases, args.per_class, args.img), batch_size=args.batch,
                    shuffle=True, num_workers=4, drop_last=True)
    for ep in range(args.epochs):
        net.train(); head.train(); t0 = time.time(); run = cor = tot = 0
        for x, y in dl:
            emb = net(x); logit = head(emb); loss = lossf(logit, y)
            opt.zero_grad(); loss.backward(); opt.step()
            run += loss.item() * x.size(0); cor += (logit.argmax(1) == y).sum().item(); tot += x.size(0)
        print(f"  ep{ep+1}/{args.epochs} loss {run/tot:.3f} acc {cor/tot:.3f} ({time.time()-t0:.0f}s)")
    net.eval()
    with torch.no_grad():
        def tn_embed(im):
            return net(to_gray_tensor(im, args.img)[None]).numpy()[0]
        recall("학습 CNN(합성)", [tn_embed(b) for b in bases], tn_embed)
        # export ONNX + embeddings.json
        dummy = torch.randn(1, 1, args.img, args.img)
        onnx_p = os.path.join(args.out, "markembed.onnx")
        torch.onnx.export(net, dummy, onnx_p, input_names=["input"], output_names=["embedding"], opset_version=17)
        embs = [{"imgId": ids[i], "code": codes[i], "vec": [round(float(x), 5) for x in _l2(tn_embed(bases[i]))]} for i in range(N)]
        with open(os.path.join(args.out, "embeddings.json"), "w", encoding="utf-8") as f:
            json.dump({"img": args.img, "emb": args.emb, "marks": embs}, f, ensure_ascii=False)
    sz = os.path.getsize(onnx_p) / 1024
    print(f"export: {onnx_p} ({sz:.0f} KB) + embeddings.json ({N}종)")


if __name__ == "__main__":
    main()
