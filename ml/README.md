# 그려서찾기 인식기 학습 파이프라인 (실험)

알약 마크를 "손으로 그린 스케치"와 매칭하는 **cross-domain 임베딩 모델**을 학습하기 위한
오프라인 파이프라인입니다. 학습 결과(ONNX + 임베딩)를 웹앱의 ONNX 토글에 끼워 넣습니다.

> ⚠️ 솔직히: 자체 합성 벤치에서 **현재 HOG(`src/api/marksim.ts`)가 기본으론 더 정확**합니다.
> 이 파이프라인이 HOG를 실제로 넘으려면 **진짜 손그림 데이터**가 필요합니다 — 앱의
> *설정 → 실험 기능 → 그림 데이터 수집*(옵트인)으로 모아 `--real` 로 투입하세요.
> 합성 데이터만으로는 도메인 갭이 남아 향상이 보장되지 않습니다.

## 구성
- `synth.py` — 마크 이미지 → "가짜 손그림" 증강(아핀·탄성왜곡·획굵기·획누락·노이즈). PIL/numpy만 사용.
- `train.py` — MobileNetV3-small 백본 → 임베딩(L2) + 분류헤드로 학습, 임베딩부를 ONNX export. torch 필요.
- `export_marks.py` — 학습 모델로 224개 마크 임베딩을 `embeddings.json` 으로 추출(앱 투입용).
- `requirements.txt` — 의존성.

## 사용
```bash
pip install -r ml/requirements.txt

# 1) (선택) 합성 미리보기 — 잘 만들어지는지 눈으로 확인
python ml/synth.py --preview ml/_preview --per-class 8

# 2) 학습 (합성 온더플라이 + 선택적으로 수집한 진짜 데이터)
python ml/train.py --marks public/data/marks --marks-json public/data/marks.json \
  --real ~/Downloads/ward-pillcheck-draw-samples-*.json \
  --epochs 30 --emb-dim 256 --out ml/out

# 3) 마크 임베딩 추출 → 앱에 넣을 JSON
python ml/export_marks.py --onnx ml/out/markembed.onnx \
  --marks public/data/marks --marks-json public/data/marks.json --out ml/out/embeddings.json
```

## 앱에 끼우기
1. `ml/out/markembed.onnx` 를 호스팅(또는 `public/`에 두고 lazy fetch) → `src/api/markEmbed.ts` 의 `MODEL_URL` 교체.
2. 전처리(입력 크기/정규화)를 학습과 동일하게 맞추기(현재 224, ImageNet 정규화).
3. `embeddings.json` 을 마크 임베딩 캐시로 사용(또는 첫 사용 시 클라이언트에서 재계산).
4. 같은 합성 벤치(`src/api/dollar.test.ts` 방식)와 **실제 마크로 A/B** 해서 HOG를 이기는지 확인 후 채택.

## 용량(참고)
- 합성 데이터: **온더플라이면 0**(원본 마크 2.6MB만). 디스크 저장 시 ~90~220MB.
- 학습 체크포인트(개발 PC): ~25~35MB(일시적).
- **앱 추가분: ONNX 모델 ~1~5MB(int8/fp16) + 임베딩 ~0.1~0.5MB.** lazy 로드면 기본 번들 0.

## 로컬 GPU 학습 (RTX 50시리즈 / Blackwell)
> ⚠️ RTX 5070 Ti 등 50시리즈(sm_120)는 **CUDA 12.8 빌드 torch** 필요. 기본 휠은 "no kernel image" 에러.

```bash
# 1) torch (Blackwell = cu128). 나머지는 PyPI.
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
pip install onnx onnxruntime onnxscript pillow numpy
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"  # True, RTX 5070 Ti

# 2) 공정 비교(작은 CNN, 빠름) — HOG 대비 신호 확인
python ml/run_experiment.py --img 96 --per-class 48 --epochs 30

# 3) 본격 학습(MobileNetV3, 224px) — GPU
python ml/train.py --epochs 50 --per-class 200 --emb-dim 256 --batch 128 \
  --real <수집한-ward-pillcheck-draw-samples-*.json>   # 실데이터 있으면
python ml/export_marks.py   # → ml/out/embeddings.json
# Windows 에서 DataLoader 문제 시 train.py num_workers=0
```
산출물(`ml/out/markembed.onnx`, `embeddings.json`)을 `public/`에 두고 `src/api/markEmbed.ts` 의
`MODEL_URL`·입력크기·임베딩을 맞추면 same-origin 으로 로드(오프라인 OK).
