import { useState } from 'react';
import { getQueryMode, setQueryMode } from '../api/client.js';

export default function QueryModeToggle() {
  const [mode, setMode] = useState(getQueryMode());

  function apply(next) {
    if (next === mode) return;
    setQueryMode(next);
    setMode(next);
    // Reload so every in-flight hook refetches under the new mode.
    window.location.reload();
  }

  return (
    <div
      className="query-toggle"
      role="group"
      aria-label="Query mode: pre-optimised or optimised"
      title="Toggle pre-optimised vs optimised SQL queries"
    >
      <button
        type="button"
        className={`query-toggle-btn${mode === 'old' ? ' active' : ''}`}
        onClick={() => apply('old')}
        aria-pressed={mode === 'old'}
      >
        standard
      </button>
      <button
        type="button"
        className={`query-toggle-btn${mode === 'new' ? ' active' : ''}`}
        onClick={() => apply('new')}
        aria-pressed={mode === 'new'}
      >
        optimized
      </button>
    </div>
  );
}
