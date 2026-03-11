#!/usr/bin/env node

/**
 * Environment validation script
 * Run: node scripts/check-env.js
 *
 * Checks that all required env vars are set and identifies
 * which environment (dev vs prod) you're pointing to.
 */

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'NEXT_PUBLIC_APP_URL',
];

const optional = [
  'DATABASE_URL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'NEXT_PUBLIC_RAZORPAY_KEY_ID',
  'RAZORPAY_WEBHOOK_SECRET',
  'FACE_PROCESSING_SECRET',
  'MODAL_EMBED_SELFIE_CPU_URL',
  'MODAL_EMBED_SELFIE_URL',
  'MODAL_PROCESS_GALLERY_URL',
  'CLOUDFLARE_ACCOUNT_HASH',
  'CLOUDFLARE_IMAGES_DELIVERY_URL',
];

// Load .env.local
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('\x1b[31m.env.local not found! Copy .env.example and fill in values.\x1b[0m');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const [key, ...rest] = trimmed.split('=');
  env[key] = rest.join('=').replace(/^["']|["']$/g, '');
});

// Detect environment
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
const bucketName = env.R2_BUCKET_NAME || '';
const appUrl = env.NEXT_PUBLIC_APP_URL || '';

const isProdSupabase = supabaseUrl.includes('mpgnrtbhdcbenxwhutms');
const isDevSupabase = supabaseUrl.includes('wxmlksgtjwlujstcbbel');
const isProdBucket = bucketName === 'pixtrace-media';
const isDevBucket = bucketName === 'pixtrace-media-dev';
const isProdApp = appUrl.includes('pixtrace.in');
const isDevApp = appUrl.includes('localhost');

console.log('\n\x1b[1m=== PIXTRACE Environment Check ===\x1b[0m\n');

// Environment detection
if (isDevSupabase && isDevBucket && isDevApp) {
  console.log('\x1b[32m  Environment: DEVELOPMENT (safe to test)\x1b[0m');
} else if (isProdSupabase && isProdBucket && isProdApp) {
  console.log('\x1b[33m  Environment: PRODUCTION (careful!)\x1b[0m');
} else {
  console.log('\x1b[31m  Environment: MIXED (danger! check your config)\x1b[0m');
  if (isProdSupabase) console.log('\x1b[31m    - Supabase: PROD\x1b[0m');
  if (isDevSupabase) console.log('\x1b[32m    - Supabase: DEV\x1b[0m');
  if (isProdBucket) console.log('\x1b[31m    - R2 Bucket: PROD\x1b[0m');
  if (isDevBucket) console.log('\x1b[32m    - R2 Bucket: DEV\x1b[0m');
  if (isProdApp) console.log('\x1b[31m    - App URL: PROD\x1b[0m');
  if (isDevApp) console.log('\x1b[32m    - App URL: DEV\x1b[0m');
}

console.log(`\n  Supabase: ${supabaseUrl}`);
console.log(`  R2 Bucket: ${bucketName}`);
console.log(`  App URL: ${appUrl}`);

// Check required vars
console.log('\n\x1b[1m--- Required Variables ---\x1b[0m');
let missing = 0;
required.forEach(key => {
  if (env[key]) {
    console.log(`  \x1b[32m✓\x1b[0m ${key}`);
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${key} (MISSING)`);
    missing++;
  }
});

// Check optional vars
console.log('\n\x1b[1m--- Optional Variables ---\x1b[0m');
optional.forEach(key => {
  if (env[key]) {
    console.log(`  \x1b[32m✓\x1b[0m ${key}`);
  } else {
    console.log(`  \x1b[33m-\x1b[0m ${key} (not set)`);
  }
});

// Razorpay safety check
if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_ID.startsWith('rzp_live') && isDevApp) {
  console.log('\n\x1b[33m  ⚠ WARNING: Using LIVE Razorpay keys in dev environment!\x1b[0m');
  console.log('\x1b[33m    Consider creating test keys at https://dashboard.razorpay.com/app/keys\x1b[0m');
}

console.log('');
if (missing > 0) {
  console.log(`\x1b[31m${missing} required variable(s) missing!\x1b[0m\n`);
  process.exit(1);
} else {
  console.log('\x1b[32mAll required variables present.\x1b[0m\n');
}
