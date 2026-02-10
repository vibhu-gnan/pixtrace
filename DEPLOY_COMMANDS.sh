#!/bin/bash

# PIXTRACE Production Deployment Commands
# Copy and paste these commands to deploy

echo "=================================================="
echo "PIXTRACE Production Deployment"
echo "Domain: pixtrace.in"
echo "Image Resizing: Cloudflare (Enabled)"
echo "=================================================="
echo ""

# Step 1: Verify TypeScript
echo "Step 1: Verifying TypeScript..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Fix them before deploying."
  exit 1
fi
echo "✅ TypeScript verification passed"
echo ""

# Step 2: Build
echo "Step 2: Building for production..."
rm -rf .next
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Check logs above."
  exit 1
fi
echo "✅ Build successful"
echo ""

# Step 3: Choose deployment method
echo "Step 3: Choose deployment method:"
echo ""
echo "A) Vercel (Recommended - easiest)"
echo "B) Netlify"
echo "C) Docker (self-hosted)"
echo "D) Skip (deploy manually)"
echo ""
read -p "Choose (A/B/C/D): " choice

case $choice in
  A|a)
    echo ""
    echo "Installing Vercel CLI..."
    npm i -g vercel

    echo ""
    echo "Deploying to Vercel..."
    vercel --prod

    if [ $? -eq 0 ]; then
      echo ""
      echo "=================================================="
      echo "✅ Deployment to Vercel successful!"
      echo "=================================================="
      echo ""
      echo "⚠️  IMPORTANT: Add environment variables to Vercel:"
      echo ""
      echo "1. Go to: https://vercel.com/dashboard"
      echo "2. Select your project"
      echo "3. Go to Settings → Environment Variables"
      echo "4. Add all variables from .env.local"
      echo ""
      echo "Variables to add:"
      echo "  - DATABASE_URL"
      echo "  - NEXT_PUBLIC_SUPABASE_URL"
      echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
      echo "  - SUPABASE_SERVICE_ROLE_KEY"
      echo "  - R2_ACCOUNT_ID"
      echo "  - R2_ACCESS_KEY_ID"
      echo "  - R2_SECRET_ACCESS_KEY"
      echo "  - R2_BUCKET_NAME"
      echo "  - R2_PUBLIC_URL"
      echo "  - CLOUDFLARE_ACCOUNT_HASH"
      echo "  - CLOUDFLARE_IMAGES_DELIVERY_URL"
      echo "  - CLOUDFLARE_IMAGE_RESIZING_URL (should be: https://pixtrace.in)"
      echo "  - NEXT_PUBLIC_APP_URL (should be: https://pixtrace.in)"
      echo "  - NODE_ENV (should be: production)"
      echo ""
      echo "5. Redeploy after adding variables"
      echo ""
      echo "Test deployment: https://pixtrace.in"
    fi
    ;;

  B|b)
    echo ""
    echo "Installing Netlify CLI..."
    npm i -g netlify-cli

    echo ""
    echo "Deploying to Netlify..."
    netlify deploy --prod

    if [ $? -eq 0 ]; then
      echo ""
      echo "=================================================="
      echo "✅ Deployment to Netlify successful!"
      echo "=================================================="
      echo ""
      echo "⚠️  IMPORTANT: Add environment variables to Netlify"
      echo ""
      echo "Test deployment: https://pixtrace.in"
    fi
    ;;

  C|c)
    echo ""
    echo "Building Docker image..."
    docker build -t pixtrace .

    if [ $? -eq 0 ]; then
      echo ""
      echo "=================================================="
      echo "✅ Docker image created: pixtrace"
      echo "=================================================="
      echo ""
      echo "To run:"
      echo ""
      echo "docker run -p 3000:3000 \\"
      echo "  -e CLOUDFLARE_IMAGE_RESIZING_URL='https://pixtrace.in' \\"
      echo "  -e DATABASE_URL='your-db-url' \\"
      echo "  -e NEXT_PUBLIC_SUPABASE_URL='...' \\"
      echo "  -e NEXT_PUBLIC_SUPABASE_ANON_KEY='...' \\"
      echo "  -e SUPABASE_SERVICE_ROLE_KEY='...' \\"
      echo "  -e R2_ACCOUNT_ID='...' \\"
      echo "  -e R2_ACCESS_KEY_ID='...' \\"
      echo "  -e R2_SECRET_ACCESS_KEY='...' \\"
      echo "  -e R2_BUCKET_NAME='pixtrace-media' \\"
      echo "  -e R2_PUBLIC_URL='...' \\"
      echo "  -e CLOUDFLARE_ACCOUNT_HASH='...' \\"
      echo "  -e CLOUDFLARE_IMAGES_DELIVERY_URL='...' \\"
      echo "  -e NEXT_PUBLIC_APP_URL='https://pixtrace.in' \\"
      echo "  -e NODE_ENV='production' \\"
      echo "  pixtrace"
      echo ""
      echo "Access at: http://localhost:3000"
    fi
    ;;

  D|d)
    echo ""
    echo "Manual deployment files ready in .next/"
    echo ""
    echo "Your files are built and ready to deploy:"
    echo "  - .next/standalone - Application files"
    echo "  - public/ - Static assets"
    echo ""
    echo "See PRODUCTION_DEPLOYMENT.md for detailed instructions"
    ;;

  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""
echo "=================================================="
echo "Next steps:"
echo "1. Add environment variables to your hosting"
echo "2. Wait for deployment to complete"
echo "3. Visit https://pixtrace.in to verify"
echo "4. Test: Login → Create event → Upload image"
echo "5. Open DevTools (F12) → Network → check image URL"
echo "=================================================="
echo ""
echo "See DEPLOYMENT_SUMMARY.md for more details"
echo ""
