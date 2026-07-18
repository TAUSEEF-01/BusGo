import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search, X } from "lucide-react";
import { cityKey, citySearchText, mergeCityOptions } from "../data/cityOptions";

interface CityComboboxProps {
  value: string;
  onChange: (city: string) => void;
  options: string[];
  placeholder?: string;
  excludedCities?: string[];
  disabled?: boolean;
  required?: boolean;
  id?: string;
  ariaLabel?: string;
}

export function CityCombobox({
  value,
  onChange,
  options,
  placeholder = "Select a city",
  excludedCities = [],
  disabled = false,
  required = false,
  id,
  ariaLabel,
}: CityComboboxProps) {
  const generatedId = useId();
  const inputId = id || `city-${generatedId.replace(/:/g, "")}`;
  const listId = `${inputId}-options`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [value]);

  const excluded = useMemo(
    () => new Set(excludedCities.filter(Boolean).map(cityKey)),
    [excludedCities],
  );

  const filtered = useMemo(() => {
    // Opening an already-selected field should reveal the full dropdown. Once
    // the operator types, the same input becomes the search query.
    const term = query === value ? "" : query.trim().toLocaleLowerCase();
    return mergeCityOptions(value ? [value] : [], options)
      .filter((city) => cityKey(city) === cityKey(value) || !excluded.has(cityKey(city)))
      .filter((city) => !term || citySearchText(city).includes(term))
      .slice(0, 60);
  }, [excluded, options, query, value]);

  useEffect(() => setActiveIndex(0), [query, open]);

  const selectCity = (city: string) => {
    onChange(city);
    setQuery(city);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && filtered.length) {
      event.preventDefault();
      selectCity(filtered[activeIndex] || filtered[0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery(value);
    } else if (event.key === "Tab") {
      setOpen(false);
      setQuery(value);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className={`relative flex items-center rounded-xl border bg-white transition-all ${open ? "border-brand-500 ring-4 ring-brand-500/10" : "border-surface-200 hover:border-surface-300"} ${disabled ? "opacity-60 bg-surface-50" : ""}`}>
        <Search className="absolute left-3 h-4 w-4 text-surface-400 pointer-events-none" />
        <input
          id={inputId}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered.length ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          required={required}
          value={query}
          placeholder={placeholder}
          onFocus={(event) => {
            setOpen(true);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent py-2.5 pl-9 pr-16 text-sm text-surface-900 outline-none placeholder:text-surface-400"
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label={`Clear ${ariaLabel || "city"}`}
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(true);
            }}
            className="absolute right-8 p-1 text-surface-400 hover:text-surface-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Open city list"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className="absolute right-1.5 p-1.5 text-surface-400 hover:text-surface-700"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && !disabled && (
        <div id={listId} role="listbox" className="absolute z-50 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-xl border border-surface-200 bg-white shadow-elevation-3">
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length ? filtered.map((city, index) => {
              const selected = cityKey(city) === cityKey(value);
              return (
                <button
                  id={`${listId}-${index}`}
                  key={cityKey(city)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCity(city)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${index === activeIndex ? "bg-brand-50 text-brand-800" : "text-surface-700 hover:bg-surface-50"}`}
                >
                  <MapPin className={`h-4 w-4 shrink-0 ${selected ? "text-brand-600" : "text-surface-400"}`} />
                  <span className="flex-1 truncate font-medium">{city}</span>
                  {selected && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              );
            }) : (
              <div className="px-3 py-6 text-center">
                <p className="text-sm font-medium text-surface-700">No matching city</p>
                <p className="mt-1 text-xs text-surface-400">Try another spelling or select from the list.</p>
              </div>
            )}
          </div>
          <div className="border-t border-surface-100 bg-surface-50 px-3 py-2 text-[11px] text-surface-500">
            Type to search · Use ↑ ↓ and Enter to select
          </div>
        </div>
      )}
    </div>
  );
}
