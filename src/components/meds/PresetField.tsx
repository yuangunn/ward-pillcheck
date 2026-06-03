import { Chip } from '../ui/Chip';

interface Props {
  label: string;
  /** 프리셋 코드 목록 */
  presets: string[];
  /** 프리셋별 표시 라벨(없으면 코드 그대로) */
  labelOf?: (code: string) => string;
  value: string;
  onChange: (value: string) => void;
  freeInputPlaceholder: string;
}

/**
 * 프리셋 칩 + 직접입력 공용 필드 (용법/복용시점).
 * 프리셋에 없는 값은 직접입력 칸에 들어가고, 칩은 선택 해제 상태.
 */
export function PresetField({
  label,
  presets,
  labelOf,
  value,
  onChange,
  freeInputPlaceholder,
}: Props) {
  const isPreset = presets.includes(value);

  return (
    <div className="field">
      <label>{label}</label>
      <div className="preset-row">
        {presets.map((code) => (
          <Chip key={code} selected={value === code} onToggle={() => onChange(code)}>
            {labelOf ? labelOf(code) : code}
          </Chip>
        ))}
      </div>
      <input
        className="input"
        value={isPreset ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={freeInputPlaceholder}
        autoComplete="off"
        aria-label={`${label} 직접입력`}
      />
    </div>
  );
}
