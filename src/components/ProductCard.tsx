import { Link } from "@tanstack/react-router";
import type { ProductRow } from "@/lib/catalog";
import { AddToCollectionButton } from "./AddToCollectionButton";
import { publicImageUrl } from "./ImageUploader";
import { Heart } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { getCanonicalProductSlug } from "@/lib/product-url";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "sonner";

export function ProductCardSkeleton() {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xs select-none">
      <div className="aspect-square bg-surface-2 relative flex items-center justify-center overflow-hidden">
        <div className="animate-pulse">
          <img
            src="/apex-logo.png"
            alt="Loading"
            className="h-9 w-auto object-contain opacity-40"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="space-y-2">
          <div className="h-3.5 bg-surface-2 rounded-md w-3/4 animate-pulse" />
          <div className="h-2.5 bg-surface-2/60 rounded-md w-1/2 animate-pulse" />
        </div>
        <div className="h-4 bg-surface-2 rounded-md w-1/3 mt-2 animate-pulse" />
        <div className="mt-auto flex gap-2 pt-2 border-t border-border">
          <div className="flex-1 h-7 bg-surface-2 rounded animate-pulse" />
          <div className="flex-1 h-7 bg-surface-2 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function ProductCard({ product }: { product: ProductRow }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFav = isFavorite(product.id);

  const img =
    publicImageUrl(product.generated_studio_image) ||
    publicImageUrl(product.image_url) ||
    "https://placehold.co/600x600/080C13/FD7603?text=Apex+Security";

  // Determine if product is recently published (newer than 7 days)
  const isNew = useMemo(() => {
    const createdAt = (product as any).created_at;
    if (!createdAt) return false;
    const createdDate = new Date(createdAt);
    const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }, [(product as any).created_at]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void toggleFavorite(product.id, product);
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/50">
      {/* Floating Badges */}
      {isNew && (
        <span className="absolute top-2.5 left-2.5 z-10 bg-canvas/90 border border-primary/50 backdrop-blur px-2.5 py-0.5 rounded text-[9px] font-bold text-primary tracking-wider uppercase shadow-md">
          NEW
        </span>
      )}

      {/* Floating Favorite Heart Icon */}
      <button
        onClick={handleToggleFavorite}
        className="absolute top-2.5 right-2.5 z-10 rounded-full p-2 bg-surface-elevated/90 hover:bg-surface-elevated text-foreground transition shadow-md border border-border hover:border-primary/50 focus:outline-none"
        aria-label={isFav ? "Remove from favorites" : "Save to favorites"}
      >
        <Heart
          className={`h-3.5 w-3.5 transition-colors duration-300 text-muted-foreground hover:text-primary ${isFav ? "fill-primary text-primary" : ""}`}
        />
      </button>

      {/* Product Image Stage: Studio Vitrine (White) or Natural Presentation */}
      <Link
        to="/product/$slug"
        params={{ slug: getCanonicalProductSlug(product) }}
        className={`block aspect-square overflow-hidden relative flex items-center justify-center ${
          product.white_image_background !== false
            ? "bg-white p-3"
            : "bg-surface-2"
        }`}
      >
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full transition-transform duration-700 ease-out group-hover:scale-105 ${
            product.white_image_background !== false
              ? "object-contain"
              : "object-cover"
          }`}
        />
      </Link>

      {/* Product Details on Deep Charcoal Shell */}
      <div className="flex flex-1 flex-col gap-2 p-3.5 bg-surface">
        <div>
          <h3 className="font-display text-sm font-bold leading-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            CODE · {product.code}
          </p>
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
          {product.original_price != null &&
            Number(product.original_price) > Number(product.price) && (
              <span className="line-through text-xs font-normal text-destructive">
                ₦{Number(product.original_price).toLocaleString()}
              </span>
            )}
          <p className="font-display text-base font-extrabold text-foreground">
            ₦{Number(product.price).toLocaleString()}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              /{product.pricing_unit || "piece"}
            </span>
          </p>
        </div>
        <div className="mt-auto flex gap-2 pt-2 border-t border-border">
          <AddToCollectionButton productId={product.id} compact />
          <Link
            to="/product/$slug"
            params={{ slug: getCanonicalProductSlug(product) }}
            className="flex-1 flex items-center justify-center rounded-lg bg-primary text-canvas px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-brand-orange-hover transition shadow-xs"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
