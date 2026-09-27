import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchProductsByIds,
  getGuestCollection,
  getUserCollectionItems,
  getCachedUserCollectionItems,
  getBatchCollectionWorkspaceData,
  ensureUserCollection,
  removeGuestItem,
  removeItemFromUserCollection,
  detectProductUnit,
  updateGuestItemRequirements,
  updateUserItemRequirements,
  lockAndSubmitCollection,
  generateCollectionReference,
  updateCustomerPhoneNumber,
  setGuestCollection,
  mergeGuestIntoUser,
  getUserItemRequirements,
  type ItemRequirements,
  type CollectionV2,
} from "@/lib/collection";
import { createCollectionSnapshot } from "@/lib/collection.functions";
import { getCanonicalProductSlug } from "@/lib/product-url";
import { useAppSettings, waLink } from "@/lib/settings";
import { getProductionOrigin } from "@/lib/origin";
import { toast } from "sonner";
import {
  MessageCircle,
  Share2,
  Trash2,
  Heart,
  ChevronDown,
  ChevronUp,
  Lock,
  RefreshCw,
  FileText,
  Phone,
  CheckCircle2,
  AlertCircle,
  History,
  Layers,
  User,
  Building,
  ClipboardList,
} from "lucide-react";
import { publicImageUrl } from "@/components/ImageUploader";

