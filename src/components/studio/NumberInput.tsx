import { useEffect, useRef, useState } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  integer?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
}

function clampAndNormalize(
  n: number,
  min?: number,
  max?: number,
  integer?: boolean
): number {
  let out = integer ? Math.round(n) : n;
  if (min !== undefined && out < min) out = min;
  if (max !== undefined && out > max) out = max;
  return Object.is(out, -0) ? 0 : out;
}

/**
 * Controlled numeric input that lets users freely clear, backspace, or type
 * multi-digit / negative / decimal numbers without snapping to min/0 mid-typing.
 * Min/max clamping and integer rounding happen cleanly on blur or Enter.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  integer = false,
  disabled = false,
  className,
  placeholder,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const effectiveStep = step ?? (integer ? 1 : 'any');
  const safeVal = Number.isFinite(value) ? value : (min ?? 0);
  const [text, setText] = useState<string>(() => String(safeVal));
  const focusedRef = useRef(false);

  // Sync external value changes only when the user isn't actively editing
  useEffect(() => {
    if (!focusedRef.current) {
      setText(String(safeVal));
    }
  }, [safeVal]);

  const commitText = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
      const restored = clampAndNormalize(safeVal, min, max, integer);
      setText(String(restored));
      if (restored !== value) onChange(restored);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      const restored = clampAndNormalize(safeVal, min, max, integer);
      setText(String(restored));
      return;
    }
    const final = clampAndNormalize(parsed, min, max, integer);
    setText(String(final));
    if (final !== value) {
      onChange(final);
    }
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={effectiveStep}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // Preserve partial badInput like lone "-" in browsers that report "" with badInput=true
        if (raw === '' && e.target.validity?.badInput) {
          return;
        }
        setText(raw);
        if (raw.trim() === '') return;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        // Only emit immediately when within bounds so typing "1" before "16" (min=4) doesn't snap to 4
        const withinMin = min === undefined || parsed >= min;
        const withinMax = max === undefined || parsed <= max;
        if (withinMin && withinMax) {
          const next = integer ? Math.round(parsed) : parsed;
          if (next !== value) {
            onChange(next);
          }
        }
      }}
      onBlur={() => {
        focusedRef.current = false;
        commitText(text);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commitText(text);
        }
      }}
      className={className}
    />
  );
}
