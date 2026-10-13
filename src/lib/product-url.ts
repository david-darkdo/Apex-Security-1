import { slugify } from "./slug";
import { getProductionOrigin } from "./origin";

export interface MinimumProductInfo {
  id?: string | null;
  slug?: string | null;
  canonical_slug?: string | null;
  name?: string | null;
}

/**
 * Returns the single authoritative normalized slug for a product.
 * Prefers the database canonical_slug, then the legacy route slug, then the product name.
 */
export function getCanonicalProductSlug(product: MinimumProductInfo | null | undefined): string {
  if (!product) return "";
  if (product.canonical_slug) {
    const clean = slugify(product.canonical_slug);
    if (clean) return clean;
  }
  if (product.slug) {
    const clean = slugify(product.slug);
    if (clean) return clean;
  }
  if (product.name) {
    const clean = slugify(product.name);
    if (clean) return clean;
  }
  return product.id || "";
}

/**
 * Returns the relative canonical path for a product: /product/{slug}
 */
export function getCanonicalProductPath(product: MinimumProductInfo | null | undefined): string {
  const slug = getCanonicalProductSlug(product);
  return slug ? `/product/${slug}` : "/";
}

/**
 * Returns the absolute canonical URL for a product: https://{domain}/product/{slug}
 */
export function getCanonicalProductUrl(
  product: MinimumProductInfo | null | undefined,
  origin: string = getProductionOrigin()
): string {
  const base = origin.replace(/\/+$/, "");
  const path = getCanonicalProductPath(product);
  return `${base}${path}`;
}
