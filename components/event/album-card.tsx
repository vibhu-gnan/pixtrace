'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAlbum, updateAlbum } from '@/actions/albums';
import type { AlbumData } from '@/actions/albums';

// ─── SVG Icons ───────────────────────────────────────────────

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ─── Gradient Generator ──────────────────────────────────────

const gradientPairs = [
  ['#6366f1', '#8b5cf6'],
  ['#3b82f6', '#6366f1'],
  ['#ec4899', '#f43f5e'],
  ['#f59e0b', '#ef4444'],
  ['#10b981', '#3b82f6'],
  ['#8b5cf6', '#ec4899'],
  ['#06b6d4', '#6366f1'],
  ['#f97316', '#f59e0b'],
  ['#14b8a6', '#10b981'],
  ['#a855f7', '#6366f1'],
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): [string, string] {
  const index = hashString(name) % gradientPairs.length;
  return gradientPairs[index] as [string, string];
}

function formatCount(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(n);
}

// ─── Delete Confirmation Modal ───────────────────────────────

interface DeleteConfirmModalProps {
  albumName: string;
  mediaCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirmModal({ albumName, mediaCount, onConfirm, onCancel, loading }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        {/* Warning icon */}
        <div className="flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <WarningIcon className="text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 text-center">
          Delete &quot;{albumName}&quot;?
        </h3>

        {/* Warning message */}
        <p className="text-sm text-gray-500 text-center">
          This will permanently delete this album
          {mediaCount > 0 && (
            <> and all <span className="font-semibold text-red-600">{mediaCount} photo{mediaCount !== 1 ? 's' : ''}</span> inside it</>
          )}
          . This action cannot be undone.
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rename Album Modal ──────────────────────────────────────
interface RenameAlbumModalProps {
  album: AlbumData;
  onConfirm: (formData: FormData) => void;
  onCancel: () => void;
  loading: boolean;
  error?: string;
}

function RenameAlbumModal({ album, onConfirm, onCancel, loading, error }: RenameAlbumModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Edit Album
        </h3>

        <form action={onConfirm} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              name="name"
              id="name"
              defaultValue={album.name}
              required
              className="mt-1 block w-full rounded-lg border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              id="description"
              defaultValue={album.description || ''}
              rows={3}
              className="mt-1 block w-full rounded-lg border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ─── Album Card Component ────────────────────────────────────

interface AlbumCardProps {
  album: AlbumData;
  coverUrl: string | null;
  onClick: () => void;
}

export function AlbumCard({ album, coverUrl, onClick }: AlbumCardProps) {
  const router = useRouter();
  const [from, to] = getGradient(album.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    const result = await deleteAlbum(album.id, album.event_id);
    if (result.error) {
      console.error('Failed to delete album:', result.error);
      setLoading(false);
      setShowDeleteConfirm(false);
    } else {
      router.refresh();
      setShowDeleteConfirm(false);
      setLoading(false);
    }
  };

  const handleRename = async (formData: FormData) => {
    setLoading(true);
    setError('');
    const result = await updateAlbum(album.id, album.event_id, formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.refresh();
      setShowRenameModal(false);
      setLoading(false);
    }
  };

  return (
    <>
      <div className="block w-full text-left rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-200 group">
        {/* Cover image area — clickable */}
        <button
          onClick={onClick}
          className="relative h-48 w-full overflow-hidden block"
          style={{
            background: coverUrl ? undefined : `linear-gradient(135deg, ${from}, ${to})`,
          }}
        >
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={album.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}

          {/* ACTIVE badge — top left */}
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-green-700 backdrop-blur-sm shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              ACTIVE
            </span>
          </div>

          {/* Action icons — top right */}
          <div
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                setShowRenameModal(true);
              }}
              className="p-1.5 rounded-full bg-white/80 text-blue-500 hover:bg-blue-50 hover:text-blue-600 backdrop-blur-sm transition-colors shadow-sm cursor-pointer"
              aria-label="Edit album"
            >
              <EditIcon />
            </span>
            <span
              className="p-1.5 rounded-full bg-white/80 text-gray-600 hover:bg-white backdrop-blur-sm transition-colors shadow-sm cursor-pointer"
              aria-label="Share"
            >
              <ShareIcon />
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="p-1.5 rounded-full bg-white/80 text-red-500 hover:bg-red-50 hover:text-red-600 backdrop-blur-sm transition-colors shadow-sm cursor-pointer"
              aria-label="Delete album"
            >
              <TrashIcon />
            </span>
          </div>

          {/* Name overlay — bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12 bg-gradient-to-t from-black/60 to-transparent">
            <h3 className="text-white font-bold text-lg leading-tight truncate">
              {album.name}
            </h3>
            {album.description && (
              <p className="text-white/70 text-xs mt-0.5 truncate">
                {album.description}
              </p>
            )}
          </div>
        </button>

        {/* Stats row — clickable */}
        <button onClick={onClick} className="p-4 flex items-center gap-8 w-full text-left">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Photos</p>
            <p className="text-base font-bold text-gray-900">
              {formatCount(album.media_count || 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Views</p>
            <p className="text-base font-bold text-gray-900">&mdash;</p>
          </div>
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          albumName={album.name}
          mediaCount={album.media_count || 0}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={loading}
        />
      )}

      {/* Rename modal */}
      {showRenameModal && (
        <RenameAlbumModal
          album={album}
          onConfirm={handleRename}
          onCancel={() => { setShowRenameModal(false); setError(''); }}
          loading={loading}
          error={error}
        />
      )}
    </>
  );
}
