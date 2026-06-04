import { useCallback, useEffect, useState } from 'react';
import { usesDataset } from '../api';
import {
  ensureDataset,
  getMeta,
  updateDataset,
  type DatasetMeta,
  type DatasetStatus,
} from '../api/dataset';

// 번들 데이터셋 로딩/업데이트 상태를 컴포넌트에 노출.
// 앱 진입 시 자동 로드(최신이면 캐시 사용, 새 버전이면 자동 다운로드).

export function useDataset() {
  const [status, setStatus] = useState<DatasetStatus>(usesDataset ? 'loading' : 'idle');
  const [meta, setMeta] = useState<DatasetMeta | null>(null);

  useEffect(() => {
    if (!usesDataset) return;
    let alive = true;
    ensureDataset().then((s) => {
      if (!alive) return;
      setStatus(s);
      setMeta(getMeta());
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback(async () => {
    setStatus('loading');
    const s = await updateDataset();
    setStatus(s);
    setMeta(getMeta());
    return s;
  }, []);

  return { enabled: usesDataset, status, meta, update };
}
