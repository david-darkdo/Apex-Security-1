import { createServerFn } from "@tanstack/react-start";
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
  userId?: string | null;
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
      userId,
      customerName,
      customerPhone,
      customerEmail,
      projectName,
      projectNotes,
    } = data;

    if (!items || items.length === 0) {
      throw new Error("Cannot create collection snapshot with no items");
    }

    const refNum = generateCollectionReference();
    const finalProjectName = (projectName || "").trim() || "Security Project Quotation";

    // 1. Insert into collections using service role to bypass RLS for guest snapshots
    const { data: newColl, error: collErr } = await supabaseAdmin
      .from("collections")
      .insert({
        user_id: userId || null,
        name: refNum,
        project_name: finalProjectName,
        status: "Submitted",
        is_locked: true,
        submitted_at: new Date().toISOString(),
        internal_notes: (projectNotes || "").trim() || null,
      } as any)
      .select("id")
      .single();

    if (collErr || !newColl?.id) {
      console.error("Failed creating collection snapshot:", collErr);
      throw new Error(collErr?.message || "Failed creating collection snapshot");
    }

    const collectionId = newColl.id;

    // 2. Insert items
    const itemRows = items.map((i) => ({
      collection_id: collectionId,
      product_id: i.product_id,
      quantity: Number(i.quantity) || 1,
      unit: i.unit || "piece",
      installation_location: i.installation_location || null,
      delivery_preference: i.delivery_preference || null,
      installation_required: i.installation_required || null,
      project_notes: i.project_notes || null,
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from("collection_items")
      .insert(itemRows as any);

    if (itemsErr) {
      console.error("Failed inserting collection snapshot items:", itemsErr);
    }

    // 3. Insert or link whatsapp_inquiries
    if (customerName || customerPhone || customerEmail) {
      try {
        await supabaseAdmin.from("whatsapp_inquiries").insert({
          collection_id: collectionId,
          customer_name: (customerName || "Valued Client").trim(),
          customer_phone: (customerPhone || "").trim(),
          customer_email: (customerEmail || "").trim() || null,
          whatsapp_number: (customerPhone || "").trim() || null,
          inquiry_status: "NEW",
          status: "pending",
          internal_notes: projectNotes ? `Project Notes: ${projectNotes}` : null,
        } as any);
      } catch (inqErr) {
        console.error("Failed logging whatsapp inquiry:", inqErr);
      }
    }

    return {
      ok: true,
      collectionId,
      referenceNumber: refNum,
    };
  });
