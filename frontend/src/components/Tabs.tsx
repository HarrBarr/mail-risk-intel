import { useRef, type KeyboardEvent, type ReactNode } from "react";

interface TabsProps<T extends string> {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  idPrefix: string;
  label: string;
  /** The panel for the active tab. */
  children: ReactNode;
}

/** WAI-ARIA tabs with roving tabindex and arrow/Home/End keys. */
export function Tabs<T extends string>({ tabs, value, onChange, idPrefix, label, children }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === value);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === -1) return;
    event.preventDefault();
    onChange(tabs[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-slate-200 px-5"
      >
        {tabs.map((tab, i) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${value}`}>
        {children}
      </div>
    </div>
  );
}