export const Route = createFileRoute("/collection")({
  validateSearch: (search: Record<string, unknown>): { autoPush?: boolean } => {
    return {
      autoPush: search.autoPush === "true" || search.autoPush === true ? true : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Active Project Workspace — Apex Security" }] }),
  component: CollectionPage,
});

function CollectionPage() {
  const { user, loading } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: settings } = useAppSettings();
  const snapshotFn = useServerFn(createCollectionSnapshot);

  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionV2 | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [lastSubmittedRef, setLastSubmittedRef] = useState<string | null>(null);

  // Custom double tab toggle views
  const [activeView, setActiveView] = useState<"collection" | "favorites">("collection");
  const [favoriteProducts, setFavoriteProducts] = useState<any[]>([]);

  // Project Requirements state per product
  const [requirementsMap, setRequirementsMap] = useState<Record<string, ItemRequirements>>({});
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Customer & Project Level Requirements
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [projectName, setProjectName] = useState("Security Installation Project");
  const [projectNotes, setProjectNotes] = useState("");

  // Phone modal & popup blocker fallback state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [whatsappFallbackUrl, setWhatsappFallbackUrl] = useState<string | null>(null);

  // Remove confirmation modal state
  const [productToRemove, setProductToRemove] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      if (user) {
        // 1. Instant local cached render (< 16ms)
        const cached = getCachedUserCollectionItems(user.id);
        if (cached.items && cached.items.length > 0) {
          setCollectionId(cached.collection_id || null);
          setItems(cached.items);
          fetchProductsByIds(cached.items.map((i: any) => i.product_id)).then((cachedProds) => {
            if (cachedProds.length > 0) setProducts(cachedProds);
          });
        }

        // 2. Non-blocking guest merge if present
        const guestItems = getGuestCollection();
        if (guestItems.length > 0) {
          await mergeGuestIntoUser(user.id);
        }

        // 3. Parallel background sync (< 1 roundtrip)
        const batch = await getBatchCollectionWorkspaceData(user.id);
        setUserProfile(batch.profile);
        setCollectionId(batch.collectionId);
        setItems(batch.items);
        if (batch.collectionData) {
          setCollectionData({
            id: batch.collectionData.id,
            user_id: batch.collectionData.user_id,
            name: batch.collectionData.name || "Project Workspace",
            reference_number:
              (batch.collectionData as any).reference_number ||
              generateCollectionReference(batch.collectionData.id),
            project_name: batch.collectionData.project_name,
            status: batch.collectionData.status || "Draft",
            is_locked: !!batch.collectionData.is_locked,
            parent_collection_id: batch.collectionData.parent_collection_id,
            version: batch.collectionData.version || 1,
            submitted_at: batch.collectionData.submitted_at,
            created_at: batch.collectionData.created_at,
            updated_at: batch.collectionData.updated_at,
          });
          if (batch.collectionData.project_name) {
            setProjectName(batch.collectionData.project_name);
          }
        }
        if (batch.profile?.full_name) {
          setCustomerName(batch.profile.full_name);
        }
        if (batch.profile?.phone_number) {
          setCustomerPhone(batch.profile.phone_number);
          setPhoneInput(batch.profile.phone_number);
        }
        setProducts(batch.products);

        // Load user requirements
        const userReqs = getUserItemRequirements(user.id);
        setRequirementsMap(userReqs);
      } else {
        // Guest mode (< 16ms instantaneous localStorage fetch)
        const guest = getGuestCollection();
        const pIds = guest.map((i) => i.product_id);
        const reqMap: Record<string, ItemRequirements> = {};
        guest.forEach((i) => {
          if (
            i.quantity ||
            i.installation_location ||
            i.delivery_preference ||
            i.installation_required ||
            i.project_notes
          ) {
            reqMap[i.product_id] = {
              quantity: i.quantity,
              unit: i.unit,
              installation_location: i.installation_location,
              delivery_preference: i.delivery_preference,
              installation_required: i.installation_required,
              project_notes: i.project_notes,
            };
          }
        });
        setRequirementsMap(reqMap);

        if (pIds.length > 0) {
          const prods = await fetchProductsByIds(pIds);
          setProducts(prods);
        } else {
          setProducts([]);
        }
        setItems(guest);
      }
    };

    void load();

    const handleCollectionChange = () => {
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener("collection:change", handleCollectionChange);
    return () => window.removeEventListener("collection:change", handleCollectionChange);
  }, [user, refreshKey]);

  // Load user favorites
  useEffect(() => {
    if (!user) return;
    const loadFavs = async () => {
      const { data: favs } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", user.id);
      if (favs && favs.length > 0) {
        const favProds = await fetchProductsByIds(favs.map((f: any) => f.product_id));
        setFavoriteProducts(favProds);
      } else {
        setFavoriteProducts([]);
      }
    };
    void loadFavs();
  }, [user]);

  const handleRequirementChange = (productId: string, patch: Partial<ItemRequirements>) => {
    const updated = {
      ...(requirementsMap[productId] || {}),
      ...patch,
    };
    setRequirementsMap((prev) => ({
      ...prev,
      [productId]: updated,
    }));

    if (user) {
      updateUserItemRequirements(user.id, productId, updated);
    } else {
      updateGuestItemRequirements(productId, updated);
    }
  };

  const toggleExpand = (productId: string) => {
    setExpandedMap((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const handleRemoveClick = (product: any) => {
    setProductToRemove(product);
  };

  const confirmRemoveProduct = () => {
    if (!productToRemove) return;
    const productId = productToRemove.id;
    if (user) {
      removeItemFromUserCollection(user.id, productId);
    } else {
      removeGuestItem(productId);
    }
    setProductToRemove(null);
    toast.success("Item removed from workspace");
  };

  // Summary Metrics Calculation
  const summaryMetrics = useMemo(() => {
    const activeProducts = activeView === "collection" ? products : favoriteProducts;
    let totalPieces = 0;
    let totalPrice = 0;
    let installerRequestedCount = 0;
    let deliveryItemsCount = 0;

    activeProducts.forEach((p) => {
      const req = requirementsMap[p.id] || {};
      const qty = req.quantity || 1;
      const price = Number(p.price || 0);

      totalPieces += qty;
      totalPrice += price * qty;

      if (
        req.installation_required &&
        req.installation_required !== "Not Sure" &&
        req.installation_required !== "No, Supply Hardware Only" &&
        req.installation_required !== "No, Supply Only"
      ) {
        installerRequestedCount++;
      }

      if (req.delivery_preference && req.delivery_preference !== "Self Pickup") {
        deliveryItemsCount++;
      }
    });

    return {
      totalPieces,
      totalPriceFormatted: `₦${totalPrice.toLocaleString()}`,
      totalQtyString: `${totalPieces.toLocaleString()} Units`,
      installerRequestedCount,
      deliveryItemsCount,
      itemCount: activeProducts.length,
    };
  }, [products, favoriteProducts, activeView, requirementsMap]);

  const handlePushToWhatsAppClick = async () => {
    const currentPhone = customerPhone || userProfile?.phone_number || user?.phone;
    if (!currentPhone) {
      setPhoneInput("");
      setNameInput(customerName || "");
      setShowPhoneModal(true);
      return;
    }
    await executePushToWhatsApp(customerName, currentPhone);
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      toast.error("Please enter a valid phone or WhatsApp number");
      return;
    }

    const finalPhone = phoneInput.trim();
    const finalName = nameInput.trim() || customerName || "Valued Client";

    setCustomerPhone(finalPhone);
    setCustomerName(finalName);

    if (user) {
      await updateCustomerPhoneNumber(user.id, finalPhone);
      setUserProfile((prev: any) => ({ ...(prev || {}), phone_number: finalPhone, full_name: finalName }));
    }

    setShowPhoneModal(false);
    toast.success("Contact details confirmed");
    await executePushToWhatsApp(finalName, finalPhone);
  };

  const executePushToWhatsApp = async (nameOverride?: string, phoneOverride?: string) => {
    if (!settings?.sales_whatsapp) {
      toast.error("Sales WhatsApp number is not configured");
      return;
    }

    const activeItems = activeView === "collection" ? products : favoriteProducts;
    if (activeItems.length === 0) {
      toast.error("Your workspace is empty");
      return;
    }

    setIsSubmitting(true);
    const finalCustomerName = (nameOverride || customerName || userProfile?.full_name || user?.email || "Valued Client").trim();
    const finalCustomerPhone = (phoneOverride || customerPhone || userProfile?.phone_number || "").trim();
    const finalProjectName = (projectName || "Security Installation Project").trim();
    const finalProjectNotes = (projectNotes || "").trim();

    try {
      // 1. Create server-side locked snapshot (authenticated or guest)
      const snapshotItems = activeItems.map((p) => {
        const req = requirementsMap[p.id] || {};
        return {
          product_id: p.id,
          quantity: req.quantity || 1,
          unit: req.unit || detectProductUnit(p),
          installation_location: req.installation_location,
          delivery_preference: req.delivery_preference,
          installation_required: req.installation_required,
          project_notes: req.project_notes,
        };
      });

      const snapRes = await snapshotFn({
        data: {
          items: snapshotItems,
          userId: user ? user.id : null,
          customerName: finalCustomerName,
          customerPhone: finalCustomerPhone,
          customerEmail: user ? user.email : null,
          projectName: finalProjectName,
          projectNotes: finalProjectNotes,
        },
      });

      const snapId = snapRes.collectionId;
      const refNum = snapRes.referenceNumber;
      const origin = getProductionOrigin();
      const singleCollectionUrl = `${origin}/collection/${snapId}`;

      // 2. Construct clean, professional Apex Security WhatsApp quotation
      const messageParts = [
        "Hello Apex Security,",
        "",
        "I would like a quotation for my project.",
        "",
        `*Collection Reference:* ${refNum}`,
        `*Customer:* ${finalCustomerName}`,
        `*Project:* ${finalProjectName}`,
        "",
        `*Project Collection Link:*`,
        `${singleCollectionUrl}`,
        "",
        `*SELECTED PRODUCTS (${activeItems.length}):*`,
      ];

      activeItems.forEach((p, idx) => {
        const req = requirementsMap[p.id] || {};
        const qty = req.quantity || 1;
        const unit = req.unit || detectProductUnit(p);
        const loc = req.installation_location ? ` | Loc: ${req.installation_location}` : "";
        const del = req.delivery_preference ? ` | Delivery: ${req.delivery_preference}` : "";
        const inst =
          req.installation_required && req.installation_required !== "Not Sure"
            ? ` | Install: ${req.installation_required}`
            : "";
        const notes = req.project_notes ? ` | Notes: ${req.project_notes}` : "";

        messageParts.push(
          `${idx + 1}. *${p.name}* (Code: ${p.code}) — ${qty} ${unit}${loc}${del}${inst}${notes}`,
        );
      });

      if (finalProjectNotes) {
        messageParts.push("", `*PROJECT SCOPE NOTES:* ${finalProjectNotes}`);
      }

      messageParts.push(
        "",
        `*PROJECT SUMMARY:*`,
        `Total Est. Quantity: ${summaryMetrics.totalQtyString}`,
        `Total Est. Value: ${summaryMetrics.totalPriceFormatted}`,
        `Delivery Items: ${summaryMetrics.deliveryItemsCount}`,
        `Installer Service Requested: ${summaryMetrics.installerRequestedCount > 0 ? "Yes" : "No"}`,
      );

      const msg = messageParts.join("\n");
      const url = waLink(settings.sales_whatsapp, msg);

      // 3. Launch WhatsApp in new tab
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win || win.closed || typeof win.closed === "undefined") {
        setWhatsappFallbackUrl(url);
        toast("Quotation generated! Click the button below to launch WhatsApp.");
      } else {
        toast.success("Quotation submitted & saved! Opening WhatsApp…");
      }

      // 4. Reset active workspace
      setGuestCollection([]);
      setItems([]);
      setProducts([]);
      setJustSubmitted(true);
      setLastSubmittedRef(refNum);
      setCollectionId(null);
      setCollectionData(null);
    } catch (err: any) {
      console.error("Submission failed:", err);
      toast.error(err?.message || "Failed to submit quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareLink = async () => {
    const activeItems = activeView === "collection" ? products : favoriteProducts;
    if (activeItems.length === 0) {
      toast.error("Your workspace is empty");
      return;
    }

    setIsSharing(true);
    try {
      const snapshotItems = activeItems.map((p) => {
        const req = requirementsMap[p.id] || {};
        return {
          product_id: p.id,
          quantity: req.quantity || 1,
          unit: req.unit || detectProductUnit(p),
          installation_location: req.installation_location,
          delivery_preference: req.delivery_preference,
          installation_required: req.installation_required,
          project_notes: req.project_notes,
        };
      });

      const snapRes = await snapshotFn({
        data: {
          items: snapshotItems,
          userId: user ? user.id : null,
          customerName: customerName || "Showroom Client",
          customerPhone: customerPhone || "",
          customerEmail: user ? user.email : null,
          projectName: projectName || "Security Project Quotation",
          projectNotes: projectNotes || "",
        },
      });

      const origin = getProductionOrigin();
      const url = `${origin}/collection/${snapRes.collectionId}`;

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Shareable quotation link copied to clipboard!");
      } else {
        toast.success("Quotation Link: " + url);
      }
    } catch (err: any) {
      console.error("Share error:", err);
      toast.error(err?.message || "Failed to create shareable link");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="container-app py-6 space-y-6 select-none">
      {/* 1. PAGE TITLE & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
              Active Project Workspace
            </h1>
            {collectionData?.reference_number && (
              <span className="rounded-md bg-surface-2 text-foreground text-xs font-mono font-bold px-2.5 py-1 border border-border">
                {collectionData.reference_number}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Build your custom project bill of quantities, set hardware specifications, and push directly to WhatsApp for rapid pricing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-surface-2 transition shrink-0 shadow-xs"
          >
            <span>Security Catalog</span>
          </Link>
          {user && (
            <Link
              to="/my-collections"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-2 transition"
            >
              <History className="h-4 w-4 text-primary" />
              <span>Collection History</span>
            </Link>
          )}
          {products.length > 0 && (
            <button
              onClick={shareLink}
              disabled={isSharing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-2 transition disabled:opacity-50"
            >
              <Share2 className="h-4 w-4 text-primary" />
              <span>{isSharing ? "Generating…" : "Share Collection"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      {justSubmitted ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4 max-w-lg mx-auto">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-foreground">
              Quotation Request Submitted!
            </h2>
            <p className="text-xs text-muted-foreground">
              Reference: <strong className="font-mono text-foreground">{lastSubmittedRef}</strong>
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Your quotation request has been generated and logged. Your active project workspace is now reset and ready for your next project quotation.
            </p>
          </div>

          {whatsappFallbackUrl && (
            <div className="pt-2">
              <a
                href={whatsappFallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover shadow-md transition"
              >
                <MessageCircle className="h-4 w-4" />
                Launch WhatsApp Now
              </a>
            </div>
          )}

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setJustSubmitted(false);
                setLastSubmittedRef(null);
                setWhatsappFallbackUrl(null);
              }}
              className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover transition shadow-xs"
            >
              Start New Project Workspace
            </button>
            {user && (
              <Link
                to="/my-collections"
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground hover:bg-surface-2 transition"
              >
                View Collection History
              </Link>
            )}
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4">
          <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-lg font-semibold text-foreground">
              No Active Project Workspace
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Explore our security hardware catalogue and add products to build your project quotation.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/"
              className="inline-block rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover transition shadow-sm"
            >
              Browse Security Catalog
            </Link>
            {user && (
              <Link
                to="/my-collections"
                className="inline-block rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground hover:bg-surface-2 transition"
              >
                View Collection History
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products List & Specification Inputs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Selected Products ({products.length})
              </span>
              <span className="text-xs text-muted-foreground">
                Est. Value:{" "}
                <strong className="text-foreground font-medium">
                  {summaryMetrics.totalPriceFormatted}
                </strong>
              </span>
            </div>

            <div className="space-y-4">
              {products.map((product) => {
                const req = requirementsMap[product.id] || {};
                const qty = req.quantity || 1;
                const unit = req.unit || detectProductUnit(product);
                const isExpanded = !!expandedMap[product.id];
                const itemTotal = Number(product.price || 0) * qty;
                const isWhiteBg = product.white_image_background !== false;

                const imgUrl =
                  publicImageUrl(product.generated_studio_image) ||
                  publicImageUrl(product.image_url) ||
                  "/apex-logo.png";

                return (
                  <div
                    key={product.id}
                    className="rounded-xl border border-border bg-card overflow-hidden shadow-xs"
                  >
                    {/* Main Row */}
                    <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Product Thumbnail & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <Link
                          to="/product/$slug"
                          params={{ slug: getCanonicalProductSlug(product) }}
                          className={`h-16 w-16 rounded-lg overflow-hidden shrink-0 border border-border flex items-center justify-center ${
                            isWhiteBg ? "bg-white p-1.5" : "bg-surface-2"
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={product.name}
                            className={`h-full w-full ${isWhiteBg ? "object-contain" : "object-cover"}`}
                          />
                        </Link>

                        <div className="min-w-0">
                          <Link
                            to="/product/$slug"
                            params={{ slug: getCanonicalProductSlug(product) }}
                            className="font-display text-sm font-bold text-foreground hover:text-primary transition line-clamp-1"
                          >
                            {product.name}
                          </Link>
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            CODE · {product.code}
                          </p>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            ₦{Number(product.price || 0).toLocaleString()}
                            <span className="text-[10px] font-normal text-muted-foreground ml-1">
                              /{product.pricing_unit || "piece"}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Quantity & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-border rounded-lg bg-surface-2 overflow-hidden">
                            <button
                              onClick={() =>
                                handleRequirementChange(product.id, {
                                  quantity: Math.max(1, qty - 1),
                                })
                              }
                              className="px-2.5 py-1 text-xs font-bold text-foreground hover:bg-card transition"
                            >
                              -
                            </button>
                            <span className="px-2.5 py-1 text-xs font-mono font-bold text-foreground">
                              {qty}
                            </span>
                            <button
                              onClick={() =>
                                handleRequirementChange(product.id, { quantity: qty + 1 })
                              }
                              className="px-2.5 py-1 text-xs font-bold text-foreground hover:bg-card transition"
                            >
                              +
                            </button>
                          </div>

                          <select
                            value={unit}
                            onChange={(e) =>
                              handleRequirementChange(product.id, { unit: e.target.value })
                            }
                            className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium focus:outline-none"
                          >
                            <option value="Pieces">Pieces</option>
                            <option value="Units">Units</option>
                            <option value="Sets">Sets</option>
                            <option value="Systems">Systems</option>
                            <option value="Meters">Meters</option>
                          </select>

                          <span className="text-xs font-semibold text-primary ml-auto sm:ml-2">
                            ₦{itemTotal.toLocaleString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handleRemoveClick(product)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expand/Collapse Specification Details Button */}
                    <div className="border-t border-border/50 bg-surface-2/40 px-4 py-2 flex items-center justify-between text-xs">
                      <button
                        onClick={() => toggleExpand(product.id)}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isExpanded
                            ? "Hide Specifications"
                            : "Configure Specifications & Notes"}
                        </span>
                      </button>

                      {/* Micro summary of configured specs */}
                      {!isExpanded && (
                        <span className="text-[11px] text-muted-foreground font-mono truncate max-w-xs">
                          {[
                            req.installation_location && `Loc: ${req.installation_location}`,
                            req.delivery_preference,
                            req.installation_required &&
                              req.installation_required !== "Not Sure" &&
                              `Install: ${req.installation_required}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>

                    {/* Expandable Specifications Panel */}
                    {isExpanded && (
                      <div className="border-t border-border/60 bg-surface-2/60 p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Installation Location (e.g. Main Entrance Gate, Server Room, Perimeter)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Main Entrance Gate / Perimeter Fence"
                              value={req.installation_location || ""}
                              onChange={(e) =>
                                handleRequirementChange(product.id, {
                                  installation_location: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Delivery Preference
                            </label>
                            <select
                              value={req.delivery_preference || "Deliver to Site"}
                              onChange={(e) =>
                                handleRequirementChange(product.id, {
                                  delivery_preference: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                            >
                              <option value="Deliver to Site">
                                Deliver to Site (Abuja / Lagos / Nationwide)
                              </option>
                              <option value="Self Pickup">Self Pickup from Showroom</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Installation Service Required?
                            </label>
                            <select
                              value={req.installation_required || "Not Sure"}
                              onChange={(e) =>
                                handleRequirementChange(product.id, {
                                  installation_required: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                            >
                              <option value="Not Sure">Not Sure (Need Advice)</option>
                              <option value="Yes, Full Installation">
                                Yes, Full Professional Installation Required
                              </option>
                              <option value="No, Supply Hardware Only">No, Supply Hardware Only</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Special Project Specifications / Requirements
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. 4-channel NVR, left-hand door opening, biometric access"
                              value={req.project_notes || ""}
                              onChange={(e) =>
                                handleRequirementChange(product.id, {
                                  project_notes: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quotation Summary Card & Push to WhatsApp Action */}
          <div className="space-y-4">
            {/* Customer & Project Details Card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-sm">
              <div className="border-b border-border pb-2.5">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Client & Project Scope
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Customer / Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Arc. Oladipo / Dangote Refinery"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +234 801 234 5678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Project / Site Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maitama Villa Security Setup"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Additional Request / Site Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Site inspection required next Tuesday..."
                    value={projectNotes}
                    onChange={(e) => setProjectNotes(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Quotation Summary Card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="border-b border-border pb-3">
                <h3 className="font-display text-base font-semibold">Quotation Summary</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estimated bill of quantities for technical review & fulfillment.
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Selected Products:</span>
                  <span className="font-semibold text-foreground">{summaryMetrics.itemCount}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Est. Total Quantity:</span>
                  <span className="font-semibold text-foreground">
                    {summaryMetrics.totalQtyString}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Preference:</span>
                  <span className="font-semibold text-foreground">
                    {summaryMetrics.deliveryItemsCount} Items Configured
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Installer Services:</span>
                  <span className="font-semibold text-foreground">
                    {summaryMetrics.installerRequestedCount > 0 ? "Requested" : "None"}
                  </span>
                </div>

                <div className="border-t border-border pt-3 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-foreground">
                    Est. Total Hardware Cost:
                  </span>
                  <span className="font-bold text-lg text-primary">
                    {summaryMetrics.totalPriceFormatted}
                  </span>
                </div>
              </div>

              <button
                onClick={handlePushToWhatsAppClick}
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover active:scale-[0.99] transition shadow-md disabled:opacity-50"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{isSubmitting ? "Submitting…" : "Push Collection to WhatsApp"}</span>
              </button>

              <button
                onClick={shareLink}
                disabled={isSharing}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-card transition shadow-xs disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5 text-primary" />
                <span>{isSharing ? "Generating Link…" : "Copy Shareable Link"}</span>
              </button>

              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                Direct handoff to Apex Security engineering desk via WhatsApp (+234 706 349 2581).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Phone & Name Input Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xl">
            <div className="space-y-1 text-center">
              <Phone className="h-8 w-8 text-primary mx-auto" />
              <h3 className="font-display text-lg font-bold text-foreground">Contact Information</h3>
              <p className="text-xs text-muted-foreground">
                Please enter your contact details so our engineering desk can link your quotation snapshot.
              </p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Full Name / Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. Engr. Johnson"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Phone / WhatsApp Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +234 801 234 5678"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  autoFocus
                  required
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  className="flex-1 rounded-xl border border-border bg-surface-2 py-2 text-xs font-semibold text-foreground hover:bg-card transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold uppercase tracking-wider text-canvas hover:bg-brand-orange-hover transition shadow-sm"
                >
                  Continue to WhatsApp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {productToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xl">
            <div className="space-y-1 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
              <h3 className="font-display text-lg font-bold text-foreground">Remove Product?</h3>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to remove{" "}
                <strong className="text-foreground">{productToRemove.name}</strong> from your active project workspace?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToRemove(null)}
                className="flex-1 rounded-xl border border-border bg-surface-2 py-2.5 text-xs font-semibold text-foreground hover:bg-card transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveProduct}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition shadow-sm"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
