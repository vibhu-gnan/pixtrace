# PIXTRACE Production Deployment Guide

## ✅ SETUP COMPLETE - Production Ready!

Your PIXTRACE application is now fully configured for production with Cloudflare Image Resizing.

### Current Configuration

**Domain**: pixtrace.in
**Image Resizing**: Enabled via Cloudflare
**Cloudflare Plan Required**: Pro ($20/month)
**Monthly Image Resizing Cost**: ~$7.50 (for 10,000 photos)

---

## 🚀 Deployment Steps

### Step 1: Verify Cloudflare Setup (Already Done)

✅ Domain `pixtrace.in` added to Cloudflare
✅ Nameservers configured
✅ Image Resizing enabled in Cloudflare Pro plan
✅ Environment variable updated: `CLOUDFLARE_IMAGE_RESIZING_URL=https://pixtrace.in`

### Step 2: Build for Production

```bash
# Navigate to project directory
cd C:\PIXTRACE

# Clean build (remove old .next folder if it exists)
rm -rf .next

# Build
npm run build

# This will:
# ✓ Compile TypeScript
# ✓ Optimize assets
# ✓ Generate production files
```

### Step 3: Test Locally Before Deploying

```bash
# Start production server
npm run start

# Visit http://localhost:3000
# Test:
# - Login with Supabase auth
# - Create event
# - Upload test image
# - Verify image displays correctly
```

### Step 4: Deploy to Hosting

Choose one of these options:

#### Option A: Vercel (Recommended - easiest)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Follow prompts:
# - Connect GitHub account
# - Select project
# - Add environment variables from .env.local
# - Deploy
```

#### Option B: Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod

# Or use Netlify UI: drag & drop `.next/standalone` folder
```

#### Option C: Your Own Server (VPS/Docker)
```bash
# Build
npm run build

# Start with PM2 (recommended)
npm i -g pm2
pm2 start "npm run start" --name "pixtrace"
pm2 startup
pm2 save

# Access via your domain
```

#### Option D: AWS/Google Cloud/Azure
Use their deployment guides or containers (Dockerfile included can be created if needed)

### Step 5: Configure Environment Variables on Hosting

Add these to your hosting platform's environment variables:

```env
# Database
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://mpgnrtbhdcbenxwhutms.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# R2
R2_ACCOUNT_ID="cc4d5b144c5490713c006e00c5daf1a0"
R2_ACCESS_KEY_ID="a3f308c3e69ab9da26eb01c56b99549b"
R2_SECRET_ACCESS_KEY="e874e517429857b4990a84e4393203ea08b382b556d4b75e05d8e1ea9b3ff3f6"
R2_BUCKET_NAME="pixtrace-media"
R2_PUBLIC_URL="https://pub-326a39b9ee76449da28abc06e2fe351a.r2.dev"

# Cloudflare
CLOUDFLARE_ACCOUNT_HASH="cc4d5b144c5490713c006e00c5daf1a0"
CLOUDFLARE_IMAGES_DELIVERY_URL="https://imagedelivery.net/cc4d5b144c5490713c006e00c5daf1a0"
CLOUDFLARE_IMAGE_RESIZING_URL="https://pixtrace.in"

# App
NEXT_PUBLIC_APP_URL="https://pixtrace.in"
NODE_ENV="production"
```

### Step 6: Configure DNS (If Using Custom Hosting)

If not using Vercel/Netlify, point your domain to your hosting provider:

1. Go to Cloudflare dashboard
2. DNS settings for pixtrace.in
3. Create CNAME or A record pointing to your hosting
4. Wait for propagation (up to 24 hours, usually instant)

---

## 🧪 Verification Checklist

After deployment, verify everything works:

- [ ] Website loads at `https://pixtrace.in`
- [ ] HTTPS certificate is valid (green lock)
- [ ] Login works (Supabase auth)
- [ ] Can create new event
- [ ] Can upload image
- [ ] Image displays in gallery
- [ ] Image URL shows Cloudflare transform
- [ ] Open DevTools → Network → check image response:
  - URL should contain: `/cdn-cgi/image/width=200...`
  - Content-Type should be: `image/webp` (Chrome) or `image/jpeg` (Safari)
