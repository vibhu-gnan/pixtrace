import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseDriveFolderUrl,
  IMPORTABLE_IMAGE_MIMES,
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

// ── Drive API helpers ────────────────────────────────────────

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

async function driveApiFetch<T>(path: string, apiKey: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${DRIVE_API_BASE}${path}${sep}key=${apiKey}`, {
    headers: { Accept: 'application/json' },
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

async function getFolderName(folderId: string, apiKey: string): Promise<string> {
  const data = await driveApiFetch<{ name: string }>(
    `/files/${folderId}?fields=name`,
    apiKey,
  );
  return data.name;
}

/**
 * Recursively list all files in a Drive folder.
 * Returns image files with their folder path.
 */
async function listFolderRecursive(
  folderId: string,
  apiKey: string,
  path: string = '',
  resourceKey?: string,
): Promise<{ files: ScannedFile[]; folders: FolderInfo[]; skippedCount: number }> {
  const allFiles: ScannedFile[] = [];
  const allFolders: FolderInfo[] = [];
  let skippedCount = 0;
  let pageToken: string | undefined;

  // List all items in this folder (paginated)
  do {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent('files(id,name,mimeType,size),nextPageToken');
    let url = `/files?q=${query}&fields=${fields}&pageSize=1000`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    if (resourceKey) {
      // Resource key header not supported via query param, but API key access
      // to public folders generally works without it
    }

    const data = await driveApiFetch<DriveListResponse>(url, apiKey);
    const files = data.files || [];

    for (const file of files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        // Recurse into subfolder
        const subPath = path ? `${path}/${file.name}` : file.name;
        const sub = await listFolderRecursive(file.id, apiKey, subPath);
        allFiles.push(...sub.files);
        skippedCount += sub.skippedCount;

        // Record this folder if it has files
        if (sub.files.length > 0) {
          allFolders.push({
            name: file.name,
            path: subPath,
            fileCount: sub.files.length,
          });
        }
        // Merge sub-folders
        allFolders.push(...sub.folders);
      } else if (IMPORTABLE_IMAGE_MIMES.has(file.mimeType)) {
        allFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: parseInt(file.size || '0', 10),
          folderPath: path,
        });
      } else {
        // Non-image file — skip
        skippedCount++;
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { files: allFiles, folders: allFolders, skippedCount };
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
    const folderName = await getFolderName(parsed.folderId, apiKey);
    const { files, folders, skippedCount } = await listFolderRecursive(
      parsed.folderId,
      apiKey,
      '',
      parsed.resourceKey,
    );

    // Count root-level files
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
    importMode: 'flat' | 'folder_to_album';
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
      // Verify album belongs to this event
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
      // Create new album
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
  // folder_to_album mode: targetAlbumId stays null, Modal creates albums

  // Quick file count (re-list just to get count — Modal will do the full listing)
  let totalFiles = 0;
  try {
    const { files } = await listFolderRecursive(
      parsed.folderId,
      apiKey,
      '',
      parsed.resourceKey,
    );
    totalFiles = files.length;
  } catch {
    // Non-fatal — Modal will get the real count
  }

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

  // Fire-and-forget: trigger Modal import
  const modalUrl = process.env.MODAL_DRIVE_IMPORT_URL;
  if (modalUrl) {
    fetch(modalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        event_id: eventId,
        organizer_id: organizer.id,
        album_id: targetAlbumId,
        folder_id: parsed.folderId,
        resource_key: parsed.resourceKey || null,
        import_mode: importMode,
        secret: process.env.FACE_PROCESSING_SECRET,
      }),
    }).catch((err) => console.error('Modal import trigger error:', err));
  } else {
    console.error('MODAL_DRIVE_IMPORT_URL not configured');
  }

  return NextResponse.json({
    jobId: job.id,
    albumId: targetAlbumId,
    totalFiles,
    status: 'pending',
  });
}
