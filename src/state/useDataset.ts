import { useCallback, useEffect, useState } from 'react';
import { usesDataset } from '../api';
import { ensureDataset, getMeta, updateDataset, type DatasetMeta, type DatasetStatus } from '../api/dataset';

// 번들 낱알 데이터셋 상태(건수/생성일) + 수동 업데이트.
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
