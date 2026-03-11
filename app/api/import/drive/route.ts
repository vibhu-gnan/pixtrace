import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseDriveFolderUrl,
  IMPORTABLE_IMAGE_MIMES,
  MAX_IMPORT_FILE_COUNT,
} from '@/lib/import/drive-utils';

export const maxDuration = 60; // Listing large folders may take time

// ── Types ────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

interface DriveListResponse {
  files?: DriveFile[];
  nextPageToken?: string;
}

interface FolderInfo {
  name: string;
  path: string;
  fileCount: number;
}

interface ScannedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderPath: string;
}

// ── Constants ────────────────────────────────────────────────

const MAX_DEPTH = 10; // Max folder nesting depth
const SCAN_RATE_LIMIT_MS = 10_000; // Min 10s between scans per organizer
const MAX_RATE_LIMIT_ENTRIES = 1000; // Prevent unbounded growth
const scanTimestamps = new Map<string, number>(); // In-memory rate limit (per instance)

// ── Drive API helpers ────────────────────────────────────────

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

async function driveApiFetch<T>(
  path: string,
  apiKey: string,
  resourceKey?: string,
): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (resourceKey) {
    headers['X-Goog-Drive-Resource-Keys'] = resourceKey;
  }
  const res = await fetch(`${DRIVE_API_BASE}${path}${sep}key=${apiKey}`, {
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404) {
      throw new Error('FOLDER_NOT_FOUND');
    }
    if (res.status === 403) {
      throw new Error('FOLDER_NOT_ACCESSIBLE');
    }
    throw new Error(`Drive API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function getFolderName(
  folderId: string,
  apiKey: string,
  resourceKey?: string,
): Promise<string> {
  const data = await driveApiFetch<{ name: string }>(
    `/files/${folderId}?fields=name`,
    apiKey,
    resourceKey,
  );
  return data.name;
}

/** Mutable counter shared across recursion levels to enforce the global file cap. */
interface FileCounter {
  count: number;
}

/**
 * Recursively list all files in a Drive folder.
 * Memory-bounded: stops at MAX_IMPORT_FILE_COUNT files (shared across all levels)
 * and MAX_DEPTH nesting levels.
 */
async function listFolderRecursive(
  folderId: string,
  apiKey: string,
  path: string = '',
  resourceKey?: string,
  depth: number = 0,
  counter?: FileCounter,
): Promise<{ files: ScannedFile[]; folders: FolderInfo[]; skippedCount: number; truncated: boolean }> {
  if (depth > MAX_DEPTH) {
    return { files: [], folders: [], skippedCount: 0, truncated: true };
  }

  // Shared counter across all recursion levels
  const fileCounter = counter ?? { count: 0 };

  const allFiles: ScannedFile[] = [];
  const allFolders: FolderInfo[] = [];
  let skippedCount = 0;
  let truncated = false;
  let pageToken: string | undefined;

  // List all items in this folder (paginated)
  do {
    if (fileCounter.count >= MAX_IMPORT_FILE_COUNT) {
      truncated = true;
      break;
    }

    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent('files(id,name,mimeType,size),nextPageToken');
    let url = `/files?q=${query}&fields=${fields}&pageSize=1000`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const data = await driveApiFetch<DriveListResponse>(url, apiKey, resourceKey);
    const files = data.files || [];

    for (const file of files) {
      // Check shared file count cap
      if (fileCounter.count >= MAX_IMPORT_FILE_COUNT) {
        truncated = true;
        break;
      }

      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subPath = path ? `${path}/${file.name}` : file.name;
        const sub = await listFolderRecursive(file.id, apiKey, subPath, resourceKey, depth + 1, fileCounter);
        allFiles.push(...sub.files);
        skippedCount += sub.skippedCount;
        if (sub.truncated) truncated = true;

        if (sub.files.length > 0) {
          allFolders.push({
            name: file.name,
            path: subPath,
            fileCount: sub.files.length,
          });
        }
        allFolders.push(...sub.folders);
      } else if (IMPORTABLE_IMAGE_MIMES.has(file.mimeType)) {
        allFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: parseInt(file.size || '0', 10),
          folderPath: path,
        });
        fileCounter.count++;
      } else {
        skippedCount++;
      }
    }

    if (truncated) break;
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { files: allFiles, folders: allFolders, skippedCount, truncated };
}

// ── Route handler ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Drive import is not configured' },
      { status: 503 },
    );
  }

  const body = await request.json();
  const { action } = body;

  if (action === 'list') {
    return handleList(body, apiKey, organizer);
  } else if (action === 'start') {
    return handleStart(body, apiKey, organizer);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ── List action ──────────────────────────────────────────────

async function handleList(
  body: { driveUrl: string; eventId: string },
  apiKey: string,
  organizer: { id: string },
) {
  const { driveUrl, eventId } = body;

  if (!driveUrl || !eventId) {
    return NextResponse.json({ error: 'Missing driveUrl or eventId' }, { status: 400 });
  }

  // Rate limit: 1 scan per organizer per 10s
  const now = Date.now();
  const lastScan = scanTimestamps.get(organizer.id);
  if (lastScan && now - lastScan < SCAN_RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: 'Please wait a few seconds before scanning again' },
      { status: 429 },
    );
  }
  scanTimestamps.set(organizer.id, now);
  // Evict stale entries to prevent unbounded growth
  if (scanTimestamps.size > MAX_RATE_LIMIT_ENTRIES) {
    for (const [id, ts] of scanTimestamps) {
      if (now - ts > SCAN_RATE_LIMIT_MS * 6) scanTimestamps.delete(id);
    }
  }

  const parsed = parseDriveFolderUrl(driveUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid Google Drive folder URL' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Verify event ownership
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  try {
    const folderName = await getFolderName(parsed.folderId, apiKey, parsed.resourceKey);
    const { files, folders, skippedCount, truncated } = await listFolderRecursive(
      parsed.folderId,
      apiKey,
      '',
      parsed.resourceKey,
    );

    const rootFileCount = files.filter((f) => f.folderPath === '').length;
    const estimatedSize = files.reduce((sum, f) => sum + f.size, 0);

    return NextResponse.json({
      folderName,
      folderId: parsed.folderId,
      resourceKey: parsed.resourceKey || null,
      totalImages: files.length,
      totalSkipped: skippedCount,
      estimatedSize,
      rootFileCount,
      truncated,
      folders: folders.map((f) => ({
        name: f.name,
        path: f.path,
        fileCount: f.fileCount,
      })),
    });
  } catch (err: any) {
    if (err.message === 'FOLDER_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Folder not found. Make sure the URL is correct.' },
        { status: 404 },
      );
    }
    if (err.message === 'FOLDER_NOT_ACCESSIBLE') {
      return NextResponse.json(
        {
          error:
            'Folder is not publicly accessible. Set sharing to "Anyone with the link" and try again.',
        },
        { status: 403 },
      );
    }
    console.error('Drive list error:', err);
    return NextResponse.json(
      { error: 'Failed to scan Drive folder' },
      { status: 500 },
    );
  }
}

// ── Start action ─────────────────────────────────────────────

async function handleStart(
  body: {
    driveUrl: string;
    eventId: string;
    importMode: string;
    totalFiles?: number;
    albumId?: string;
    newAlbumName?: string;
  },
  apiKey: string,
  organizer: { id: string },
) {
  const { driveUrl, eventId, importMode, albumId, newAlbumName } = body;

  if (!driveUrl || !eventId || !importMode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate importMode
  if (importMode !== 'flat' && importMode !== 'folder_to_album') {
    return NextResponse.json({ error: 'Invalid import mode' }, { status: 400 });
  }

  const parsed = parseDriveFolderUrl(driveUrl);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid Drive URL' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify event ownership
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Check for active import on this event
  const { data: activeJob } = await supabase
    .from('import_jobs')
    .select('id, status')
    .eq('event_id', eventId)
    .in('status', ['pending', 'listing', 'processing'])
    .limit(1)
    .single();

  if (activeJob) {
    return NextResponse.json(
      { error: 'An import is already in progress for this event' },
      { status: 409 },
    );
  }

  // Resolve target album for flat mode
  let targetAlbumId: string | null = null;

  if (importMode === 'flat') {
    if (albumId) {
      const { data: album } = await supabase
        .from('albums')
        .select('id')
        .eq('id', albumId)
        .eq('event_id', eventId)
        .single();

      if (!album) {
        return NextResponse.json({ error: 'Album not found' }, { status: 404 });
      }
      targetAlbumId = albumId;
    } else if (newAlbumName) {
      // Use COALESCE to safely get next sort_order in one query
      const { data: lastAlbum } = await supabase
        .from('albums')
        .select('sort_order')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const sortOrder = (lastAlbum?.sort_order ?? -1) + 1;

      const { data: newAlbum, error: albumErr } = await supabase
        .from('albums')
        .insert({
          event_id: eventId,
          name: newAlbumName.trim(),
          sort_order: sortOrder,
        })
        .select('id')
        .single();

      if (albumErr || !newAlbum) {
        return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
      }
      targetAlbumId = newAlbum.id;
    } else {
      return NextResponse.json(
        { error: 'Flat mode requires albumId or newAlbumName' },
        { status: 400 },
      );
    }
  }

  // Use totalFiles from scan result instead of re-listing
  const totalFiles = typeof body.totalFiles === 'number' && body.totalFiles > 0
    ? body.totalFiles
    : 0;

  // Create import job
  const { data: job, error: jobErr } = await supabase
    .from('import_jobs')
    .insert({
      event_id: eventId,
      organizer_id: organizer.id,
      album_id: targetAlbumId,
      source: 'google_drive',
      source_url: driveUrl,
      folder_id: parsed.folderId,
      import_mode: importMode,
      total_files: totalFiles,
      status: 'pending',
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    console.error('Failed to create import job:', jobErr);
    return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });
  }

  // Trigger Modal import with retry (2 attempts)
  const modalUrl = process.env.MODAL_DRIVE_IMPORT_URL;
  if (modalUrl) {
    const modalPayload = {
      job_id: job.id,
      event_id: eventId,
      organizer_id: organizer.id,
      album_id: targetAlbumId,
      folder_id: parsed.folderId,
      resource_key: parsed.resourceKey || null,
      import_mode: importMode,
      secret: process.env.FACE_PROCESSING_SECRET,
    };

    triggerModal(modalUrl, modalPayload, job.id, supabase).catch(() => {});
  } else {
    console.error('MODAL_DRIVE_IMPORT_URL not configured');
    await supabase
      .from('import_jobs')
      .update({ status: 'failed', error_message: 'Import service not configured' })
      .eq('id', job.id);
  }

  return NextResponse.json({
    jobId: job.id,
    albumId: targetAlbumId,
    totalFiles,
    status: 'pending',
  });
}

/** Trigger Modal with retry. Mark job as failed if all retries fail. */
async function triggerModal(
  modalUrl: string,
  payload: Record<string, unknown>,
  jobId: string,
  supabase: ReturnType<typeof createAdminClient>,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(modalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000), // 15s timeout
      });
      if (res.ok || res.status < 500) return; // Success or client error (don't retry)
      console.error(`Modal trigger attempt ${attempt + 1} failed: ${res.status}`);
    } catch (err) {
      console.error(`Modal trigger attempt ${attempt + 1} error:`, err);
    }
    // Wait before retry
    if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
  }

  // All retries failed — mark job as failed
  await supabase
    .from('import_jobs')
    .update({
      status: 'failed',
      error_message: 'Failed to reach import service. Please try again.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}
