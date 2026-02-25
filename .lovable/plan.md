

# Major Functional Upgrade: Document Persistence, Shipment Management, and Archive

This plan covers four areas: fixing document persistence, adding edit/delete for shipments, creating an AllShipments management page, and enabling document editing from the details view.

---

## 1. Fix Document Persistence (Finalize Logic)

**Current state**: The DocumentationWorkshop already has working finalize logic (lines 720-777) that upserts Ready docs as "Filed" and updates shipment status. The auto-save on status change to Ready is also implemented (lines 611-654). ShipmentDetails already fetches from `shipment_documents` (line 99).

**Changes needed**:
- **ShipmentDetails.tsx**: The "No documents" empty state (lines 337-346) should also show a "Generate Documents" prompt even when documents exist but none are Filed/Ready. Additionally, add metadata display -- when a document row is clicked, show the saved metadata (HS code, exporter, quantities) in a dialog or navigate to the Documentation Workshop for editing (covered in section 4).

**Verdict**: The core persistence is already working. The main fix is improving the ShipmentDetails document display and adding edit capability.

---

## 2. Edit & Delete Functionality

### 2.1 Delete Shipment
- **ShipmentDetails.tsx**: Add a "Delete Shipment" button in the page header area that opens a Shadcn `AlertDialog` confirmation. On confirm, call `supabase.from('shipments').delete().eq('id', id)` and navigate back to Dashboard.
- **Dashboard.tsx**: Add a delete action (small trash icon or context menu) on each shipment row. Same AlertDialog + delete logic.

### 2.2 Edit Specifications
- **ShipmentDetails.tsx**: Add an "Edit Specifications" button that navigates to `/landed-cost?shipment_id={id}&product_name={name}&hs_code={code}` to resume editing in the Landed Cost Engine.

---

## 3. "View All Shipments" Management Page

### 3.1 New Page: `src/pages/AllShipments.tsx`
- Full-featured shipment management table with:
  - **Search bar**: Filter by product name or shipment ID (client-side filter)
  - **Status filter**: Toggle group or dropdown for Draft / Calculated / Filed / Port-Transit / Delivered
  - **Sort options**: Created Date (newest/oldest), Total Cost, Total Weight
  - **Delete action**: Per-row delete with AlertDialog confirmation
  - **Click to navigate**: Each row links to `/shipments/{id}`

### 3.2 Sidebar Update (`AppSidebar.tsx`)
- Add "Archive" item to the `otherItems` array with `Archive` icon and `/shipments` URL

### 3.3 Route Registration (`App.tsx`)
- Add `/shipments` route pointing to `AllShipments`, wrapped in `AuthGuard`

### 3.4 Dashboard Update (`Dashboard.tsx`)
- Limit the "All Shipments" section to show only the 5 most recent (change `.slice(0, 10)` on line 316 to `.slice(0, 5)`)
- Add a "View All →" button that links to `/shipments`

---

## 4. Document Editing from Detail View

- **ShipmentDetails.tsx**: Add an "Edit" icon (pencil) next to each document in the Q4 checklist. Clicking navigates to `/documentation-workshop?shipment_id={id}&hs_code={code}&product_name={name}&doc_type={document_type}`.
- **DocumentationWorkshop.tsx**: Read a `doc_type` URL param. If present, auto-select that document in the checklist on load so the user lands directly on the relevant document form.

---

## Technical Summary

| Change | File | Action |
|--------|------|--------|
| Delete shipment + Edit specs buttons | `src/pages/ShipmentDetails.tsx` | Edit |
| Document edit icons in Q4 | `src/pages/ShipmentDetails.tsx` | Edit |
| Delete action on rows | `src/pages/Dashboard.tsx` | Edit |
| Limit to 5 + "View All" link | `src/pages/Dashboard.tsx` | Edit |
| New management page | `src/pages/AllShipments.tsx` | Create |
| Add Archive to sidebar | `src/components/AppSidebar.tsx` | Edit |
| Register `/shipments` route | `src/App.tsx` | Edit |
| Read `doc_type` param, auto-select | `src/pages/DocumentationWorkshop.tsx` | Edit |

No database schema changes required -- all tables, columns, and RLS policies are already in place. The `shipments` table has a DELETE RLS policy (`Users can delete their own shipments`).

