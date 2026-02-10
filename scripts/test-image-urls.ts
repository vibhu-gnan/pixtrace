import { config } from 'dotenv';
config({ path: '.env.local' });

import { getThumbnailUrl, getCloudflareImageUrl } from '../lib/storage/cloudflare-images';

const testKey = 'organizers/test/events/123/album/image.jpg';

console.log('=== Image URL Diagnostics ===\n');
console.log('Environment:');
console.log('  R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL ? 'SET' : 'NOT SET');
console.log('  CLOUDFLARE_IMAGES_DELIVERY_URL:', process.env.CLOUDFLARE_IMAGES_DELIVERY_URL ? 'SET' : 'NOT SET');
console.log('');
console.log('Sample URLs:');
console.log('  Thumbnail URL:', getThumbnailUrl(testKey, 300));
console.log('  Full URL:', getCloudflareImageUrl(testKey, { width: 1280, format: 'auto' }));
