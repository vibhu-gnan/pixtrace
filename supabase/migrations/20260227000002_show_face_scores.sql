-- Add show_face_scores toggle to events table
-- When enabled, gallery displays face search confidence scores on thumbnails
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_face_scores boolean DEFAULT false NOT NULL;
