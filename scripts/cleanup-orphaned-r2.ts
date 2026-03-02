/**
 * R2 Orphan Cleanup Script
 *
 * Finds and removes R2 objects that no longer exist in Supabase.
 * Also processes any keys logged in the r2_orphaned_keys table.
 *
 * Safety guards:
 *   - Dry-run by default (must pass --delete to actually delete)
 *   - Refuses to delete if orphan ratio > 50% (likely a DB query bug)
 *   - Refuses to delete if Supabase returns 0 media rows (likely a query failure)
 *   - Caps max deletions at 5000 per run (override with --no-limit)
 *   - Logs every deletion batch for audit trail
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphaned-r2.ts                 # Dry run (preview)
 *   npx tsx scripts/cleanup-orphaned-r2.ts --delete        # Actually delete (capped at 5000)
 *   npx tsx scripts/cleanup-orphaned-r2.ts --delete --no-limit  # Delete all orphans
 */

// Load env FIRST before any other imports
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 100;
const DEFAULT_MAX_DELETIONS = 5000;
const MAX_ORPHAN_RATIO = 0.5; // Refuse if >50% of bucket would be deleted

async function main() {
    // Dynamic import AFTER env is loaded
    const { listAllObjects, deleteObjects } = await import('../lib/storage/r2-client');

    const isDryRun = !process.argv.includes('--delete');
    const noLimit = process.argv.includes('--no-limit');
    const maxDeletions = noLimit ? Infinity : DEFAULT_MAX_DELETIONS;

    console.log('R2 Orphan Cleanup Script');
    console.log(`   Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'DELETE MODE'}`);
    if (!isDryRun && !noLimit) {
        console.log(`   Max deletions: ${DEFAULT_MAX_DELETIONS} (use --no-limit to override)`);
    }
    console.log('');

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Step 1: Process tracked orphans from r2_orphaned_keys table ─────────
    console.log('Processing tracked orphan keys from database...');
    const { data: trackedOrphans, error: trackedErr } = await supabase
        .from('r2_orphaned_keys')
        .select('id, r2_key')
        .is('cleaned_at', null)
        .limit(1000);

    if (trackedErr) {
        console.error('Failed to fetch tracked orphans (continuing):', trackedErr);
    } else if (trackedOrphans && trackedOrphans.length > 0) {
        console.log(`   Found ${trackedOrphans.length} tracked orphan keys`);

        if (!isDryRun) {
            let cleaned = 0;
            for (let i = 0; i < trackedOrphans.length; i += BATCH_SIZE) {
                const batch = trackedOrphans.slice(i, i + BATCH_SIZE);
                const keys = batch.map(r => r.r2_key);
                try {
                    await deleteObjects(keys);
                    // Mark as cleaned
                    const ids = batch.map(r => r.id);
                    await supabase
                        .from('r2_orphaned_keys')
                        .update({ cleaned_at: new Date().toISOString() })
                        .in('id', ids);
                    cleaned += batch.length;
                    console.log(`   Cleaned ${cleaned}/${trackedOrphans.length} tracked orphans`);
                } catch (err) {
                    console.error(`   Error cleaning tracked batch starting at ${i}:`, err);
                }
            }
            console.log(`   Tracked orphan cleanup: ${cleaned} cleaned`);
        } else {
            console.log('   (dry run — skipping tracked orphan deletion)');
        }
    } else {
        console.log('   No tracked orphans found');
    }

    console.log('');

    // ── Step 2: Full bucket scan for untracked orphans ──────────────────────
    console.log('Fetching all R2 objects...');
    let r2Keys: string[];
    try {
        r2Keys = await listAllObjects();
        console.log(`   Found ${r2Keys.length} objects in R2`);
    } catch (err: any) {
        console.error('Failed to list R2 objects');
        console.error('   Message:', err?.message || String(err));
        process.exit(1);
    }

    // ── Step 3: Get all known keys from Supabase ────────────────────────────
    console.log('Fetching all media keys from Supabase...');
    const { data: mediaRows, error } = await supabase
        .from('media')
        .select('r2_key, thumbnail_r2_key, preview_r2_key');

    if (error) {
        console.error('Failed to fetch media from Supabase:', error);
        process.exit(1);
    }

    // SAFETY: refuse to proceed if Supabase returned 0 rows — likely a query bug
    if (!mediaRows || mediaRows.length === 0) {
        if (r2Keys.length > 0) {
            console.error('SAFETY ABORT: Supabase returned 0 media rows but R2 has objects.');
            console.error('This likely means the Supabase query failed silently or the DB is unreachable.');
            console.error('Refusing to delete anything. Check your database connection.');
            process.exit(1);
        }
        console.log('   Both R2 and Supabase are empty — nothing to do.');
        return;
    }

    const supabaseKeys = new Set<string>();
    for (const row of mediaRows) {
        if (row.r2_key) supabaseKeys.add(row.r2_key);
        if (row.thumbnail_r2_key) supabaseKeys.add(row.thumbnail_r2_key);
        if (row.preview_r2_key) supabaseKeys.add(row.preview_r2_key);
    }
    console.log(`   Found ${supabaseKeys.size} keys in Supabase (from ${mediaRows.length} media rows)`);

    // ── Step 4: Find orphans ────────────────────────────────────────────────
    const orphanedKeys = r2Keys.filter(key => !supabaseKeys.has(key));
    console.log('');
    console.log(`Found ${orphanedKeys.length} orphaned R2 objects`);

    if (orphanedKeys.length === 0) {
        console.log('Nothing to clean up!');
        return;
    }

    // SAFETY: refuse if orphan ratio is too high
    const orphanRatio = orphanedKeys.length / r2Keys.length;
    if (orphanRatio > MAX_ORPHAN_RATIO) {
        console.error(`SAFETY ABORT: ${(orphanRatio * 100).toFixed(1)}% of bucket objects are orphaned.`);
        console.error(`This exceeds the ${MAX_ORPHAN_RATIO * 100}% safety threshold.`);
        console.error('This likely indicates a database query issue, not actual orphans.');
        console.error('If you are certain, manually delete objects using the R2 dashboard.');
        process.exit(1);
    }

    // Show sample of orphans
    console.log('');
    console.log('Sample orphaned keys:');
    orphanedKeys.slice(0, 10).forEach(key => console.log(`   - ${key}`));
    if (orphanedKeys.length > 10) {
        console.log(`   ... and ${orphanedKeys.length - 10} more`);
    }

    // ── Step 5: Delete orphans (if not dry run) ─────────────────────────────
    if (isDryRun) {
        console.log('');
        console.log('Dry run complete. To delete these objects, run:');
        console.log('   npx tsx scripts/cleanup-orphaned-r2.ts --delete');
    } else {
        const toDelete = orphanedKeys.slice(0, maxDeletions);
        if (toDelete.length < orphanedKeys.length) {
            console.log('');
            console.log(`Capping at ${maxDeletions} deletions (${orphanedKeys.length - maxDeletions} remaining for next run)`);
        }

        console.log('');
        console.log('Deleting orphaned objects...');

        let deleted = 0;
        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE);
            try {
                await deleteObjects(batch);
                deleted += batch.length;
                console.log(`   Deleted ${deleted}/${toDelete.length}`);
            } catch (err) {
                console.error(`   Error deleting batch starting at ${i}:`, err);
            }
        }

        console.log('');
        console.log(`Cleanup complete! Deleted ${deleted} orphaned objects.`);
        if (toDelete.length < orphanedKeys.length) {
            console.log(`Run again to delete the remaining ${orphanedKeys.length - toDelete.length} orphans.`);
        }
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
