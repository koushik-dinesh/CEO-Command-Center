import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import {
  countDigitsBeforeCursor,
  cursorAfterFormattedDigit,
  formatIndianIntegerDigits,
  mergeDigitsAtSelection,
  sanitizeIntegerDigits,
} from '../../utils/currencyInput';

const NAVIGATION_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

interface IndianRupeeIntegerInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

export default function IndianRupeeIntegerInput({
  value,
  onChange,
  className = '',
  inputClassName = '',
  placeholder = '10,00,000',
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: IndianRupeeIntegerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(() => (
    value === null ? '' : formatIndianIntegerDigits(String(Math.trunc(value)))
  ));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused) return;
    setDisplay(value === null ? '' : formatIndianIntegerDigits(String(Math.trunc(value))));
  }, [value, isFocused]);

  const applyDigits = useCallback((digits: string, cursorDigitIndex: number) => {
    const formatted = formatIndianIntegerDigits(digits);
    setDisplay(formatted);
    onChange(digits === '' ? null : Number(digits));

    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      const nextCursor = cursorAfterFormattedDigit(formatted, cursorDigitIndex);
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }, [onChange]);

  const onInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const rawValue = input.value;
    const selectionStart = input.selectionStart ?? 0;
    const digits = sanitizeIntegerDigits(rawValue);
    const digitIndex = countDigitsBeforeCursor(rawValue, selectionStart);
    applyDigits(digits, digitIndex);
  }, [applyDigits]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (NAVIGATION_KEYS.has(event.key)) {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const input = event.currentTarget;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        if (start !== end) return;

        const digits = sanitizeIntegerDigits(display);
        const digitIndex = countDigitsBeforeCursor(display, start);

        if (event.key === 'Backspace' && digitIndex > 0) {
          if (start > 0 && display[start - 1] === ',') {
            event.preventDefault();
            const nextDigits = digits.slice(0, digitIndex - 1) + digits.slice(digitIndex);
            applyDigits(nextDigits, digitIndex - 1);
          }
          return;
        }

        if (event.key === 'Delete' && digitIndex < digits.length) {
          if (display[start] === ',') {
            event.preventDefault();
            const nextDigits = digits.slice(0, digitIndex) + digits.slice(digitIndex + 1);
            applyDigits(nextDigits, digitIndex);
          }
        }
      }
      return;
    }

    if (/^\d$/.test(event.key)) return;
    event.preventDefault();
  }, [applyDigits, display]);

  const onPaste = useCallback((event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const input = event.currentTarget;
    const pasted = sanitizeIntegerDigits(event.clipboardData.getData('text'));
    const currentDigits = sanitizeIntegerDigits(display);
    const { digits, cursorDigitIndex } = mergeDigitsAtSelection(
      currentDigits,
      input.selectionStart ?? 0,
      input.selectionEnd ?? 0,
      display,
      pasted,
    );
    applyDigits(digits, cursorDigitIndex);
  }, [applyDigits, display]);

  const onFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const onBlur = useCallback(() => {
    setIsFocused(false);
    setDisplay(value === null ? '' : formatIndianIntegerDigits(String(Math.trunc(value))));
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <span
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted-theme"
        aria-hidden
      >
        ₹
      </span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        className={inputClassName}
        value={display}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
