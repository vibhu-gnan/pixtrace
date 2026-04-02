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

const POLL_INTERVAL_MS = 5000;  // 5s between polls
const MAX_POLL_ATTEMPTS = 40;   // 40 × 5s = 3m20s max wait

export function useFaceSearch(eventHash: string, accessToken?: string | null) {
  const [state, setState] = useState<FaceSearchState>('idle');
  const [results, setResults] = useState<FaceSearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (selfieBlob: Blob, albumId?: string) => {
    // Cancel any in-flight search or poll
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState('searching');
    setError(null);
    setErrorCode(null);

    try {
      // --- Step 1: Submit selfie and get a job_id ---
      const formData = new FormData();
      formData.append('selfie', selfieBlob, 'selfie.jpg');
      formData.append('eventHash', eventHash);
      if (albumId) formData.append('albumId', albumId);

      const headers: Record<string, string> = {};
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const submitResp = await fetch('/api/face/search', {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const submitData = await submitResp.json();
      if (controller.signal.aborted) return;

      if (!submitResp.ok) {
        const code = submitData.error || '';
        setErrorCode(code);
        setError(submitData.message || submitData.error || 'Search failed. Please try again.');
        setState('error');
        return;
      }

      const jobId: string = submitData.job_id;
      if (!jobId) {
        setError('Search failed. Please try again.');
        setState('error');
        return;
      }

      // --- Step 2: Poll until completed, failed, or timed out ---
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        // Wait before polling (the cron picks up jobs every ~60s)
        await new Promise<void>(resolve => {
          const t = setTimeout(resolve, POLL_INTERVAL_MS);
          controller.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); });
        });

        if (controller.signal.aborted) return;

        const pollResp = await fetch(`/api/face/poll/${jobId}`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const pollData = await pollResp.json();
        if (controller.signal.aborted) return;

        if (!pollResp.ok) {
          setError('Search failed. Please try again.');
          setState('error');
          return;
        }

        if (pollData.status === 'completed') {
          const searchResults: FaceSearchResults = {
            tier1: pollData.tier1 || [],
            tier2: pollData.tier2 || [],
            totalMatches: pollData.total_matches || 0,
            searchTimeMs: 0,
          };
          setResults(searchResults);
          setState(searchResults.totalMatches > 0 ? 'results' : 'no_results');
          return;
        }

        if (pollData.status === 'failed') {
          const code = pollData.error || '';
          setErrorCode(code);
          if (code === 'no_face_detected') {
            setError('No face detected. Try with better lighting.');
          } else if (code === 'low_quality_selfie' || code === 'invalid_embedding') {
            setError('Face quality too low. Try with better lighting.');
          } else {
            setError(pollData.message || 'Search failed. Please try again.');
          }
          setState('error');
          return;
        }

        // status === 'pending' or 'processing' — keep polling
      }

      // Exceeded max polls (~3 min)
      setError('Search is taking longer than expected. Please try again.');
      setState('error');

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

  // Cleanup on unmount — abort any in-flight request or poll
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  /** True if the error was caused by a bad selfie (retry should re-open camera) */
  const isSelfieQualityError = errorCode === 'no_face_detected' || errorCode === 'low_quality_selfie' || errorCode === 'invalid_embedding';

  return { state, results, error, isSelfieQualityError, search, reset };
}
