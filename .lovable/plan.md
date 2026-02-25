

# Fix: Upsert Conflict Constraint Mismatch

## Problem

The database has **partial** unique indexes (with `WHERE shipment_id IS NOT NULL`), but the Supabase JS client's `onConflict` parameter only generates `ON CONFLICT (col1, col2, col3)` without a `WHERE` clause. PostgreSQL cannot match this to a partial index, causing the error.

## Solution

A single database migration that:

1. Drops the two redundant partial indexes: `idx_shipment_documents_upsert` and `idx_shipment_documents_unique`
2. Creates a standard (non-partial) unique constraint on `(user_id, document_type, shipment_id)`

PostgreSQL treats NULLs as distinct in unique indexes, so rows where `shipment_id IS NULL` will not conflict with each other -- no behavioral change for edge cases.

No frontend code changes needed. The existing `onConflict: "user_id,document_type,shipment_id"` will match the new non-partial constraint.

```sql
DROP INDEX IF EXISTS idx_shipment_documents_upsert;
DROP INDEX IF EXISTS idx_shipment_documents_unique;
CREATE UNIQUE INDEX idx_shipment_documents_upsert 
  ON public.shipment_documents (user_id, document_type, shipment_id);
```

