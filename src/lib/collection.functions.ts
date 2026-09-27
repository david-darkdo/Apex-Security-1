import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { generateCollectionReference } from "./collection";

export interface SnapshotItemInput {
  product_id: string;
  quantity?: number;
  unit?: string;
  installation_location?: string;
  delivery_preference?: string;
  installation_required?: string;
  project_notes?: string;
}

export interface CreateSnapshotInput {
  items: SnapshotItemInput[];
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  projectName?: string | null;
  projectNotes?: string | null;
}

export const createCollectionSnapshot = createServerFn({ method: "POST" })
  .validator((data: CreateSnapshotInput) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      items,
      customerName,
      customerPhone,
      customerEmail,
      projectName,
      projectNotes,
    } = data;

    if (!items || items.length === 0) {
      throw new Error("Cannot create quotation snapshot with no items");
    }

    // 1. CUSTOMER IDENTITY SECURITY: Derive verified identity strictly from server session
    // Never trust client-supplied userId to prevent IDOR / user impersonation
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    let verifiedUserId: string | null = null;
    let verifiedUserEmail: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token && token.split(".").length === 3) {
        try {
          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
          if (!userErr && userData?.user?.id) {
            verifiedUserId = userData.user.id;
            verifiedUserEmail = userData.user.email || null;
          }
        } catch (authErr) {
          console.warn("Session verification notice (treating as guest quotation):", authErr);
        }
      }
    }

    // 2. PRE-VALIDATION & CAPTURE OF PRODUCT SPECIFICATIONS (Immutability guarantee)
    const pIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean)));
    if (pIds.length === 0) {
      throw new Error("No valid product IDs provided for quotation");
    }

    const { data: fetchedProds, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, code, price, pricing_unit, brand, image_url, generated_studio_image, white_image_background")
      .in("id", pIds);

    if (prodErr || !fetchedProds || fetchedProds.length === 0) {
      console.error("Failed to query catalog for quotation snapshot:", prodErr);
      throw new Error("Failed to retrieve current product catalog data for quotation snapshot");
    }

    const prodMap = new Map(fetchedProds.map((p) => [p.id, p]));

    // Build line-by-line snapshot records
    let totalPrice = 0;
    let totalPieces = 0;

    const snapshotItems = items.map((item) => {
      const p = prodMap.get(item.product_id);
      const unitPrice = Number(p?.price) || 0;
      const qty = Math.max(1, Number(item.quantity) || 1);
      const subtotal = unitPrice * qty;
      const unit = item.unit || p?.pricing_unit || "piece";

      totalPrice += subtotal;
      totalPieces += qty;

      return {
        product_id: item.product_id,
        name: p?.name || "Security Hardware Item",
        code: p?.code || "N/A",
        brand: p?.brand || "Apex Security",
        image_url: p?.generated_studio_image || p?.image_url || null,
        white_image_background: p?.white_image_background !== false,
        unit,
        unit_price: unitPrice,
        quantity: qty,
        subtotal,
        installation_location: (item.installation_location || "").trim() || null,
        delivery_preference: (item.delivery_preference || "").trim() || null,
        installation_required: (item.installation_required || "").trim() || null,
        project_notes: (item.project_notes || "").trim() || null,
      };
    });

    const refNum = generateCollectionReference();
    const finalProjectName = (projectName || "").trim() || "Security Project Quotation";
    const finalCustomerName = (customerName || (verifiedUserEmail ? "Valued Client" : "Valued Guest")).trim();
    const finalCustomerPhone = (customerPhone || "").trim();
    const finalProjectNotes = (projectNotes || "").trim();
    const submissionTimestamp = new Date().toISOString();

    const snapshotPayload = {
      reference_number: refNum,
      project_name: finalProjectName,
      customer_name: finalCustomerName,
      customer_phone: finalCustomerPhone,
      customer_email: verifiedUserEmail || (customerEmail || "").trim() || null,
      submitted_at: submissionTimestamp,
      total_price: totalPrice,
      total_pieces: totalPieces,
      total_items: snapshotItems.length,
      project_notes: finalProjectNotes || null,
      items: snapshotItems,
    };

    // 3. TRANSACTION / FAILURE SAFETY: Compensating cleanup pattern
    let createdCollectionId: string | null = null;

    try {
      // Step A: Insert collection record with immutable snapshot_data JSON
      const { data: newColl, error: collErr } = await supabaseAdmin
        .from("collections")
        .insert({
          user_id: verifiedUserId,
          name: refNum,
          reference_number: refNum,
          project_name: finalProjectName,
          status: "Submitted",
          is_locked: true,
          submitted_at: submissionTimestamp,
          internal_notes: finalProjectNotes || null,
          total_price: totalPrice,
          total_items: snapshotItems.length,
          snapshot_data: snapshotPayload,
        } as any)
        .select("id")
        .single();

      if (collErr || !newColl?.id) {
        console.error("Failed creating collection record:", collErr);
        throw new Error(collErr?.message || "Failed creating collection record");
      }

      createdCollectionId = newColl.id;

      // Step B: Insert collection items with line-level snapshot values
      const itemRows = snapshotItems.map((it) => ({
        collection_id: createdCollectionId!,
        product_id: it.product_id,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        subtotal: it.subtotal,
        product_name: it.name,
        product_code: it.code,
        product_image: it.image_url,
        installation_location: it.installation_location,
        delivery_preference: it.delivery_preference,
        installation_required: it.installation_required,
        project_notes: it.project_notes,
      }));

      const { error: itemsErr } = await supabaseAdmin
        .from("collection_items")
        .insert(itemRows as any);

      if (itemsErr) {
        throw new Error(`Failed inserting collection items: ${itemsErr.message}`);
      }

      // Step C: Log inquiry in CRM (whatsapp_inquiries)
      if (finalCustomerName || finalCustomerPhone || verifiedUserEmail || customerEmail) {
        try {
          await supabaseAdmin.from("whatsapp_inquiries").insert({
            collection_id: createdCollectionId,
            customer_name: finalCustomerName,
            customer_phone: finalCustomerPhone,
            customer_email: verifiedUserEmail || (customerEmail || "").trim() || null,
            whatsapp_number: finalCustomerPhone || null,
            inquiry_status: "NEW",
            status: "pending",
            internal_notes: finalProjectNotes ? `Project Scope: ${finalProjectNotes}` : null,
          } as any);
        } catch (inqErr) {
          console.warn("Notice: Non-critical WhatsApp inquiry CRM logging notice:", inqErr);
        }
      }

      return {
        ok: true,
        collectionId: createdCollectionId,
        referenceNumber: refNum,
        totalPrice,
        snapshot: snapshotPayload,
      };
    } catch (err: any) {
      // COMPENSATING CLEANUP:
      // If collection was created but item creation or sequence failed, rollback by deleting the orphaned collection
      if (createdCollectionId) {
        try {
          await supabaseAdmin.from("collection_items").delete().eq("collection_id", createdCollectionId);
          await supabaseAdmin.from("whatsapp_inquiries").delete().eq("collection_id", createdCollectionId);
          await supabaseAdmin.from("collections").delete().eq("id", createdCollectionId);
          console.warn(`[Compensating Cleanup] Cleaned up orphaned collection ${createdCollectionId} after failure.`);
        } catch (cleanupErr) {
          console.error("[Compensating Cleanup Error]:", cleanupErr);
        }
      }
      throw new Error(err.message || "Quotation submission failed");
    }
  });
