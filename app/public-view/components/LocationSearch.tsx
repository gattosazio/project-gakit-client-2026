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
    <div className="relative rounded-2xl bg-white/90 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur-sm">
      <form onSubmit={handleSearch} className="flex items-center gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 transition-shadow focus-within:ring-2 focus-within:ring-gakit-maroon/40">
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchResults([]);
              setSearchError(null);
            }}
            placeholder="Search street, barangay, or landmark"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Search for a location in Iligan City"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gakit-maroon" />}
        </label>
        <button
          type="submit"
          disabled={isSearching}
          aria-label="Search location"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gakit-maroon transition-colors hover:bg-maroon-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      {(searchError || searchResults.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1">
          {searchError && (
            <p
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-red-600 shadow-sm"
              role="status"
            >
              {searchError}
            </p>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  className="flex w-full items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-maroon-50"
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
