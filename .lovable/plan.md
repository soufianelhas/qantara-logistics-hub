
# Qantara — Two-Part Implementation Plan

## Overview

This plan covers two distinct but interconnected sets of work:

**Part A — Persistent Shipment State & Compound Flow Hardening**
Wire every step of the 3-step workflow (HS Navigator → LCE → Documentation Workshop) to a single persistent `shipment_id` in the database, so data is never lost between steps.

**Part B — Authenticity Studio (AI Image Refinement)**
Build the Authenticity Studio as a full AI-powered image enhancement dashboard using Gemini 2.5 Flash (via Lovable AI), with a Before/After slider, three Consultant Presets, and a real-time E-Factor Risk Flag.

---

## Part A: Persistent Shipment State & Compound Flow Hardening

### Current State

The current workflow passes data between pages via URL search parameters only. Nothing is saved to Supabase until the user explicitly clicks "Save Shipment" in the LCE — and even then, the Documentation Workshop has no way to look up that saved record. The `shipment_id` is manually appended as a URL param, not retrieved from Supabase.

### What Needs to Change

**Step 1 — HS Neural-Navigator**
- On page load (or when a user starts classifying), create a `Draft` shipment record in Supabase and hold the `shipment_id` in state.
- When the user clicks "Apply Code & Calculate Costs" (currently "Calculate Landed Cost for this Code"), update the shipment record with `hs_code_assigned` and pass the real `shipment_id` in the URL to the LCE.
- If no authenticated user exists, the flow remains URL-param-only (guest mode).

**Step 2 — Landed Cost Engine**
- Accept a `shipment_id` URL param from the HS Navigator.
- Instead of inserting a new record on "Save Shipment", perform an `UPDATE` (upsert) on the existing shipment, writing `raw_cost_v`, `freight`, `insurance`, `duty`, `taxes`, `e_factor_multiplier`, `port_congestion_level`, `weather_risk_level`, and `status = 'Calculated'`.
- Replace the current "Save Shipment" + static success banner with a high-visibility CTA button: **"Finalize Costs & Generate Documents"** that becomes visible once the realistic cost is calculated. This button updates the shipment status and navigates to the Documentation Workshop, passing `shipment_id`, `hs_code`, `product_name`, `product_value`, and `freight` in the URL.

**Step 3 — Documentation Workshop**
- Accept `shipment_id` from the URL.
- On load, if a `shipment_id` is present and the user is authenticated, fetch the shipment record from Supabase directly using `.from("shipments").select().eq("id", shipment_id)`.
- Use the fetched `hs_code_assigned`, `product_name`, and `raw_cost_v` to pre-populate the checklist and form fields — do not rely on URL params alone for this data.
- Display a "Loaded from shipment" badge when data comes from the database.

### Technical Changes

| File | Changes |
|---|---|
| `src/pages/HSNeuralNavigator.tsx` | Add `createDraftShipment()` on classify start (if authenticated); update record with `hs_code_assigned` on export; pass `shipment_id` in URL |
| `src/pages/LandedCostEngine.tsx` | Accept `shipment_id` param; replace insert with upsert; replace "Save Shipment" button with "Finalize Costs & Generate Documents" CTA after calculation; navigate to `/documentation-workshop` with `shipment_id` |
| `src/pages/DocumentationWorkshop.tsx` | Accept `shipment_id`; fetch shipment from Supabase on load; pre-fill data from DB record |

---

## Part B: Authenticity Studio (AI Image Refinement)

### Architecture

```text
User uploads image
       |
       v
AuthenticityStudio.tsx (React)
  - Before/After slider
  - Preset selector grid
  - E-Factor Risk Flag (reads eFactor from LCE context/localStorage)
       |
       v  (calls Supabase Edge Function)
supabase/functions/image-enhance/index.ts
  - Receives: { imageBase64, preset }
  - Builds system prompt from preset definition
  - Calls Lovable AI Gateway (gemini-2.5-flash-image)
  - Returns: { enhancedImageBase64 }
       |
       v
AuthenticityStudio.tsx
  - Renders enhanced image in "After" panel
  - Allows download
```

### The Three Consultant Presets

These are built into the edge function and the UI — no `ai_studio_presets` database table is needed since prompts are hardcoded in the function for security and simplicity:

