'use client';

import { useState, useCallback } from 'react';
import type { FaceSearchResult, FaceSearchResults } from './use-face-search';

export function useFaceProfile(
  eventHash: string,
  accessToken: string | null,
) {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [recallResults, setRecallResults] = useState<FaceSearchResults | null>(null);

  const checkProfile = useCallback(async () => {
    if (!accessToken) {
      setHasProfile(false);
      return false;
    }

    try {
      const resp = await fetch(`/api/face/profile?eventHash=${eventHash}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json();
      const result = data.has_profile ?? false;
      setHasProfile(result);
      return result;
    } catch {
      setHasProfile(false);
      return false;
    }
  }, [eventHash, accessToken]);

  const runRecall = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);

    try {
      const resp = await fetch('/api/face/recall', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ eventHash }),
      });

      const data = await resp.json();

      if (data.has_profile && data.total_matches > 0) {
        const results: FaceSearchResults = {
          tier1: data.tier1,
          tier2: data.tier2,
          totalMatches: data.total_matches,
          searchTimeMs: data.search_time_ms,
        };
        setRecallResults(results);
        return results;
      }
      return null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [eventHash, accessToken]);

  return { hasProfile, loading, recallResults, checkProfile, runRecall };
}
