import { config } from 'dotenv';
config({ path: '.env.local' });

import { getThumbnailUrl, getPreviewUrl, getOriginalUrl } from '../lib/storage/cloudflare-images';

const testKey = 'organizers/test/events/123/album/image.jpg';
const testThumbKey = 'organizers/test/events/123/album/image.jpg_thumb.webp';
const testPreviewKey = 'organizers/test/events/123/album/image.jpg_preview.webp';

console.log('=== Image URL Diagnostics ===\n');
console.log('Environment:');
console.log('  R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL ? 'SET' : 'NOT SET');
console.log('');
console.log('Sample URLs (with variants):');
console.log('  Thumbnail URL:', getThumbnailUrl(testKey, 200, testThumbKey));
console.log('  Preview URL:', getPreviewUrl(testKey, testPreviewKey));
console.log('  Original URL:', getOriginalUrl(testKey));
console.log('');
console.log('Sample URLs (without variants — fallback):');
console.log('  Thumbnail URL:', getThumbnailUrl(testKey, 200));
console.log('  Preview URL:', getPreviewUrl(testKey));
console.log('  Original URL:', getOriginalUrl(testKey));
