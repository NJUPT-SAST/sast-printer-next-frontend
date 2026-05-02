import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function Select({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayText = selectedOption?.label ?? placeholder ?? '';

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || focusedIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[focusedIndex] as HTMLElement | undefined;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [open, focusedIndex]);

  const openDropdown = () => {
    const idx = options.findIndex((opt) => opt.value === value && !opt.disabled);
    setFocusedIndex(idx >= 0 ? idx : options.findIndex((opt) => !opt.disabled));
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { openDropdown(); return; }
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (next < options.length && options[next].disabled) next++;
          return next < options.length ? next : prev;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) { openDropdown(); return; }
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && options[next].disabled) next--;
          return next >= 0 ? next : prev;
        });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) { openDropdown(); return; }
        if (focusedIndex >= 0 && !options[focusedIndex].disabled) {
          onChange(options[focusedIndex].value);
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Home':
        e.preventDefault();
        if (open) {
          const first = options.findIndex((opt) => !opt.disabled);
          if (first >= 0) setFocusedIndex(first);
        }
        break;
      case 'End':
        e.preventDefault();
        if (open) {
          let last = options.length - 1;
          while (last >= 0 && options[last].disabled) last--;
          if (last >= 0) setFocusedIndex(last);
        }
        break;
    }
  };

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) openDropdown();
          else setOpen(false);
        }}
        className={`flex items-center justify-between gap-2 border border-gray-300 bg-white
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
          transition-shadow disabled:opacity-50 disabled:cursor-not-allowed text-left
          ${className}`}
      >
        <span className={selectedOption ? 'truncate' : 'text-gray-400 truncate'}>
          {displayText || ' '}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200
            rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto animate-fade-in"
        >
          {options.length === 0 ? (
            <div className="px-4 py-2.5 text-sm text-gray-400">
              {placeholder || 'No options'}
            </div>
          ) : (
            options.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${
                    opt.value === value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : idx === focusedIndex
                        ? 'bg-gray-50 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                  }
                  ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
