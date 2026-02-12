/**
 * R2 Orphan Cleanup Script
 * 
 * Finds and removes R2 objects that no longer exist in Supabase.
 * 
 * Usage:
 *   npx tsx scripts/cleanup-orphaned-r2.ts           # Dry run (preview)
 *   npx tsx scripts/cleanup-orphaned-r2.ts --delete  # Actually delete
 */

// Load env FIRST before any other imports
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 100; // Delete in batches to avoid overload

async function main() {
    // Dynamic import AFTER env is loaded
    const { listAllObjects, deleteObjects } = await import('../lib/storage/r2-client');

    const isDryRun = !process.argv.includes('--delete');

    console.log('🔍 R2 Orphan Cleanup Script');
    console.log(`   Mode: ${isDryRun ? 'DRY RUN (preview only)' : '⚠️  DELETE MODE'}`);
    console.log('');

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: List all R2 objects
    console.log('📦 Fetching all R2 objects...');
    let r2Keys: string[];
    try {
        r2Keys = await listAllObjects();
        console.log(`   Found ${r2Keys.length} objects in R2`);
    } catch (err: any) {
        console.error('❌ Failed to list R2 objects');
        console.error('   Message:', err?.message || String(err));
        process.exit(1);
    }

    // Step 2: Get all known keys from Supabase
    console.log('🗄️  Fetching all media keys from Supabase...');
    const { data: mediaRows, error } = await supabase
        .from('media')
        .select('r2_key, thumbnail_r2_key, preview_r2_key');

    if (error) {
        console.error('❌ Failed to fetch media from Supabase:', error);
        process.exit(1);
    }

    const supabaseKeys = new Set<string>();
    for (const row of mediaRows || []) {
        if (row.r2_key) supabaseKeys.add(row.r2_key);
        if (row.thumbnail_r2_key) supabaseKeys.add(row.thumbnail_r2_key);
        if (row.preview_r2_key) supabaseKeys.add(row.preview_r2_key);
    }
    console.log(`   Found ${supabaseKeys.size} keys in Supabase`);

    // Step 3: Find orphans (in R2 but not in Supabase)
    const orphanedKeys = r2Keys.filter(key => !supabaseKeys.has(key));
    console.log('');
    console.log(`🗑️  Found ${orphanedKeys.length} orphaned R2 objects`);

    if (orphanedKeys.length === 0) {
        console.log('✅ Nothing to clean up!');
        return;
    }

    // Show sample of orphans
    console.log('');
    console.log('Sample orphaned keys:');
    orphanedKeys.slice(0, 10).forEach(key => console.log(`   - ${key}`));
    if (orphanedKeys.length > 10) {
        console.log(`   ... and ${orphanedKeys.length - 10} more`);
    }

    // Step 4: Delete orphans (if not dry run)
    if (isDryRun) {
        console.log('');
        console.log('ℹ️  Dry run complete. To delete these objects, run:');
        console.log('   npx tsx scripts/cleanup-orphaned-r2.ts --delete');
    } else {
        console.log('');
        console.log('🚀 Deleting orphaned objects...');

        let deleted = 0;
        for (let i = 0; i < orphanedKeys.length; i += BATCH_SIZE) {
            const batch = orphanedKeys.slice(i, i + BATCH_SIZE);
            try {
                await deleteObjects(batch);
                deleted += batch.length;
                console.log(`   Deleted ${deleted}/${orphanedKeys.length}`);
            } catch (err) {
                console.error(`   ⚠️  Error deleting batch starting at ${i}:`, err);
            }
        }

        console.log('');
        console.log(`✅ Cleanup complete! Deleted ${deleted} orphaned objects.`);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
