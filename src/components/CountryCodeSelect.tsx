"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRY_CODES, CountryCode } from "@/lib/countryCodes";
import { cn } from "@/lib/utils";

interface CountryCodeSelectProps {
  value: string;       // Current dial code, e.g. "+1"
  onChange: (dial: string, country: CountryCode) => void;
}

export default function CountryCodeSelect({ value, onChange }: CountryCodeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Find current country from dial code
  const selectedCountry = useMemo(
    () => COUNTRY_CODES.find((c) => c.dial === value) || COUNTRY_CODES[0],
    [value]
  );

  // Filter countries by search
  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRY_CODES;
    const q = search.toLowerCase();
    return COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (country: CountryCode) => {
    onChange(country.dial, country);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center space-x-2 h-10 px-3 bg-(--color-background) border border-(--color-border) rounded-lg text-sm transition-colors",
          isOpen ? "border-(--color-primary) ring-1 ring-(--color-primary)/20" : "hover:border-(--color-primary)/50"
        )}
      >
        <span className="text-lg leading-none">{selectedCountry.flag}</span>
        <span className="font-medium">{selectedCountry.dial}</span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-(--color-text-muted) transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-(--color-border)">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-(--color-text-muted)" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search country or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-(--color-background) border border-(--color-border) rounded-lg outline-none focus:border-(--color-primary)"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-(--color-text-muted) text-sm py-4">
                No country found
              </p>
            ) : (
              filtered.map((country) => (
                <button
                  key={country.code + country.dial}
                  type="button"
                  onClick={() => handleSelect(country)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-3 py-2 text-sm hover:bg-(--color-elevated) transition-colors text-left",
                    country.dial === value && "bg-(--color-elevated)"
                  )}
                >
                  <span className="text-lg leading-none w-7">{country.flag}</span>
                  <span className="flex-1 truncate">{country.name}</span>
                  <span className="text-(--color-text-muted) font-mono text-xs">{country.dial}</span>
                </button>
              ))
            )}
          </div>

          {/* Quick popular codes */}
          {!search && (
            <div className="border-t border-(--color-border) px-3 py-2">
              <p className="text-[10px] text-(--color-text-muted) uppercase tracking-wider mb-1.5">
                Popular
              </p>
              <div className="flex flex-wrap gap-1">
                {COUNTRY_CODES.slice(0, 8).map((c) => (
                  <button
                    key={c.code + c.dial}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={cn(
                      "px-2 py-0.5 text-xs rounded-full transition-colors",
                      c.dial === value
                        ? "bg-(--color-primary) text-white"
                        : "bg-(--color-elevated) hover:bg-(--color-primary)/10 text-(--color-text-muted)"
                    )}
                  >
                    {c.flag} {c.dial}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
