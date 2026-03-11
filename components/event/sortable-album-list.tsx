'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlbumCard } from './album-card';
import { AlbumListRow } from './album-list-row';
import { AllPhotosCard } from './all-photos-card';
import { CreateAlbumCard } from './create-album-card';
import { reorderAlbums } from '@/actions/albums';
import type { AlbumData } from '@/actions/albums';

// ─── Sortable Item Wrapper ──────────────────────────────────

interface SortableAlbumItemProps {
  album: AlbumData;
  layout: 'grid' | 'list';
  eventHash: string;
  onAlbumClick: (albumId: string) => void;
}

function SortableAlbumItem({ album, layout, eventHash, onAlbumClick }: SortableAlbumItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: album.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  if (layout === 'list') {
    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <AlbumListRow
          album={album}
          coverUrl={album.cover_url || null}
          eventHash={eventHash}
          onClick={() => onAlbumClick(album.id)}
          dragHandleProps={listeners as Record<string, unknown>}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <AlbumCard
        album={album}
        coverUrl={album.cover_url || null}
        eventHash={eventHash}
        onClick={() => onAlbumClick(album.id)}
        dragHandleProps={listeners as Record<string, unknown>}
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface SortableAlbumListProps {
  albums: AlbumData[];
  layout: 'grid' | 'list';
  eventId: string;
  eventHash: string;
  totalPhotoCount: number;
  onAlbumClick: (albumId: string) => void;
  onAllPhotosClick: () => void;
  onCreateAlbum: () => void;
}

export function SortableAlbumList({
  albums,
  layout,
  eventId,
  eventHash,
  totalPhotoCount,
  onAlbumClick,
  onAllPhotosClick,
  onCreateAlbum,
}: SortableAlbumListProps) {
  const [orderedAlbums, setOrderedAlbums] = useState(albums);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync with server data when props change (album created/deleted/refreshed)
  useEffect(() => {
    setOrderedAlbums(albums);
  }, [albums]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedAlbums.findIndex(a => a.id === active.id);
    const newIndex = orderedAlbums.findIndex(a => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(orderedAlbums, oldIndex, newIndex);

    // Optimistic update
    setOrderedAlbums(newOrder);

    // Persist to DB
    const result = await reorderAlbums(eventId, newOrder.map(a => a.id));
    if (result.error) {
      // Revert on failure
      setOrderedAlbums(albums);
      console.error('Failed to reorder:', result.error);
    }
  }, [orderedAlbums, eventId, albums]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const strategy = layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy;
  const activeAlbum = activeId ? orderedAlbums.find(a => a.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={orderedAlbums.map(a => a.id)} strategy={strategy}>
        {layout === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* All Photos virtual card — always first, not sortable */}
            <AllPhotosCard
              totalCount={totalPhotoCount}
              onClick={onAllPhotosClick}
              layout="grid"
            />
            {orderedAlbums.map((album) => (
              <SortableAlbumItem
                key={album.id}
                album={album}
                layout="grid"
                eventHash={eventHash}
                onAlbumClick={onAlbumClick}
              />
            ))}
            <CreateAlbumCard onCreateAlbum={onCreateAlbum} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* All Photos virtual row — always first, not sortable */}
            <AllPhotosCard
              totalCount={totalPhotoCount}
              onClick={onAllPhotosClick}
              layout="list"
            />
            {orderedAlbums.map((album) => (
              <SortableAlbumItem
                key={album.id}
                album={album}
                layout="list"
                eventHash={eventHash}
                onAlbumClick={onAlbumClick}
              />
            ))}
          </div>
        )}
      </SortableContext>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeAlbum ? (
          <div className="opacity-90 shadow-2xl rounded-2xl pointer-events-none">
            {layout === 'list' ? (
              <AlbumListRow
                album={activeAlbum}
                coverUrl={activeAlbum.cover_url || null}
                eventHash={eventHash}
                onClick={() => {}}
              />
            ) : (
              <AlbumCard
                album={activeAlbum}
                coverUrl={activeAlbum.cover_url || null}
                eventHash={eventHash}
                onClick={() => {}}
              />
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
