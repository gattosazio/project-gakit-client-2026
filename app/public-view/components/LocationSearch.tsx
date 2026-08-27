'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
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

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError('Enter at least 2 characters.');
      return;
    }

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
  };

  return (
    <div className="rounded-2xl bg-white/90 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur-sm">
      <form onSubmit={handleSearch} className="flex items-center gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 transition-shadow focus-within:ring-2 focus-within:ring-gakit-maroon/40">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
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
          {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gakit-maroon" />}
        </label>
        <button
          type="submit"
          disabled={isSearching}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gakit-maroon text-white shadow-sm transition-colors hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Search location"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      {searchError && (
        <p className="px-3 pb-1 pt-1.5 text-xs text-red-600" role="status">
          {searchError}
        </p>
      )}

      {searchResults.length > 0 && (
        <div className="mt-1.5 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
  );
}