| Preset | Target Market | System Prompt |
|---|---|---|
| Muted Moroccan Sunlight | EU | "Enhance the image with soft, diffused golden-hour lighting. Use a warm, desaturated color palette to evoke an authentic, artisanal feel. Keep shadows soft and natural." |
| Industrial Texture | US/Modern | "Increase micro-contrast to highlight raw material textures like hand-woven wool or hammered metal. Use cool, neutral lighting with sharp, clean shadows for a high-end gallery look." |
| Clean White Background | E-commerce | "Remove background clutter and replace it with a studio-perfect #FFFFFF white. Normalize all lighting to be bright and even, ensuring the product's true colors are perfectly represented." |

### E-Factor Risk Flag Logic

The studio will read a `qantara_efactor` value from `localStorage` (written by the LCE when a calculation is done). If the E-Factor multiplier is above 1.15 (i.e., "high" risk threshold), a high-visibility amber alert banner will appear:

> "Logistics Risk High: High winds/congestion at Tanger Med. Suggest pausing marketing promotion."

This requires the LCE to write its E-Factor result to `localStorage` on calculation. The Authenticity Studio reads this on mount.

### Database: `ai_studio_presets` Table

A new migration will create this table as specified:

```sql
CREATE TABLE public.ai_studio_presets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_name text NOT NULL,
  system_prompt text NOT NULL,
  target_market text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

With RLS policies matching the existing pattern (user-owned rows). The three presets will be seeded as public reference data (no `user_id` required — read-only reference table).

### Before/After Slider

Built using a custom CSS/React implementation with a draggable divider that clips the "after" image, revealing it progressively. No external library needed — this uses `pointer` events and CSS `clip-path`.

### UI Layout

```text
┌─────────────────────────────────────────────────────────┐
│  [Risk Flag Banner - amber, if E-Factor > 1.15]         │
├──────────────────────────────┬──────────────────────────┤
│                              │  Preset Grid (3 cards)   │
│   Before/After Preview       │  ┌────┐ ┌────┐ ┌────┐   │
│   ┌──────────────────┐       │  │ EU │ │ US │ │E-co│   │
│   │  [BEFORE | AFTER]│       │  └────┘ └────┘ └────┘   │
│   │  drag slider      │       │                          │
│   └──────────────────┘       │  [Upload Image]           │
│                              │  [Enhance with AI]        │
│   [Download Enhanced]        │  [Status / Loading]       │
└──────────────────────────────┴──────────────────────────┘
```

### Files to Create / Edit

| File | Action |
|---|---|
| `supabase/functions/image-enhance/index.ts` | **Create** — Edge function that calls `gemini-2.5-flash-image` with preset prompt and base64 image |
| `supabase/config.toml` | **Edit** — Register `image-enhance` function |
| `src/pages/AuthenticityStudio.tsx` | **Rebuild** — Full studio UI with Before/After slider, preset grid, risk flag, upload/download |
| `src/pages/LandedCostEngine.tsx` | **Edit** — Write E-Factor result to `localStorage` on calculation |
| Database migration | **Create** — `ai_studio_presets` table |

---

## Implementation Sequence

1. **Database migration** — Add `ai_studio_presets` table and seed the 3 presets.
2. **LCE update** — Add `localStorage` E-Factor write + "Finalize & Generate Documents" CTA + shipment upsert logic.
3. **HS Navigator update** — Add draft shipment creation on classify + hs_code update on export.
4. **Documentation Workshop update** — Add Supabase fetch by `shipment_id` on load.
5. **Edge function** — Build `image-enhance` with Lovable AI (Gemini image model).
6. **Authenticity Studio** — Full rebuild with all UI components.
7. **Deploy edge function** — Automatic deployment.

---

## Notes & Constraints

- Authentication is required for Supabase persistence; unauthenticated users will continue to work in URL-param-only guest mode with graceful fallback.
- The `image-enhance` edge function uses `LOVABLE_API_KEY` which is already configured as a secret — no new secrets needed.
- Image uploads are handled client-side as base64 strings, passed to the edge function body. No storage bucket is needed for the enhancement flow (the result is displayed and optionally downloaded client-side).
- The Before/After slider will show a placeholder state before an image is uploaded, and an "Enhance" disabled state until both an image and a preset are selected.
- The E-Factor risk flag threshold of ×1.15 is configurable as a constant.
