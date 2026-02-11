# Cloudflare R2 CORS Configuration

To enable browser-based uploads to R2, you must configure CORS (Cross-Origin Resource Sharing) on your bucket.

## Why CORS is Required

When uploading files directly from the browser to R2 using presigned URLs, the browser enforces CORS policy. Without proper CORS headers, uploads will fail with errors like:

```
Access to XMLHttpRequest at 'https://pub-*.r2.dev/...' from origin 'https://pixtrace.in' has been blocked by CORS policy
```

## Option 1: Using Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → **R2** → **pixtrace-media**
2. Click the **Settings** tab
3. Scroll to **CORS Policy**
4. Click **Add CORS Policy**
5. Add the following configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://pixtrace.in",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

## Option 2: Using Wrangler CLI

Install Wrangler if not already installed:

```bash
npm install -g wrangler
```

Set CORS policy:

```bash
wrangler r2 bucket cors put pixtrace-media --rules '[{
  "AllowedOrigins": ["https://pixtrace.in", "http://localhost:3000"],
  "AllowedMethods": ["GET", "PUT", "POST"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag", "Content-Length"],
  "MaxAgeSeconds": 3600
}]'
```

## Verify CORS Configuration

### Method 1: Check via Wrangler

```bash
wrangler r2 bucket cors get pixtrace-media
```

### Method 2: Test with curl

```bash
curl -X OPTIONS https://pub-326a39b9ee76449da28abc06e2fe351a.r2.dev/test \
  -H "Origin: https://pixtrace.in" \
  -H "Access-Control-Request-Method: PUT" \
  -v
```

Expected response headers:
```
Access-Control-Allow-Origin: https://pixtrace.in
Access-Control-Allow-Methods: GET, PUT, POST
Access-Control-Allow-Headers: *
```

### Method 3: Browser DevTools

1. Open your app at `https://pixtrace.in`
2. Try uploading a file
3. Open **DevTools** → **Network** tab
4. Look for the PUT request to `*.r2.dev`
5. Check the **Headers** tab for CORS headers

## Configuration Explained

- **AllowedOrigins**: Domains allowed to make requests (production + local dev)
- **AllowedMethods**: HTTP methods permitted (GET for downloads, PUT for uploads)
- **AllowedHeaders**: Request headers browsers can send (wildcard allows all)
- **ExposeHeaders**: Response headers browsers can access (needed for ETag verification)
- **MaxAgeSeconds**: How long browsers cache the CORS preflight response (1 hour)

## Troubleshooting

### Issue: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solution**: CORS policy not configured. Follow steps above to add it.

### Issue: Uploads work on localhost but fail on production

**Solution**: Add your production domain to `AllowedOrigins`:

```bash
wrangler r2 bucket cors put pixtrace-media --rules '[{
  "AllowedOrigins": ["https://pixtrace.in", "https://www.pixtrace.in", "http://localhost:3000"],
  ...
}]'
```

### Issue: "CORS policy: Method PUT is not allowed"

**Solution**: Ensure `PUT` is in `AllowedMethods`.

### Issue: Uploads succeed but progress tracking doesn't work

**Solution**: Add `Content-Length` to `ExposeHeaders` so browsers can read upload size.

## Security Notes

- Never use `"AllowedOrigins": ["*"]` in production (allows any website to upload)
- Keep localhost only for development
- Consider adding specific subdomains if you use them
- Review CORS logs regularly for unauthorized access attempts

## Additional Resources

- [Cloudflare R2 CORS Documentation](https://developers.cloudflare.com/r2/buckets/cors/)
- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
