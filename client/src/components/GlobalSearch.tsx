import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Bot, Target, Phone, PhoneCall, Users, BookOpen, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "agent" | "campaign" | "call" | "contact" | "knowledge" | "department" | "phone";
  title: string;
  subtitle?: string;
  url: string;
}

const typeConfig: Record<string, { icon: typeof Search; label: string }> = {
  agent: { icon: Bot, label: "Agent" },
  campaign: { icon: Target, label: "Campaign" },
  call: { icon: PhoneCall, label: "Call" },
  contact: { icon: Users, label: "Contact" },
  knowledge: { icon: BookOpen, label: "Knowledge" },
  department: { icon: Building2, label: "Department" },
  phone: { icon: Phone, label: "Phone" },
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [, setLocation] = useLocation();

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchResults(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setLocation(result.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  };

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  const showDropdown = isOpen && (query.length >= 2);

  return (
    <div ref={containerRef} className="relative w-full max-w-md" data-testid="global-search-container">
      <div
        className={cn(
          "flex items-center gap-2 px-3.5 h-9 rounded-xl transition-all duration-200",
          "bg-white dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.08]",
          isOpen
            ? "shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
            : "shadow-sm"
        )}
      >
        <Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none min-w-0"
          data-testid="input-global-search"
        />
        {query ? (
          <button
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            className="flex-shrink-0 p-0.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            data-testid="button-clear-search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-700 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 flex-shrink-0">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/[0.06] dark:border-white/[0.08] shadow-lg overflow-hidden z-50" data-testid="search-results-dropdown">
          {isLoading ? (
            <div className="flex items-center justify-center py-6" data-testid="search-loading">
              <div className="h-5 w-5 rounded-full border-2 border-zinc-200 dark:border-zinc-600 border-t-zinc-500 dark:border-t-zinc-300 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="py-1.5 max-h-80 overflow-y-auto">
              {results.map((result, index) => {
                const config = typeConfig[result.type] || { icon: Search, label: result.type };
                const IconComponent = config.icon;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                      activeIndex === index
                        ? "bg-zinc-100 dark:bg-zinc-700/60"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-700/30"
                    )}
                    data-testid={`search-result-${result.type}-${result.id}`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                      <IconComponent className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{result.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{config.label}{result.subtitle ? ` · ${result.subtitle}` : ""}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center" data-testid="search-no-results">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">No results found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
