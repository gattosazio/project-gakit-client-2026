import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, Locate, MapPin, Search, X } from 'lucide-react';
import { searchLocations } from '@/lib/map/geoUtils';
import type { LocationSearchResult } from '@/lib/map/geoUtils';

export interface SearchedLocation {
  lat: number;
  lng: number;
  address: string;
}

export function LocationSearch({
  onSelect,
  onLocate,
  isLocating = false,
  variant = 'standalone',
  className = '',
}: {
  onSelect: (location: SearchedLocation) => void;
  onLocate?: () => void | Promise<void>;
  isLocating?: boolean;
  variant?: 'standalone' | 'header-compact';
  className?: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  const runSearch = useCallback(async (query: string) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const results = await searchLocations(query, controller.signal);
      if (controller.signal.aborted) return;

      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No matching locations found within Iligan City.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setSearchError(
        error instanceof Error
          ? error.message
          : 'Unable to search for that location.'
      );
    } finally {
      if (searchAbortRef.current === controller) {
        setIsSearching(false);
      }
    }
  }, []);

  // Debounced auto-search: fires 300ms after typing stops so the map search
  // feels live, without hitting the geocoder on every keystroke.
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, runSearch]);

  // Auto-dismiss validation / search errors after 3 seconds
  useEffect(() => {
    if (!searchError) return;
    const timer = setTimeout(() => {
      setSearchError(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [searchError]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError('Enter at least 2 characters.');
      return;
    }

    void runSearch(query);
  };

  const handleClear = () => {
    searchAbortRef.current?.abort();
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  const showDropdown =
    isFocused &&
    (Boolean(onLocate) || searchResults.length > 0 || Boolean(searchError));

  const isCompact = variant === 'header-compact';

  return (
    <div
      ref={containerRef}
      className={
        isCompact
          ? `relative flex h-8 md:h-9 items-center rounded-full bg-slate-100/90 px-3 py-1 ring-1 ring-slate-200/90 transition-all duration-150 focus-within:bg-white focus-within:ring-2 focus-within:ring-gakit-maroon/50 focus-within:shadow-md ${className}`
          : `relative flex h-[52px] items-center rounded-2xl bg-white/85 px-3.5 py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.9)] border border-white/60 ring-1 ring-slate-200/80 backdrop-blur-xl transition-all duration-150 focus-within:ring-2 focus-within:ring-gakit-maroon/40 ${className}`
      }
    >
      <form onSubmit={handleSearch} className="flex h-full w-full items-center gap-1.5 md:gap-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
        <input
          value={searchQuery}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setSearchResults([]);
            setSearchError(null);
            setIsFocused(true);
          }}
          placeholder={isCompact ? 'Search location…' : 'Search street, barangay, or landmark'}
          className="min-w-0 flex-1 bg-transparent py-0.5 text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400"
          aria-label="Search for a location in Iligan City"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-700 active:scale-90"
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        )}
        {isSearching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gakit-maroon" />}

        {!isCompact && (
          <>
            <span className="h-5 w-px shrink-0 bg-slate-200/80" />
            <button
              type="submit"
              disabled={isSearching}
              aria-label="Search location"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all duration-150 hover:bg-maroon-50 hover:text-gakit-maroon active:bg-maroon-100 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Search className="h-4 w-4" strokeWidth={2} />
            </button>
          </>
        )}
      </form>

      {showDropdown && (
        <div className={`absolute z-50 mt-2 overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.14),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/80 backdrop-blur-xl ${
          isCompact ? 'left-0 sm:left-auto sm:right-0 top-full w-72 sm:w-80 md:w-96' : 'left-0 right-0 top-full'
        }`}>
          {searchError && (
            <p
              className="px-3.5 py-2.5 text-xs text-red-600 border-b border-slate-100"
              role="status"
            >
              {searchError}
            </p>
          )}

          {onLocate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                setIsFocused(false);
                await onLocate();
              }}
              disabled={isLocating}
              className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left font-medium transition-colors hover:bg-maroon-50/70 border-b border-slate-100/80 group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-gakit-maroon group-hover:bg-maroon-100">
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Locate className="h-4 w-4 text-gakit-maroon" strokeWidth={2.5} />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-800 group-hover:text-gakit-maroon">
                  {isLocating ? 'Locating your device…' : 'Use your current location'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Share GPS position on map
                </span>
              </div>
            </button>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.lat}-${result.lng}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setIsFocused(false);
                    onSelect({
                      lat: result.lat,
                      lng: result.lng,
                      address: result.displayName,
                    });
                  }}
                  className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-maroon-50"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gakit-maroon" />
                  <span className="text-sm text-slate-700">
                    {result.displayName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
