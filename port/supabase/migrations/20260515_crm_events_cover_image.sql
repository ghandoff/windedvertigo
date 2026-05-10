-- Phase 16: Conference cover images
-- Adds a cover_image_url column to crm_events so the gallery can display
-- a cover image (og:image or CF Browser Rendering screenshot) per tile.
-- Populated lazily by POST /api/events/{id}/cover after discovery inserts.

alter table crm_events add column if not exists cover_image_url text;
