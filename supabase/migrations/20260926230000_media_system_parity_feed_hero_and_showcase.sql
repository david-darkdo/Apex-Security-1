-- Migration: Media System Parity - Catalog Feed Hero Media & Homepage Showcase Videos
-- Repository: david-darkdo/Apex-Security-1
-- Target Database: arsfzeuhtgrgubzojiix

-- ============================================================================
-- 1. CATALOG FEED HERO MEDIA (public.feed_hero_media)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feed_hero_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url text NOT NULL,
  thumbnail_url text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  duration_seconds integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feed_hero_media ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to ensure clean idempotent application
DROP POLICY IF EXISTS "Anyone can view active feed hero media" ON public.feed_hero_media;
DROP POLICY IF EXISTS "Admins manage feed hero media" ON public.feed_hero_media;

-- Public can view active media
CREATE POLICY "Anyone can view active feed hero media"
  ON public.feed_hero_media
  FOR SELECT
  TO public
  USING (is_active = true);

-- Admins / super-admins can manage all feed hero media
CREATE POLICY "Admins manage feed hero media"
  ON public.feed_hero_media
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Performance indexes for active sort ordering
CREATE INDEX IF NOT EXISTS idx_feed_hero_media_active_order 
  ON public.feed_hero_media (is_active, order_index);

-- Auto-update updated_at timestamp
CREATE OR REPLACE TRIGGER trg_feed_hero_media_updated_at
  BEFORE UPDATE ON public.feed_hero_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_hero_media TO authenticated;
GRANT SELECT ON public.feed_hero_media TO anon;
GRANT ALL ON public.feed_hero_media TO service_role;


-- ============================================================================
-- 2. HOMEPAGE SHOWCASE VIDEOS (public.showcase_videos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.showcase_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  title text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.showcase_videos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view active showcase videos" ON public.showcase_videos;
DROP POLICY IF EXISTS "Admins manage showcase videos" ON public.showcase_videos;

-- Public can view active showcase videos
CREATE POLICY "Anyone can view active showcase videos"
  ON public.showcase_videos
  FOR SELECT
  TO public
  USING (is_active = true);

-- Admins / super-admins can manage all showcase videos
CREATE POLICY "Admins manage showcase videos"
  ON public.showcase_videos
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Performance indexes for active sort ordering
CREATE INDEX IF NOT EXISTS idx_showcase_videos_active_order 
  ON public.showcase_videos (is_active, order_index);

-- Auto-update updated_at timestamp
CREATE OR REPLACE TRIGGER trg_showcase_videos_updated_at
  BEFORE UPDATE ON public.showcase_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.showcase_videos TO authenticated;
GRANT SELECT ON public.showcase_videos TO anon;
GRANT ALL ON public.showcase_videos TO service_role;
