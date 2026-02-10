import { createClient } from '@/lib/auth';
import { notFound } from 'next/navigation';

export default async function GalleryEventPage({
  params,
}: {
  params: Promise<{ eventHash: string }>;
}) {
  const { eventHash } = await params;
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from('events')
    .select('id, name, description, event_date, is_public')
    .eq('event_hash', eventHash)
    .eq('is_public', true)
    .single();

  if (error || !event) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.name}</h1>
        {event.description && (
          <p className="text-gray-600 mb-4">{event.description}</p>
        )}
        <p className="text-sm text-gray-500">
          Gallery view (Phase 3) — photos will appear here.
        </p>
      </div>
    </main>
  );
}
