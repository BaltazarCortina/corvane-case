/** A small set of views of the same thing, one at a time. */
export function Tabs<K extends string>({
  tabs,
  selected,
  onSelect,
}: {
  tabs: { key: K; label: string }[];
  selected: K;
  onSelect: (key: K) => void;
}) {
  return (
    <div role="tablist" className="inline-flex rounded-md bg-hairline/60 p-0.5 text-sm">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === selected}
          onClick={() => onSelect(t.key)}
          className={`rounded px-3 py-1 ${t.key === selected ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-secondary hover:text-ink'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
