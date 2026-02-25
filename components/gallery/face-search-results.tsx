'use client';

import { useState, useMemo } from 'react';
import type { FaceSearchResults, FaceSearchResult } from '@/lib/face/use-face-search';

interface FaceSearchResultsProps {
  results: FaceSearchResults;
  albums: { id: string; name: string }[];
  onPhotoClick: (mediaId: string) => void;
}

export function FaceSearchResultsView({ results, albums, onPhotoClick }: FaceSearchResultsProps) {
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);

  const allResults = useMemo(() => [...results.tier1, ...results.tier2], [results]);

  const filteredResults = useMemo(() => {
    if (!activeAlbum) return allResults;
    return allResults.filter(r => r.album_id === activeAlbum);
  }, [allResults, activeAlbum]);

  const tier1Filtered = useMemo(() => filteredResults.filter(r => r.tier === 1), [filteredResults]);
  const tier2Filtered = useMemo(() => filteredResults.filter(r => r.tier === 2), [filteredResults]);

  // Get unique album IDs from results for filter pills
  const albumIdsInResults = useMemo(() => {
    const ids = new Set(allResults.map(r => r.album_id));
    return albums.filter(a => ids.has(a.id));
  }, [allResults, albums]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="text-center">
        <div className="text-lg font-semibold text-white">
          Found {filteredResults.length} photo{filteredResults.length !== 1 ? 's' : ''} of you
        </div>
        <div className="text-xs text-gray-400 mt-1">
          in {(results.searchTimeMs / 1000).toFixed(1)}s
        </div>
      </div>

      {/* Album filter pills */}
      {albumIdsInResults.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
          <button
            onClick={() => setActiveAlbum(null)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{
              background: activeAlbum === null ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
              color: activeAlbum === null ? '#fff' : 'rgba(255,255,255,0.6)',
              border: '1px solid ' + (activeAlbum === null ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'),
            }}
          >
            All ({allResults.length})
          </button>
          {albumIdsInResults.map(album => {
            const count = allResults.filter(r => r.album_id === album.id).length;
            return (
              <button
                key={album.id}
                onClick={() => setActiveAlbum(album.id)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: activeAlbum === album.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                  color: activeAlbum === album.id ? '#fff' : 'rgba(255,255,255,0.6)',
                  border: '1px solid ' + (activeAlbum === album.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'),
                }}
              >
                {album.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Tier 1 grid (high confidence) */}
      {tier1Filtered.length > 0 && (
        <ResultGrid results={tier1Filtered} onPhotoClick={onPhotoClick} />
      )}

      {/* Tier 2 section */}
      {tier2Filtered.length > 0 && (
        <>
          {tier1Filtered.length > 0 && (
            <div className="flex items-center gap-3 px-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-400">More possible matches</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}
          <ResultGrid results={tier2Filtered} onPhotoClick={onPhotoClick} dimmed />
        </>
      )}

      {filteredResults.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-400">
          No matches in this album
        </div>
      )}
    </div>
  );
}

function ResultGrid({
  results,
  onPhotoClick,
  dimmed,
}: {
  results: FaceSearchResult[];
  onPhotoClick: (mediaId: string) => void;
  dimmed?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {results.map((result) => (
        <button
          key={result.media_id}
          onClick={() => onPhotoClick(result.media_id)}
          className="relative aspect-square overflow-hidden rounded-md group"
          style={{ opacity: dimmed ? 0.75 : 1 }}
        >
          <img
            src={result.thumbnail_url}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}
