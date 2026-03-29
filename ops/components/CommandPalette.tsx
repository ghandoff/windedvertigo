'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from 'react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon?: ReactNode;
  shortcut?: string;
  href?: string;
}

interface CommandPaletteProps {
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
}

/* ------------------------------------------------------------------ */
/*  Context / Hook                                                     */
/* ------------------------------------------------------------------ */

const CommandPaletteContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommandPalette({ items, onSelect }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ---------- keyboard shortcut to toggle ---------- */
  useEffect(() => {
    function handleGlobal(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobal);
    return () => window.removeEventListener('keydown', handleGlobal);
  }, []);

  /* ---------- reset on open ---------- */
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // wait a tick for the DOM to mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* ---------- filtered + grouped items ---------- */
  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [filtered]);

  // flat list for keyboard nav
  const flatList = useMemo(() => {
    const result: CommandItem[] = [];
    for (const arr of grouped.values()) {
      result.push(...arr);
    }
    return result;
  }, [grouped]);

  /* ---------- clamp selected index when results change ---------- */
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(flatList.length - 1, 0)));
  }, [flatList.length]);

  /* ---------- scroll selected item into view ---------- */
  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  /* ---------- select handler ---------- */
  const handleSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      onSelect(item);
    },
    [onSelect],
  );

  /* ---------- keyboard nav inside modal ---------- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatList.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatList.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (flatList[selectedIndex]) {
            handleSelect(flatList[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [flatList, selectedIndex, handleSelect],
  );

  /* ---------- focus trap ---------- */
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function trapFocus(e: FocusEvent) {
      if (
        modalRef.current &&
        e.target instanceof Node &&
        !modalRef.current.contains(e.target)
      ) {
        e.stopPropagation();
        inputRef.current?.focus();
      }
    }

    document.addEventListener('focus', trapFocus, true);
    return () => document.removeEventListener('focus', trapFocus, true);
  }, [open]);

  /* ---------- render ---------- */
  if (!open) return null;

  let runningIndex = -1;

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[20vh]"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-label="Command palette"
        className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] pointer-events-none"
        onKeyDown={handleKeyDown}
      >
        <div
          className="pointer-events-auto w-full max-w-lg rounded-xl border overflow-hidden shadow-2xl"
          style={{
            backgroundColor: '#111920',
            borderColor: '#1e2a38',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* search input */}
          <div
            className="px-4 py-3"
            style={{ borderBottom: '1px solid #1e2a38' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search commands..."
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: '#d4d4d8' }}
              aria-label="Search commands"
              autoComplete="off"
            />
          </div>

          {/* results */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Command results"
            className="max-h-[320px] overflow-y-auto py-2"
          >
            {flatList.length === 0 && (
              <div
                className="px-4 py-6 text-center text-sm"
                style={{ color: '#71717a' }}
              >
                No results found.
              </div>
            )}

            {Array.from(grouped.entries()).map(([category, categoryItems]) => (
              <div key={category}>
                {/* category header */}
                <div
                  className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide select-none"
                  style={{ color: '#71717a' }}
                >
                  {category}
                </div>

                {categoryItems.map((item) => {
                  runningIndex += 1;
                  const isSelected = runningIndex === selectedIndex;
                  const idx = runningIndex; // capture for click

                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      className="flex items-center gap-3 px-4 py-2 cursor-pointer text-sm transition-colors"
                      style={{
                        color: '#d4d4d8',
                        backgroundColor: isSelected
                          ? 'rgba(255,255,255,0.05)'
                          : 'transparent',
                      }}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center" style={{ color: '#71717a' }}>
                          {item.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut && (
                        <span
                          className="flex-shrink-0 text-xs"
                          style={{ color: '#71717a' }}
                        >
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </CommandPaletteContext.Provider>
  );
}
