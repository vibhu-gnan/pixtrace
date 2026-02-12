import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data, error } = await supabase
    .from('media')
    .select('original_filename, thumbnail_r2_key, preview_r2_key')
    .limit(3);

  if (error) {
    console.error('Error:', error);
  } else {
    for (const row of data || []) {
      console.log(`${row.original_filename}:`);
      console.log(`  thumb: ${row.thumbnail_r2_key ? 'SET' : 'NULL'}`);
      console.log(`  preview: ${row.preview_r2_key ? 'SET' : 'NULL'}`);
    }
  }
}

main();
