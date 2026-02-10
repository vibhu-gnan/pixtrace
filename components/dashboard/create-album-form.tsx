'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAlbum } from '@/actions/albums';

interface CreateAlbumFormProps {
  eventId: string;
  onAlbumCreated?: () => void;
  onCancel?: () => void;
}

export function CreateAlbumForm({ eventId, onAlbumCreated, onCancel }: CreateAlbumFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(onAlbumCreated ? true : false); // If callbacks provided, show form directly
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (formData: FormData) => {
    setError('');
    setLoading(true);
    const result = await createAlbum(eventId, formData);
    if (result.error) {
      setError(result.error);
    } else {
      if (onAlbumCreated) {
        onAlbumCreated();
      } else {
        setOpen(false);
        router.refresh();
      }
    }
    setLoading(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      setOpen(false);
    }
    setError('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + New Album
      </button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
    >
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <input
        type="text"
        name="name"
        required
        placeholder="Album name"
        className="block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
        disabled={loading}
        autoFocus
      />
      <input
        type="text"
        name="description"
        placeholder="Description (optional)"
        className="block w-full rounded-lg border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
        disabled={loading}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Album'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
