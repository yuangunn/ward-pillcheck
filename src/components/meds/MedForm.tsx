import { useState } from 'react';
import { FREQUENCY_PRESETS } from '../../constants/frequency';
import { TIMING_PRESETS } from '../../constants/timing';
import { PresetField } from './PresetField';

/** 폼이 다루는 편집 가능 필드 */
export interface MedFormValue {
  name: string;
  tabletCount: number;
  frequency: string;
  timing: string;
  color: string;
  shape: string;
  marking: string;
}

interface Props {
  initial: MedFormValue;
  submitLabel: string;
  onSubmit: (value: MedFormValue) => void;
  onDelete?: () => void; // 편집 모드에서만
}

const FREQ_CODES = FREQUENCY_PRESETS.map((p) => p.code as string);
const FREQ_LABEL = new Map(FREQUENCY_PRESETS.map((p) => [p.code as string, p.label]));
const TIMING_CODES = TIMING_PRESETS.map((p) => p.code as string);

/** 정제수·용법·복용시점·외형 입력 공용 폼 (추가/편집 공용) */
export function MedForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const [v, setV] = useState<MedFormValue>(initial);
  const set = <K extends keyof MedFormValue>(k: K, val: MedFormValue[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const stepTablet = (delta: number) =>
    set('tabletCount', Math.max(0, Math.round((v.tabletCount + delta) * 2) / 2));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.name.trim() || v.tabletCount <= 0 || !v.frequency || !v.timing) return;
    onSubmit({ ...v, name: v.name.trim() });
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="med-name">품목명</label>
        <input
          id="med-name"
          className="input"
          value={v.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="예) 아스피린장용정100mg"
        />
      </div>

      <div className="field">
        <label>정제 수 (T)</label>
        <div className="stepper">
          <button type="button" onClick={() => stepTablet(-0.5)} aria-label="0.5정 감소">
            −
          </button>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={v.tabletCount}
            onChange={(e) => set('tabletCount', Number(e.target.value) || 0)}
          />
          <button type="button" onClick={() => stepTablet(0.5)} aria-label="0.5정 증가">
            +
          </button>
        </div>
      </div>

      <PresetField
        label="용법"
        presets={FREQ_CODES}
        labelOf={(c) => FREQ_LABEL.get(c) ?? c}
        value={v.frequency}
        onChange={(val) => set('frequency', val)}
        freeInputPlaceholder="직접입력 (예: 1일 5회)"
      />

      <PresetField
        label="복용시점"
        presets={TIMING_CODES}
        value={v.timing}
        onChange={(val) => set('timing', val)}
        freeInputPlaceholder="직접입력"
      />

      <div className="field">
        <label htmlFor="med-color">색 / 모양 / 각인 (수정 가능)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="med-color"
            className="input"
            style={{ flex: 1 }}
            value={v.color}
            onChange={(e) => set('color', e.target.value)}
            placeholder="색"
          />
          <input
            className="input"
            style={{ flex: 1 }}
            value={v.shape}
            onChange={(e) => set('shape', e.target.value)}
            placeholder="모양"
          />
        </div>
        <input
          className="input"
          style={{ marginTop: 8 }}
          value={v.marking}
          onChange={(e) => set('marking', e.target.value)}
          placeholder="각인"
        />
      </div>

      <div className="sheet-footer">
        {onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            삭제
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