- [ ] Gallery loads fast
- [ ] No console errors

### How to Verify Cloudflare Image Resizing is Working:

1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Click on any image request
5. Check URL - should be:
   ```
   https://pixtrace.in/cdn-cgi/image/width=200,height=200,fit=cover,format=auto/.../photo.jpg
   ```
6. Check Response headers - should show:
   ```
   content-type: image/webp (Chrome)
   or
   content-type: image/jpeg (Safari/Firefox)
   ```

---

## 📊 Monitor Performance

### Cloudflare Analytics
1. Login to Cloudflare dashboard
2. Select pixtrace.in domain
3. Analytics & Logs
4. Monitor:
   - **Requests**: Total traffic
   - **Bandwidth saved**: Should show 30-50% savings
   - **Cache hit ratio**: Should be 80%+
   - **Image Resizing**: Shows number of transforms

### Application Performance
- Monitor Supabase usage
- Monitor R2 storage and bandwidth
- Check application error logs

---

## 💰 Cost Breakdown (Monthly Estimate)

| Item | Cost | Notes |
|------|------|-------|
| Cloudflare Pro | $20 | Required for Image Resizing |
| Image Resizing | $7.50 | ~10k unique photos/transforms |
| Supabase | $25-100 | Database, auth, hosting |
| R2 Storage | $0.15 | ~10GB for 10k photos |
| Hosting (Vercel) | $0-50 | Free tier available, $20+ for Pro |
| **Total** | **~$53-195/month** | Depends on usage scale |

---

## 🔒 Security Best Practices

### Before Going Live

- [ ] Never commit `.env.local` to Git
- [ ] Use environment variables on hosting platform
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Use Cloudflare DDoS protection (free)
- [ ] Enable HTTPS (automatic with Cloudflare)
- [ ] Set up GitHub secrets for CI/CD
- [ ] Review Supabase security settings
- [ ] Limit R2 access to service account only

### Ongoing

- [ ] Monitor failed authentication attempts
- [ ] Review access logs weekly
- [ ] Update dependencies monthly
- [ ] Backup database regularly (Supabase auto-backups)
- [ ] Monitor R2 for unusual access patterns

---

## 🐛 Troubleshooting

### Images not displaying
- ✓ Check Cloudflare domain is correctly configured
- ✓ Verify `CLOUDFLARE_IMAGE_RESIZING_URL` is set
- ✓ Check R2 bucket is public (should be)
- ✓ Review browser console for CORS errors

### 404 errors on images
- ✓ Verify R2 keys are correct in database
- ✓ Check R2 bucket contents
- ✓ Verify R2 credentials are correct

### Slow image loading
- ✓ Check Cloudflare cache hit ratio
- ✓ Verify R2 region is correct (ap-south-1)
- ✓ Consider CDN edge locations

### HTTPS certificate issues
- ✓ Wait 24-48 hours for Cloudflare SSL provisioning
- ✓ Check Cloudflare SSL/TLS settings
- ✓ Flush browser cache and hard refresh (Ctrl+Shift+R)

---

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Cloudflare Docs**: https://developers.cloudflare.com
- **Next.js Docs**: https://nextjs.org/docs
- **R2 Docs**: https://developers.cloudflare.com/r2

---

## ✨ Next Steps (Phase 3)

Once production is stable:

1. **Public Gallery** - Allow guests to view event galleries without login
2. **QR Code Sharing** - Generate QR codes for easy gallery sharing
3. **Advanced Filters** - Search, sort, filter photos
4. **Download Features** - Bulk download, ZIP export
5. **AI Integration** - Face detection, auto-tagging, search

---

**Status**: ✅ Ready for Production Deployment
**Date**: 2026-02-10
**Domain**: pixtrace.in
**Image Resizing**: Cloudflare (Enabled)

Deploy with confidence! 🚀
