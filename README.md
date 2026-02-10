# PIXTRACE - Multi-Tenant Event Gallery Platform

A production-grade event gallery platform with AI-powered face search, built with Next.js 15, Supabase, and Cloudflare R2.

## 🎯 Project Status

**Phase 1: Foundation** ✅ COMPLETE

- [x] Next.js 15 with TypeScript & Tailwind CSS
- [x] Drizzle ORM with pgvector support
- [x] Supabase Auth implementation
- [x] Cloudflare R2 storage client
- [x] Authentication middleware
- [x] Database schema with RLS policies

## 🚀 Quick Start

### Prerequisites

Before running this project, you need to set up:

1. **Supabase Account** - For PostgreSQL database and authentication
2. **Cloudflare Account** - For R2 storage and image transformations
3. **AWS Account** (Optional, for Phase 4) - For SageMaker AI embeddings

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings** → **API**
3. Copy your **Project URL** and **anon public key**
4. Go to **Project Settings** → **Database** and copy the **Connection string** (use "Connection pooling" for production)

### 3. Set Up Cloudflare R2

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** → **Create bucket**
3. Name it `pixtrace-media` (or your preferred name)
4. Go to **Manage R2 API Tokens** → **Create API token**
5. Select **Edit** permissions and create the token
6. Copy the **Account ID**, **Access Key ID**, and **Secret Access Key**

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Copy from .env.example
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR-SERVICE-ROLE-KEY]"

# Cloudflare R2
R2_ACCOUNT_ID="[YOUR-ACCOUNT-ID]"
R2_ACCESS_KEY_ID="[YOUR-ACCESS-KEY]"
R2_SECRET_ACCESS_KEY="[YOUR-SECRET-KEY]"
R2_BUCKET_NAME="pixtrace-media"
R2_PUBLIC_URL="https://pub-[YOUR-HASH].r2.dev"

# Cloudflare Images (Optional - for image transformations)
CLOUDFLARE_ACCOUNT_HASH="[YOUR-ACCOUNT-HASH]"
CLOUDFLARE_IMAGES_DELIVERY_URL="https://imagedelivery.net/[YOUR-ACCOUNT-HASH]/"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### 5. Set Up Database

Enable pgvector extension in Supabase:

1. Go to **SQL Editor** in your Supabase dashboard
2. Run the following SQL:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

Now generate and push the database schema:

```bash
# Generate migrations from schema
npm run db:generate

# Push schema to database
npm run db:push
```

Apply the custom migrations:

1. Go to **SQL Editor** in Supabase
2. Copy and run each migration file:
   - `lib/db/migrations/0001_enable_pgvector.sql`
   - `lib/db/migrations/0002_enable_rls.sql`
   - `lib/db/migrations/0003_trigger_ai_webhook.sql`

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
c:\PIXTRACE\
├── app/                      # Next.js 15 App Router
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Protected organizer routes (Phase 2)
│   ├── gallery/             # Public gallery (Phase 3)
│   └── api/                 # API routes
├── lib/
│   ├── db/                  # Database schema & migrations
│   ├── storage/             # R2 client & Cloudflare Images
│   ├── auth/                # Supabase Auth utilities
│   ├── upload/              # Upload manager (Phase 2)
│   └── workers/             # Web Workers (Phase 2)
├── components/              # React components
│   ├── ui/                  # shadcn/ui components (Phase 2)
│   ├── dashboard/           # Organizer dashboard (Phase 2)
│   └── gallery/             # Public gallery (Phase 3)
├── actions/                 # Next.js Server Actions (Phase 2)
└── types/                   # TypeScript definitions
```

## 🛠 Available Scripts

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Drizzle migrations
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio (database GUI)
```

## 🔐 Authentication

The platform uses **Supabase Auth** with Row Level Security (RLS) policies:

- **Sign Up**: [http://localhost:3000/sign-up](http://localhost:3000/sign-up)
- **Sign In**: [http://localhost:3000/sign-in](http://localhost:3000/sign-in)

### How RLS Works

- **Organizers** have full CRUD access to their own events, albums, and media
- **Public users** can view events via public `event_hash` links (no authentication required)
- All queries are automatically filtered by the database based on the authenticated user

## 🗄 Database Schema

### Core Tables

- **organizers** - Authenticated users who create events
- **events** - Event containers with public `event_hash` for sharing
- **albums** - Logical grouping within events
- **media** - Photos/videos with R2 keys and 512-dim face embeddings

### Key Features

- **pgvector extension** for AI-powered face search (512-dimensional ArcFace embeddings)
- **Row Level Security** for multi-tenant isolation
- **HNSW indexes** for fast vector similarity search
- **Cascade deletes** - removing an event deletes all albums and media

## 📦 Storage Architecture

### Direct-to-R2 Uploads

Files are uploaded directly from the browser to Cloudflare R2 using presigned URLs:

1. Client requests presigned URL from `/api/upload/presigned-url`
2. Client uploads file directly to R2 via presigned URL
3. Client calls `/api/upload/complete` to create database record
4. AI webhook triggers to extract face embeddings (Phase 4)

### Path Structure

```
organizers/{organizer_id}/events/{event_id}/{album_id}/{timestamp}-{filename}
```

### Image Optimization

- **Cloudflare Image Resizing** for on-the-fly transformations
- No manual thumbnail generation - all done via URL transformations
- Example: `https://imagedelivery.net/{hash}/{r2_key}/width=600,format=auto`

## 🎨 Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL + pgvector)
- **ORM**: Drizzle ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **Auth**: Supabase Auth
- **Images**: Cloudflare Image Resizing
- **AI**: AWS SageMaker (ArcFace embeddings) - Phase 4
- **Deployment**: Vercel (recommended)

## 📋 Next Steps (Phase 2: Organizer Dashboard)

- [ ] Build event CRUD interfaces
- [ ] Implement album management
- [ ] Create upload UI with drag-and-drop
- [ ] Build Web Worker for image processing (WebP conversion)
- [ ] Implement upload queue with progress tracking
- [ ] Add QR code generation for event sharing
- [ ] Install shadcn/ui components

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npm run db:studio
```

If Drizzle Studio opens successfully, your database connection is working.

### Supabase Auth Not Working

1. Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly
2. Verify email confirmation is disabled in Supabase (for development):
   - Go to **Authentication** → **Providers** → **Email**
   - Disable "Confirm email"

### R2 Upload Fails

1. Verify R2 bucket exists and is accessible
2. Check that R2 API token has **Edit** permissions
3. Ensure CORS is enabled on your R2 bucket (configure in Cloudflare dashboard)

## 📖 Documentation

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [pgvector Docs](https://github.com/pgvector/pgvector)

## 📝 License

Private project - All rights reserved

## 🤝 Support

For issues or questions, refer to the plan file at:
`C:\Users\vibhu\.claude\plans\vast-frolicking-pearl.md`
