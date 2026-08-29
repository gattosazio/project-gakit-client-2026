'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { searchLocations } from '@/lib/map/geoUtils';
import type { LocationSearchResult } from '@/lib/map/geoUtils';

export interface SearchedLocation {
  lat: number;
  lng: number;
  address: string;
}

export function LocationSearch({
  onSelect,
}: {
  onSelect: (location: SearchedLocation) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

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

  return (
    <div className="relative flex h-[52px] items-center rounded-2xl bg-white/95 p-1 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200/90 backdrop-blur-none transition-all duration-150 md:backdrop-blur">
      <form onSubmit={handleSearch} className="flex h-full w-full items-center gap-1">
        <label className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50/70 px-3 ring-1 ring-slate-200/70 transition-all duration-150 hover:bg-slate-100/60 focus-within:bg-[#eef2f6] focus-within:shadow-[inset_2px_2px_4px_rgba(15,23,42,0.12),inset_-2px_-2px_4px_rgba(255,255,255,1)] focus-within:ring-1 focus-within:ring-slate-300/90">
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchResults([]);
              setSearchError(null);
            }}
            placeholder="Search street, barangay, or landmark"
            className="min-w-0 flex-1 bg-transparent py-1 text-xs font-medium text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Search for a location in Iligan City"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gakit-maroon" />}
        </label>
        <button
          type="submit"
          disabled={isSearching}
          aria-label="Search location"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-gakit-maroon ring-1 ring-slate-200/80 shadow-xs transition-all duration-150 hover:bg-maroon-50 hover:ring-maroon-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Search className="h-4.5 w-4.5 text-gakit-maroon" />
        </button>
      </form>

      {(searchError || searchResults.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2">
          {searchError && (
            <p
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-red-600 shadow-xl ring-1 ring-slate-900/5"
              role="status"
            >
              {searchError}
            </p>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
              {searchResults.map((result) => (
                <button
                  key={`${result.lat}-${result.lng}`}
                  type="button"
                  onClick={() =>
                    onSelect({
                      lat: result.lat,
                      lng: result.lng,
                      address: result.displayName,
                    })
                  }
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
