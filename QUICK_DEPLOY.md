# 🚀 PIXTRACE - Quick Deploy Checklist

## Pre-Deployment (5 minutes)

```bash
# 1. Verify TypeScript
npx tsc --noEmit

# 2. Clean and build
rm -rf .next
npm run build

# 3. Test locally
npm run start
# Visit http://localhost:3000 and test basic functionality
```

## Deploy to Vercel (Recommended - 2 minutes)

```bash
# Install Vercel CLI if you don't have it
npm i -g vercel

# Deploy to production
vercel --prod
```

**During deployment, Vercel will ask:**
1. "Set up and deploy?" → Yes
2. "Which scope?" → Select your account
3. "Link to existing project?" → Yes (if re-deploying) or No
4. "What's your project's name?" → pixtrace

**After deployment:**
- Vercel will show your domain
- Add environment variables in Vercel dashboard:
  - Go to Settings → Environment Variables
  - Paste all variables from `.env.local`

## Alternative: Deploy to Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod
```

## Alternative: Docker Deploy (Self-hosted)

```bash
# Build Docker image
docker build -t pixtrace .

# Run container
docker run -p 3000:3000 \
  -e CLOUDFLARE_IMAGE_RESIZING_URL="https://pixtrace.in" \
  -e DATABASE_URL="..." \
  pixtrace

# Access at http://localhost:3000
```

## Post-Deployment Verification (2 minutes)

```bash
# 1. Visit your domain
# https://pixtrace.in

# 2. Login and create event

# 3. Upload test image

# 4. Open DevTools (F12) → Network tab

# 5. Check image request:
#    - URL should contain: /cdn-cgi/image/
#    - Content-Type: image/webp (Chrome)
```

## Environment Variables for Hosting

Make sure these are set on your hosting platform:

```env
# Supabase (copy from .env.local)
DATABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=https://mpgnrtbhdcbenxwhutms.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# R2
R2_ACCOUNT_ID=cc4d5b144c5490713c006e00c5daf1a0
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=pixtrace-media
R2_PUBLIC_URL=https://pub-326a39b9ee76449da28abc06e2fe351a.r2.dev

# Cloudflare
CLOUDFLARE_ACCOUNT_HASH=cc4d5b144c5490713c006e00c5daf1a0
CLOUDFLARE_IMAGES_DELIVERY_URL=https://imagedelivery.net/cc4d5b144c5490713c006e00c5daf1a0
CLOUDFLARE_IMAGE_RESIZING_URL=https://pixtrace.in

# App
NEXT_PUBLIC_APP_URL=https://pixtrace.in
NODE_ENV=production
```

## Troubleshooting

**Images not loading?**
- Check Cloudflare Image Resizing is enabled
- Verify environment variable `CLOUDFLARE_IMAGE_RESIZING_URL=https://pixtrace.in`
- Check R2 bucket is public
- Check browser console (F12) for errors

**Slow deployment?**
- First build takes 2-3 minutes
- Subsequent builds are faster (cache)
- Check hosting platform build logs

**HTTPS not working?**
- Wait 24 hours for Cloudflare SSL
- Force refresh browser (Ctrl+Shift+R)
- Check Cloudflare SSL/TLS settings

## Cost Summary

| Service | Cost | Notes |
|---------|------|-------|
| Cloudflare Pro | $20/mo | Image Resizing requirement |
| Image Resizing | ~$7.50/mo | For 10k photos |
| Vercel/Netlify | Free-$20/mo | Hosting |
| Supabase | $25+/mo | Database |
| R2 | <$1/mo | Storage |
| **Total** | ~$53+/mo | Production ready |

## Useful Commands

```bash
# Local development
npm run dev          # Start dev server at http://localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Testing
npx tsc --noEmit    # Check TypeScript errors
npm run lint        # Check ESLint

# Cleanup
rm -rf .next        # Remove build files
rm -rf node_modules # Clean reinstall
npm install         # Reinstall dependencies
```

## Key URLs

- **App**: https://pixtrace.in
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **R2 Bucket**: Manage in Cloudflare → R2

## Need Help?

See `PRODUCTION_DEPLOYMENT.md` for detailed instructions!

---

**Status**: ✅ Ready to Deploy
**Environment**: Production with Cloudflare Image Resizing
**Domain**: pixtrace.in
