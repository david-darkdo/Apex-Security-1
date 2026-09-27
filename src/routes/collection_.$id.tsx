import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchProductsByIds } from "@/lib/collection";
import { publicImageUrl } from "@/components/ImageUploader";
import { useAppSettings, waLink } from "@/lib/settings";
import { getProductionOrigin } from "@/lib/origin";
import { getCanonicalProductSlug } from "@/lib/product-url";
import type { ProductRow } from "@/lib/catalog";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  MessageCircle,
  Share2,
  ArrowLeft,
  Calendar,
  Package,
  Layers,
  CheckCircle2,
  ExternalLink,
  Phone,
  User,
} from "lucide-react";

export const Route = createFileRoute("/collection_/$id")({
  head: () => ({
    meta: [
      { title: "Project Quotation — Apex Security" },
      {
        name: "description",
        content: "Verified Apex Security project collection & hardware quotation review.",
      },
    ],
  }),
  component: CustomerCollectionQuotationPage,
});

function CustomerCollectionQuotationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { data: settings } = useAppSettings();

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [inquiry, setInquiry] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    // Admin redirect to admin CRM quotation workspace
    if (isAdmin) {
      navigate({
        to: "/admin/collections/$id",
        params: { id },
        replace: true,
      });
      return;
    }

    const loadQuotation = async () => {
      setLoading(true);
      try {
        // 1. Fetch collection record
        const { data: col, error: colErr } = await supabase
          .from("collections")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (colErr || !col) {
          toast.error("Project quotation record not found");
          setLoading(false);
          return;
        }

        setCollection(col);

        // 2. Fetch collection items
        const { data: colItems, error: itemsErr } = await supabase
          .from("collection_items")
          .select("*")
          .eq("collection_id", id);

        if (itemsErr) {
          console.error("Error loading collection items:", itemsErr);
        }

        const validItems = colItems || [];
        setItems(validItems);

        // 3. Fetch products
        const pIds = validItems.map((i: any) => i.product_id).filter(Boolean);
        if (pIds.length > 0) {
          const prods = await fetchProductsByIds(pIds);
          setProducts(prods as unknown as ProductRow[]);
        }

        // 4. Fetch linked inquiry if present
        const { data: inq } = await supabase
          .from("whatsapp_inquiries")
          .select("customer_name, customer_phone, inquiry_status, status, internal_notes")
          .eq("collection_id", id)
          .maybeSingle();

        if (inq) {
          setInquiry(inq);
        }
      } catch (err: any) {
        console.error("Failed loading quotation snapshot:", err);
        toast.error("Failed to load project quotation");
      } finally {
        setLoading(false);
      }
    };

    void loadQuotation();
  }, [id, isAdmin, authLoading, navigate]);

  // Map products by ID
  const productMap = useMemo(() => {
    const map = new Map<string, ProductRow>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Compute metrics
  const summary = useMemo(() => {
    let totalPieces = 0;
    let totalPrice = 0;

    items.forEach((item) => {
      const p = productMap.get(item.product_id);
      const qty = Number(item.quantity) || 1;
      totalPieces += qty;
      if (p && p.price) {
        totalPrice += Number(p.price) * qty;
      }
    });

    return {
      totalItems: items.length,
      totalPieces,
      totalPriceFormatted: `₦${totalPrice.toLocaleString()}`,
    };
  }, [items, productMap]);

  const handleCopyLink = async () => {
    const origin = getProductionOrigin();
    const url = `${origin}/collection/${id}`;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      toast.success("Quotation link copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast("Quotation Link: " + url);
    }
  };

  const handleWhatsAppChat = () => {
    const salesWa = settings?.sales_whatsapp || "+2347063492581";
    const origin = getProductionOrigin();
    const url = `${origin}/collection/${id}`;
    const refNum = collection?.reference_number || collection?.name || id.slice(0, 8);
    const projName = collection?.project_name || "Security Installation";
    const custName = inquiry?.customer_name || (user ? user.email : "Client");

    const messageLines = [
      `Hello Apex Security,`,
      ``,
      `I am reviewing Quotation *${refNum}* (${projName}).`,
      `Customer: ${custName}`,
      `Total Estimate: ${summary.totalPriceFormatted} (${summary.totalItems} products)`,
      ``,
      `Quotation Link: ${url}`,
      ``,
      `I would like to proceed with this quotation and confirm technical fulfillment.`,
    ];

    const waUrl = waLink(salesWa, messageLines.join("\n"));
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  if (authLoading || loading) {
    return (
      <div className="container-app py-20 text-center space-y-4">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Loading verified Apex Security quotation…
        </p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container-app py-16 max-w-md text-center space-y-4">
        <Shield className="h-12 w-12 text-primary mx-auto opacity-70" />
        <h2 className="font-display text-xl font-bold uppercase">Quotation Not Found</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The requested project collection quotation could not be located or has expired.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-canvas hover:bg-brand-orange-hover transition shadow-xs"
          >
            Browse Security Catalog
          </Link>
          <Link
            to="/collection"
            className="rounded-lg border border-border px-4 py-2 text-xs font-bold hover:bg-surface-2 transition"
          >
            Start New Workspace
          </Link>
        </div>
      </div>
    );
  }

  const refNumber = collection.reference_number || collection.name || `APX-${id.slice(0, 8)}`;
  const dateFormatted = new Date(
    collection.submitted_at || collection.created_at,
  ).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="container-app py-8 max-w-5xl space-y-8 select-none">
      {/* 1. Header Navigation & Branding */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1.5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Security Catalog
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-foreground">
              {collection.project_name || "Project Hardware Quotation"}
            </h1>
            <span className="rounded-md bg-surface-2 px-2.5 py-1 font-mono text-xs font-bold text-foreground border border-border">
              {refNumber}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Verified Quotation
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Generated: {dateFormatted}
            </span>
            {inquiry?.customer_name && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <User className="h-3.5 w-3.5 text-primary" /> Client: {inquiry.customer_name}
              </span>
            )}
          </div>
        </div>

        {/* Action CTAs in Header */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-surface-2 transition shadow-xs"
          >
            <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
            {copied ? "Link Copied!" : "Share Link"}
          </button>
          <button
            onClick={handleWhatsAppChat}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover transition shadow-sm"
          >
            <MessageCircle className="h-4 w-4" />
            Chat on WhatsApp
          </button>
        </div>
      </div>

      {/* 2. Products List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Quotation Items ({items.length})
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Total Hardware: {summary.totalPieces} Units
          </span>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
          {items.map((item, idx) => {
            const p = productMap.get(item.product_id);
            const img =
              publicImageUrl(p?.generated_studio_image) ||
              publicImageUrl(p?.image_url) ||
              "/apex-logo.png";
            const unit = item.unit || p?.pricing_unit || "piece";
            const qty = Number(item.quantity) || 1;
            const price = Number(p?.price) || 0;
            const subtotal = price * qty;
            const isWhiteBg = p?.white_image_background !== false;

            return (
              <div
                key={item.id || idx}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-2/40 transition"
              >
                {/* Product Media & Info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden shrink-0 border border-border flex items-center justify-center ${
                      isWhiteBg ? "bg-white p-1.5" : "bg-surface-2"
                    }`}
                  >
                    <img
                      src={img}
                      alt={p?.name || "Product"}
                      className={`h-full w-full ${isWhiteBg ? "object-contain" : "object-cover"}`}
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    {p ? (
                      <Link
                        to="/product/$slug"
                        params={{ slug: getCanonicalProductSlug(p) }}
                        className="font-display text-sm sm:text-base font-bold text-foreground hover:text-primary transition line-clamp-1 flex items-center gap-1.5 group"
                      >
                        {p.name}
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                      </Link>
                    ) : (
                      <p className="font-display text-sm font-bold text-foreground">
                        Hardware Item
                      </p>
                    )}
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      CODE · {p?.code || "N/A"} {p?.brand ? `| BRAND · ${p.brand}` : ""}
                    </p>

                    {/* Specifications tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.installation_location && (
                        <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-foreground border border-border">
                          Loc: {item.installation_location}
                        </span>
                      )}
                      {item.delivery_preference && (
                        <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-foreground border border-border">
                          {item.delivery_preference}
                        </span>
                      )}
                      {item.installation_required && (
                        <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-foreground border border-border">
                          Install: {item.installation_required}
                        </span>
                      )}
                      {item.project_notes && (
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                          Note: {item.project_notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price & Quantity Breakdown */}
                <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">
                      Quantity
                    </p>
                    <p className="text-xs font-bold text-foreground font-mono">
                      {qty} {unit}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] uppercase font-mono text-muted-foreground">
                      Unit Price
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      ₦{price.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-[10px] uppercase font-mono text-primary font-semibold">
                      Subtotal
                    </p>
                    <p className="text-sm sm:text-base font-extrabold text-foreground font-display">
                      ₦{subtotal.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Quotation Summary Box */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Project Quotation Summary
          </h3>
          <span className="font-mono text-xs text-muted-foreground">Ref: {refNumber}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              Total Hardware Items
            </span>
            <span className="text-lg font-bold text-foreground font-display">
              {summary.totalItems} Products
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              Total Estimated Units
            </span>
            <span className="text-lg font-bold text-foreground font-display">
              {summary.totalPieces} Units
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
              Total Estimated Investment
            </span>
            <span className="text-2xl font-black text-primary font-display">
              {summary.totalPriceFormatted}
            </span>
          </div>
        </div>

        {collection.internal_notes && (
          <div className="rounded-lg bg-surface-2 p-3 text-xs border border-border mt-3">
            <span className="font-bold text-foreground block mb-0.5">Project Scope Notes:</span>
            <p className="text-muted-foreground leading-relaxed">{collection.internal_notes}</p>
          </div>
        )}

        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Official quotation from Apex Security. Prices and technical specifications subject to confirmation by our engineering team.
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleWhatsAppChat}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover transition shadow-sm"
            >
              <MessageCircle className="h-4 w-4" />
              Continue to WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
