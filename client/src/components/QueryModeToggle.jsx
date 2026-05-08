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
        className={`query-toggle-btn${mode === 'standard' ? ' active' : ''}`}
        onClick={() => apply('standard')}
        aria-pressed={mode === 'standard'}
      >
        standard
      </button>
      <button
        type="button"
        className={`query-toggle-btn${mode === 'optimized' ? ' active' : ''}`}
        onClick={() => apply('optimized')}
        aria-pressed={mode === 'optimized'}
      >
        optimized
      </button>
    </div>
  );
}
