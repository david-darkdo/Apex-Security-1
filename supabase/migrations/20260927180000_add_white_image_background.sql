-- Build 4A: Product Media Control — White Image Background ON/OFF toggle
-- Allows per-product toggling between the pure white studio vitrine aperture and natural image background.
-- Defaults to true (preserving existing behavior for all existing and newly created products).

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS white_image_background BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.white_image_background IS 'Controls whether the product card renders a forced white studio stage (true) or natural image background (false).';
