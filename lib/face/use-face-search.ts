'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type FaceSearchState = 'idle' | 'searching' | 'results' | 'error' | 'no_results';

// Error codes that indicate a bad selfie (retry should re-open camera, not re-submit same blob)
export const SELFIE_QUALITY_ERRORS = ['no_face_detected', 'low_quality_selfie'] as const;

export interface FaceSearchResult {
  media_id: string;
  album_id: string;
  r2_key: string;
  preview_url: string;
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

export function useFaceSearch(eventHash: string, accessToken?: string | null) {
  const [state, setState] = useState<FaceSearchState>('idle');
  const [results, setResults] = useState<FaceSearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (selfieBlob: Blob, albumId?: string) => {
    // Cancel any in-flight search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState('searching');
    setError(null);
    setErrorCode(null);

    try {
      const formData = new FormData();
      formData.append('selfie', selfieBlob, 'selfie.jpg');
      formData.append('eventHash', eventHash);
      if (albumId) formData.append('albumId', albumId);

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const resp = await fetch('/api/face/search', {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      });

      // Bail if aborted after fetch completed (new search started)
      if (controller.signal.aborted) return;

      const data = await resp.json();

      if (controller.signal.aborted) return;

      if (!resp.ok) {
        const code = data.error || '';
        setErrorCode(code);
        if (code === 'no_face_detected') {
          setError('No face detected. Try with better lighting.');
        } else if (code === 'low_quality_selfie') {
          setError('Face quality too low. Try with better lighting.');
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
      if ((err as Error).name === 'AbortError') return; // Intentional cancel
      setError('Connection failed. Please try again.');
      setErrorCode(null);
      setState('error');
    }
  }, [eventHash, accessToken]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState('idle');
    setResults(null);
    setError(null);
    setErrorCode(null);
  }, []);

  // Cleanup on unmount — abort any in-flight request
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  /** True if the error was caused by a bad selfie (retry should re-open camera) */
  const isSelfieQualityError = errorCode === 'no_face_detected' || errorCode === 'low_quality_selfie';

  return { state, results, error, isSelfieQualityError, search, reset };
}
