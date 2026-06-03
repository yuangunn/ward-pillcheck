import { useState } from 'react';
import type { PillSearchQuery } from '../../api';

interface Props {
  onSearch: (q: PillSearchQuery) => void;
}

/** 이름 검색: 품목명 입력 */
export function NameSearch({ onSearch }: Props) {
  const [itemName, setItemName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = itemName.trim();
    if (name) onSearch({ itemName: name });
  };

  return (
    <form className="search-panel" onSubmit={submit}>
      <div className="field">
        <label htmlFor="name-q">품목명</label>
        <input
          id="name-q"
          className="input"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="예) 아스피린, 노바스크"
          enterKeyHint="search"
          autoComplete="off"
        />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={!itemName.trim()}>
        검색
      </button>
    </form>
  );
}
