'use client';

import { useState, useCallback } from 'react';

export type FaceSearchState = 'idle' | 'capturing' | 'confirming' | 'searching' | 'results' | 'error' | 'no_results';

export interface FaceSearchResult {
  media_id: string;
  album_id: string;
  thumbnail_url: string;
  full_url: string;
  original_url: string;
  width: number | null;
  height: number | null;
  score: number;
  tier: 1 | 2;
}

export interface FaceSearchResults {
  tier1: FaceSearchResult[];
  tier2: FaceSearchResult[];
  totalMatches: number;
  searchTimeMs: number;
}

export function useFaceSearch(eventHash: string) {
  const [state, setState] = useState<FaceSearchState>('idle');
  const [results, setResults] = useState<FaceSearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (selfieBlob: Blob, albumId?: string) => {
    setState('searching');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('selfie', selfieBlob, 'selfie.jpg');
      formData.append('eventHash', eventHash);
      if (albumId) formData.append('albumId', albumId);

      const resp = await fetch('/api/face/search', {
        method: 'POST',
        body: formData,
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (data.error === 'no_face_detected') {
          setError('No face detected. Please try again with better lighting and face the camera directly.');
        } else if (data.error === 'low_quality_selfie') {
          setError('Face detection quality is too low. Try with better lighting.');
        } else {
          setError(data.message || data.error || 'Search failed. Please try again.');
        }
        setState('error');
        return;
      }

      const searchResults: FaceSearchResults = {
        tier1: data.tier1 || [],
        tier2: data.tier2 || [],
        totalMatches: data.total_matches || 0,
        searchTimeMs: data.search_time_ms || 0,
      };

      setResults(searchResults);
      setState(searchResults.totalMatches > 0 ? 'results' : 'no_results');
    } catch (err) {
      setError('Unable to connect to face search service. Please try again later.');
      setState('error');
    }
  }, [eventHash]);

  const reset = useCallback(() => {
    setState('idle');
    setResults(null);
    setError(null);
  }, []);

  return { state, setState, results, error, search, reset };
}
