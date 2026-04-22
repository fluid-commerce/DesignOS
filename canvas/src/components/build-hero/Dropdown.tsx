import { useRef, useEffect, useState } from 'react';
import {
  BG_CARD,
  BG_SECONDARY,
  BORDER,
  BORDER_HOVER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../tokens';
import { ChevronDownIcon } from './Icons';

export interface DropdownOption {
  id: string;
  label: string;
  sublabel?: string;
  dimensions?: string;
}

interface DropdownProps {
  /** Currently selected option id */
  value: string;
  options: readonly DropdownOption[];
  /** Called when user picks an option */
  onChange: (id: string) => void;
  /** Button title for accessibility */
  title?: string;
  /** Minimum dropdown width */
  minWidth?: number;
  /** Optional leading icon in the trigger button */
  icon?: React.ReactNode;
  /** Display text override — if not set, uses selected option label */
  displayText?: string;
}

export function Dropdown({
  value,
  options,
  onChange,
  title,
  minWidth = 160,
  icon,
  displayText,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const label = displayText ?? selected?.dimensions ?? selected?.label ?? 'Select';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: open ? BORDER_HOVER : BG_SECONDARY,
          border: `1px solid ${open ? BORDER_HOVER : BORDER}`,
          borderRadius: 5,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: TEXT_PRIMARY,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.backgroundColor = BORDER_HOVER;
            e.currentTarget.style.borderColor = BORDER_HOVER;
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.backgroundColor = BG_SECONDARY;
            e.currentTarget.style.borderColor = BORDER;
          }
        }}
      >
        {icon}
        <span>{label}</span>
        <ChevronDownIcon size={14} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 4,
            minWidth,
            maxHeight: 320,
            overflowY: 'auto',
            background: BG_CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 1000,
          }}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.id === value;
            const isLast = idx === options.length - 1;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  background: isSelected ? BORDER_HOVER : 'transparent',
                  border: 'none',
                  ...(isLast ? {} : { borderBottom: `1px solid ${BORDER}` }),
                  color: TEXT_PRIMARY,
                  fontSize: '0.875rem',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = BG_SECONDARY;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ display: 'block' }}>{opt.dimensions ?? opt.label}</span>
                {opt.sublabel && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      color: TEXT_SECONDARY,
                      marginTop: 2,
                    }}
                  >
                    {opt.sublabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
