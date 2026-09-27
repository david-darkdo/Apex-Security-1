-- BUILD 5: QUOTATION SNAPSHOT & DATA INTEGRITY HARDENING MIGRATION
-- Project: Apex Security One
-- Target Supabase: arsfzeuhtgrgubzojiix

-- 1. Add immutable quotation snapshot metadata to collections table
ALTER TABLE public.collections 
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_data JSONB,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0;

-- 2. Add line-level snapshot values to collection_items table
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_code TEXT,
  ADD COLUMN IF NOT EXISTS product_image TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC;

-- 3. Add fast lookup index on reference_number
CREATE INDEX IF NOT EXISTS idx_collections_reference_number ON public.collections(reference_number);

-- 4. Atomic quotation pipeline stage updater RPC
CREATE OR REPLACE FUNCTION public.update_quotation_pipeline_stage(
  _collection_id UUID,
  _new_stage TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Update collection status
  UPDATE public.collections
  SET status = _new_stage,
      updated_at = NOW()
  WHERE id = _collection_id;

  -- 2. Update linked inquiry if present
  UPDATE public.whatsapp_inquiries
  SET status = LOWER(_new_stage),
      inquiry_status = UPPER(_new_stage),
      updated_at = NOW()
  WHERE collection_id = _collection_id;

  RETURN jsonb_build_object('success', true, 'stage', _new_stage);
END;
$$;
