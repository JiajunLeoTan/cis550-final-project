import { useState } from 'react';
import { getQueryMode, setQueryMode } from '../api/client.js';

export default function QueryModeToggle() {
  const [mode, setMode] = useState(getQueryMode());

  function apply(next) {
    if (next === mode) return;
    setQueryMode(next);
    setMode(next);
    // The mode changes every endpoint URL, so a reload gives each page a clean fetch.
    window.location.reload();
  }

  return (
    <div
      className="query-toggle"
      role="group"
      aria-label="Query mode: standard or optimized"
      title="Toggle standard vs optimized SQL queries"
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
