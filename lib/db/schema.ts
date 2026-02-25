import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum, index, integer, boolean, smallint, real } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const processingStatusEnum = pgEnum('processing_status', [
  'pending',
  'processing',
  'completed',
  'failed'
]);

export const mediaTypeEnum = pgEnum('media_type', [
  'image',
  'video'
]);

// ============================================================================
// TABLES
// ============================================================================

// Organizers (authenticated users)
export const organizers = pgTable('organizers', {
  id: uuid('id').primaryKey().defaultRandom(),
  authId: varchar('auth_id', { length: 255 }).notNull().unique(), // Supabase/Clerk user ID
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  authIdIdx: index('organizers_auth_id_idx').on(table.authId),
  emailIdx: index('organizers_email_idx').on(table.email),
}));

// Events
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizerId: uuid('organizer_id').notNull().references(() => organizers.id, { onDelete: 'cascade' }),
  eventHash: varchar('event_hash', { length: 32 }).notNull().unique(), // Public identifier
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  eventDate: timestamp('event_date'),
  coverMediaId: uuid('cover_media_id'), // Self-reference, nullable
  // Theme customization (JSON)
  theme: jsonb('theme').$type<{
    primaryColor?: string;
    logoUrl?: string;
    customCss?: string;
    hero?: {
      mode: 'single' | 'slideshow' | 'auto';
      slideshowMediaIds?: string[];
      intervalMs?: number;
    };
  }>().default(sql`'{}'::jsonb`),
  isPublic: boolean('is_public').default(true).notNull(),
  allowDownload: boolean('allow_download').default(true).notNull(),
  allowSlideshow: boolean('allow_slideshow').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  eventHashIdx: index('events_event_hash_idx').on(table.eventHash),
  organizerIdIdx: index('events_organizer_id_idx').on(table.organizerId),
  createdAtIdx: index('events_created_at_idx').on(table.createdAt),
}));

// Albums (logical grouping within events)
export const albums = pgTable('albums', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: index('albums_event_id_idx').on(table.eventId),
  sortOrderIdx: index('albums_sort_order_idx').on(table.sortOrder),
}));

// Media (photos/videos with embeddings)
// Note: pgvector type will be added via raw SQL in migrations
export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  albumId: uuid('album_id').notNull().references(() => albums.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), // Denormalized for performance

  // R2 Storage
  r2Key: text('r2_key').notNull(), // Full path: organizers/{org_id}/events/{event_id}/{album_id}/{filename}
  originalFilename: varchar('original_filename', { length: 512 }).notNull(),

  // Media metadata
  mediaType: mediaTypeEnum('media_type').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  fileSize: integer('file_size').notNull(), // Bytes
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'), // For videos, in seconds

  // Variant files (pre-computed thumbnails and previews)
  thumbnailR2Key: text('thumbnail_r2_key'), // 200x200 cover-crop WebP
  previewR2Key: text('preview_r2_key'),     // 1200x1200 contain-fit WebP

  // AI/Face Recognition - Note: vector type defined in migration
  // faceEmbedding: vector column added via SQL
  processingStatus: processingStatusEnum('processing_status').default('pending').notNull(),
  processingError: text('processing_error'),

  // Metadata
  capturedAt: timestamp('captured_at'), // EXIF date if available
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  albumIdIdx: index('media_album_id_idx').on(table.albumId),
  eventIdIdx: index('media_event_id_idx').on(table.eventId),
  r2KeyIdx: index('media_r2_key_idx').on(table.r2Key),
  processingStatusIdx: index('media_processing_status_idx').on(table.processingStatus),
  capturedAtIdx: index('media_captured_at_idx').on(table.capturedAt),
  uploadedAtIdx: index('media_uploaded_at_idx').on(table.uploadedAt),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const organizersRelations = relations(organizers, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(organizers, {
    fields: [events.organizerId],
    references: [organizers.id],
  }),
  albums: many(albums),
  media: many(media),
  coverMedia: one(media, {
    fields: [events.coverMediaId],
    references: [media.id],
  }),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  event: one(events, {
    fields: [albums.eventId],
    references: [events.id],
  }),
  media: many(media),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  album: one(albums, {
    fields: [media.albumId],
    references: [albums.id],
  }),
  event: one(events, {
    fields: [media.eventId],
    references: [events.id],
  }),
  faceEmbeddings: many(faceEmbeddings),
}));

// ============================================================================
// FACE SEARCH TABLES (type reference — queries use Supabase JS client)
// ============================================================================

export const faceProcessingJobStatusEnum = pgEnum('face_job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'no_faces',
]);

// Face embeddings — one row per detected face, vector(512) via pgvector
export const faceEmbeddings = pgTable('face_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  faceIndex: smallint('face_index').notNull().default(0),
  // embedding: vector(512) — managed via raw SQL / pgvector, not Drizzle
  confidence: real('confidence'),
  bboxX1: integer('bbox_x1'),
  bboxY1: integer('bbox_y1'),
  bboxX2: integer('bbox_x2'),
  bboxY2: integer('bbox_y2'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  mediaIdIdx: index('face_embeddings_media_id_idx').on(table.mediaId),
  eventIdIdx: index('face_embeddings_event_id_idx').on(table.eventId),
}));

// Face processing jobs — queue for GPU processing
export const faceProcessingJobs = pgTable('face_processing_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  mediaId: uuid('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attemptCount: smallint('attempt_count').notNull().default(0),
  maxAttempts: smallint('max_attempts').notNull().default(3),
  facesFound: smallint('faces_found'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  nextRetryAt: timestamp('next_retry_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: index('fpj_event_id_idx').on(table.eventId),
}));

export const faceEmbeddingsRelations = relations(faceEmbeddings, ({ one }) => ({
  media: one(media, {
    fields: [faceEmbeddings.mediaId],
    references: [media.id],
  }),
  event: one(events, {
    fields: [faceEmbeddings.eventId],
    references: [events.id],
  }),
}));

export const faceProcessingJobsRelations = relations(faceProcessingJobs, ({ one }) => ({
  media: one(media, {
    fields: [faceProcessingJobs.mediaId],
    references: [media.id],
  }),
  event: one(events, {
    fields: [faceProcessingJobs.eventId],
    references: [events.id],
  }),
}));
