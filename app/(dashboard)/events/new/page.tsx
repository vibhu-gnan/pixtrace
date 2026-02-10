'use client';

import { useState } from 'react';
import { createEvent } from '@/actions/events';
import Link from 'next/link';

export default function NewEventPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError('');
    setLoading(true);
    try {
      const result = await createEvent(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch {
      setError('Failed to create event');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to events
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Event</h1>

      <form action={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Event Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
            placeholder="e.g., Wedding Reception, Company Meetup"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
            placeholder="Brief description of the event"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-1">
            Event Date
          </label>
          <input
            type="date"
            id="eventDate"
            name="eventDate"
            className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm"
            disabled={loading}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPublic"
            name="isPublic"
            defaultChecked
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
            disabled={loading}
          />
          <label htmlFor="isPublic" className="text-sm text-gray-700">
            Make gallery publicly accessible (guests can view without login)
          </label>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
