import { useState, useRef, useEffect } from "react";
import { Search, MapPin, X, ChevronDown } from "lucide-react";
import { searchLocations, BDLocation } from "../data/bangladeshLocations";

interface LocationSearchProps {
  value: { name: string; address: string };
  onChange: (location: { name: string; address: string }) => void;
  placeholder?: string;
  variant?: "boarding" | "dropping";
}

export function LocationSearch({
  value,
  onChange,
  placeholder = "Search location...",
  variant = "boarding",
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BDLocation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isBoarding = variant === "boarding";
  const accentColor = isBoarding ? "emerald" : "orange";

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search on query change
  useEffect(() => {
    if (query.trim().length >= 1) {
      const found = searchLocations(query, 12);
      setResults(found);
      setHighlightIdx(-1);
    } else {
      setResults([]);
    }
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-location-item]");
      if (items[highlightIdx]) {
        items[highlightIdx].scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightIdx]);

  const handleSelect = (loc: BDLocation) => {
    onChange({ name: loc.name, address: loc.address });
    setQuery("");
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    onChange({ name: "", address: "" });
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIdx]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // If a value is selected, show the chip
  const hasValue = value.name.trim() !== "";

  return (
    <div ref={containerRef} className="relative">
      {hasValue ? (
        /* Selected value chip */
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
            isBoarding
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-orange-50 border-orange-200 text-orange-800"
          }`}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
          <div className="flex-1 min-w-0">
            <span className="block truncate text-xs font-bold">{value.name}</span>
            {value.address && (
              <span className="block truncate text-[10px] opacity-60 font-medium">
                {value.address}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className={`p-1 rounded-lg transition-colors shrink-0 ${
              isBoarding
                ? "hover:bg-emerald-200/60 text-emerald-500"
                : "hover:bg-orange-200/60 text-orange-500"
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Search input */
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (query.trim().length >= 1) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="input-premium w-full text-xs !py-2 !pl-9 !pr-8"
          />
          <ChevronDown
            className={`absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400 pointer-events-none transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      )}

      {/* Dropdown results */}
      {isOpen && !hasValue && (
        <div
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-surface-200 shadow-lg max-h-56 overflow-y-auto"
          style={{ minWidth: "100%" }}
        >
          {query.trim().length < 1 ? (
            <div className="px-4 py-3 text-xs text-surface-400 text-center font-medium">
              Type to search Bangladesh locations...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-surface-400 text-center font-medium">
              No locations found for "{query}"
            </div>
          ) : (
            results.map((loc, idx) => (
              <button
                key={`${loc.name}-${loc.address}-${idx}`}
                type="button"
                data-location-item
                onClick={() => handleSelect(loc)}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-b border-surface-50 last:border-b-0 ${
                  idx === highlightIdx
                    ? isBoarding
                      ? "bg-emerald-50"
                      : "bg-orange-50"
                    : "hover:bg-surface-50"
                }`}
              >
                <MapPin
                  className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                    isBoarding ? "text-emerald-500" : "text-orange-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-surface-900 truncate">
                    {loc.name}
                  </p>
                  <p className="text-[10px] text-surface-500 truncate">
                    {loc.address}
                  </p>
                  <p className="text-[9px] text-surface-400 font-medium mt-0.5">
                    {loc.district}, {loc.division}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
