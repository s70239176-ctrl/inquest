import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** Small count or marker shown after the label. */
  badge?: ReactNode;
}

/** Accessible tab list: roving tabindex, arrow keys, Home/End. The caller renders the matching panel. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  idPrefix,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === active);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b border-app-line [scrollbar-width:none]">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={on}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`!rounded-none !border-0 !border-b-2 !bg-transparent !px-4 !py-2.5 whitespace-nowrap text-[13.5px] !font-medium transition-colors ${
              on ? "!border-gold !text-app-text" : "!border-transparent !text-app-soft hover:!bg-transparent hover:!text-app-text"
            }`}
          >
            {t.label}
            {t.badge !== undefined && <span className="ml-2 rounded-full bg-app-raised px-1.5 py-0.5 font-mono text-[10.5px] text-app-soft">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const panelProps = (idPrefix: string, id: string) => ({
  role: "tabpanel" as const,
  id: `${idPrefix}-panel-${id}`,
  "aria-labelledby": `${idPrefix}-tab-${id}`,
  tabIndex: 0,
});
